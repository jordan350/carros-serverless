import * as cdk from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { environment } from '../helpers/environments';
import { DBStack } from './db-stack';
import { EventsStack } from './events-stack';
import { apiGatewayStack } from './api-gateway-stack';
import { webSiteStack } from './web-site-stack';

export class HL_CDK extends cdk.Stack {
  localenv: environment;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    this.localenv = environment.DEV; // change according to deployment 
    const region = 'us-east-1';

    // Web Site
    const webStack = new webSiteStack(this, 'webSiteStack');
    const allowedOrigins = {
      origins: [
        webStack.websiteBucket.bucketWebsiteUrl,
      ]
    } as const

    // Custom EventBridge Bus
    const hlBus = new events.EventBus(this, 'hlBus', {eventBusName: 'HL-bus'});
    
    //Gateway with Lambda Integration
    const ags = new apiGatewayStack(this, 'apiGatewayStack', {hlBus: hlBus});
    
    // General DLQ Queue
    const dqlProps: sqs.QueueProps= {      
      visibilityTimeout: cdk.Duration.seconds(30),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // long Polling
      retentionPeriod: cdk.Duration.days(7), 
    }
    const DeadLetterQueue_hl = new sqs.Queue(this, 'DeadLetterQueue_hl', {...dqlProps, queueName: 'HL-DeadLetterQueue'});

    // Create a custom rol 
    const lambdaServiceRole = new iam.Role(this, 'CustomLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      roleName: 'HL-CDK-LambdaServiceRole', // Nombre personalizado del rol
    });

    // SQS General props
    const queueProps: sqs.QueueProps= {
      visibilityTimeout: cdk.Duration.seconds(60),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // long Polling
      retentionPeriod: cdk.Duration.minutes(30), 
      deadLetterQueue: {
        queue: DeadLetterQueue_hl,
        maxReceiveCount: 3
      },
    };
    
    const vpc = new Vpc(this, 'VPC', {
      vpcName: 'HL-VPC', 
      maxAzs: 2, 
      subnetConfiguration: [
        {
          name: 'hl-subnet-public',
          subnetType: SubnetType.PUBLIC, // Si es Publico, no requiere NAT Gateway, en producción evaluar dejarlo PRIVATE_WITH_EGRESs
        }
      ]
    });

    // layers
    const dbLayer = new lambda.LayerVersion(this, 'dbLayer', {
      layerVersionName: 'HL-db-handler',
      code: lambda.Code.fromAsset('layers', {
        bundling: {
          image: cdk.DockerImage.fromRegistry('python:3.12-slim'),
          command: [
            'bash', '-c',
            `
              apt-get update &&
              apt-get install -y zip &&
              mkdir -p /asset-output/python &&
              python -m pip install psycopg2-binary -t /asset-output/python/ &&
              cp /asset-input/db_handler.py /asset-output/python/ &&
              cd /asset-output &&
              zip -r db_handler_layer.zip python/
            `
          ],
          user: 'root',
        },
      }),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Layer to handle the PostgreSQL database',
    });

    // Databases
    const dbStack = new DBStack(this, 'AdminDBStack', {env: {region: region}, vpc: vpc, hl_env: this.localenv});

    new EventsStack(this, 'EventStack', 
      {
        api: ags.api, 
        hlBus: hlBus, 
        dlq: DeadLetterQueue_hl, 
        queueProps: queueProps, 
        lambdaRole: lambdaServiceRole, 
        vpc: vpc, 
        dbSecurityGroup: dbStack.dbSecurityGroup,
        secret: dbStack.dbCredentialsSecret,
        hlEnv: this.localenv,
        dbLayer: dbLayer,
        origins: allowedOrigins.origins,
      }
    );

    new cdk.CfnOutput(this, 'URLWEBSITE', {
      value: webStack.websiteBucket.bucketWebsiteUrl,
      exportName: 'URLWEBSITE',
    });
  }
}
