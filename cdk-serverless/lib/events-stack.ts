import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaSource from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as fs from 'fs';
import * as path from 'path';

import { aws_secretsmanager } from 'aws-cdk-lib';
import { Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { environment } from '../helpers/environments';

interface stackProps extends cdk.StackProps {
  api: apigateway.RestApi,
  hlBus: events.EventBus,
  dlq: sqs.Queue,
  queueProps: sqs.QueueProps,
  lambdaRole: iam.Role,
  vpc: Vpc,
  dbSecurityGroup: SecurityGroup,
  secret: aws_secretsmanager.Secret,
  hlEnv: environment,
  dbLayer: lambda.LayerVersion,
  origins: readonly string[],
}

export class EventsStack extends Construct {
  public readonly lambdaIntegration: apigateway.LambdaIntegration;

  constructor(scope: Construct, id: string, props: stackProps) {
    super(scope, id);
    
    const queueEntry = new sqs.Queue(this, 'EventsSQS_hl', {...props.queueProps, queueName: 'HL-Events-Entry'});
    const queueResponse = new sqs.Queue(this, 'EventsSQS_response_hl', {...props.queueProps, queueName: 'HL-Events-Response'});

    const apiLambda = new lambda.Function(this, 'ApiLambdaEvents', {
      functionName: 'HL-Events-ApiFunction',
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('apiLambda/event'),
      handler: 'handlerEvent.main',
      memorySize: 768, // Optimize for more performance
      timeout: cdk.Duration.seconds(60),
      role: props.lambdaRole,
      environment: {
        HL_RESPONSE_QUEUE_URL: queueResponse.queueUrl, 
        ALLOWED_ORIGINS: JSON.stringify(props.origins),
      },
    });

    // IAM Policy to the action events:PutEvents
    const policy = new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [props.hlBus.eventBusArn],
    });
    apiLambda.addToRolePolicy(policy);
    apiLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
      resources: [queueResponse.queueArn],
    }));

    this.lambdaIntegration = new apigateway.LambdaIntegration(apiLambda);

    const carsResource = props.api.root.addResource('cars');
    carsResource.addMethod('GET', this.lambdaIntegration);
    carsResource.addMethod('POST', this.lambdaIntegration);
    
    const findCarsResource = carsResource.addResource('name');
    findCarsResource.addMethod('GET', this.lambdaIntegration);

    const resources = [
      carsResource,
      findCarsResource,
    ];

    for (const resource of resources) {
        resource.addCorsPreflight({
            allowOrigins: [...props.origins],
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type'],
        });
    }

    // EventBridge Rules
    const ruleEvents = new events.Rule(this, 'ruleEvents_hl', {
        eventBus: props.hlBus,
        ruleName: 'HL-EventRequestRule',
        eventPattern: {
            source: ['hl.app.events'],
            detailType: ['message-for-queue'],
        },
    });
    // Associate rules to SQSs
    ruleEvents.addTarget(new targets.SqsQueue(queueEntry));
    
    const eventlambdaSecurityGroup = new SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Lambda security group for accessing Aurora',
    });
    props.dbSecurityGroup.addIngressRule(eventlambdaSecurityGroup, Port.tcp(5432), 'Allow Lambda access to Aurora');
    
    // custom ips
    const filePath = path.join(__dirname, '..', 'helpers', 'ips_dev.txt');
    const ips = fs.readFileSync(filePath, 'utf8').split('\n').map(ip => ip.trim()).filter(ip => ip !== '');
    ips.forEach(ip => {
      props.dbSecurityGroup.addIngressRule(Peer.ipv4(ip), Port.tcp(5432), `Allow access from ${ip}`);
    });

    const sqslambdaFunction = new lambda.Function(this, 'EventSQSLambda', {
      functionName: 'HL-Events-SQSHandler',
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('handlers/event'),
      handler: 'handler.main',
      memorySize: 1024,
      timeout: cdk.Duration.seconds(59), // 1 second less than sqs visibility timeout
      role: props.lambdaRole,
      // vpc: props.vpc,
      // vpcSubnets: {
      //   // subnets: [props.vpc.publicSubnets[0]],
      //   subnetType: SubnetType.PUBLIC,
      // },
      // allowPublicSubnet: true,
      // securityGroups: [eventlambdaSecurityGroup],
      layers: [props.dbLayer],
      environment: {
        HL_RESPONSE_QUEUE_URL: queueResponse.queueUrl,
        DB_SECRET_ARN: props.secret.secretArn,
      },
    });

    sqslambdaFunction.addEventSource(new lambdaSource.SqsEventSource(queueEntry));

    // Añadir permisos necesarios para la función Lambda
    sqslambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
      resources: [queueEntry.queueArn],
    }));

    sqslambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes', 'sqs:SendMessage'],
      resources: [queueResponse.queueArn],
    }));

    sqslambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue'],
      resources: [props.secret.secretArn],
    }));

    sqslambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ec2:CreateNetworkInterface', 'ec2:DescribeNetworkInterfaces', 'ec2:DeleteNetworkInterface'],
      resources: ['*'],
    }));
  }
}
