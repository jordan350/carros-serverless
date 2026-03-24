import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

interface apiGatewayStackProps extends cdk.StackProps {
  hlBus: events.EventBus
  }

export class apiGatewayStack extends Construct {
  public readonly api: apigateway.LambdaRestApi;
  

  constructor(scope: Construct, id: string, props: apiGatewayStackProps) {
    super(scope, id);

  // API Gateway to expose the Lambda function
  this.api = new apigateway.RestApi(this, 'hlApi', {
    restApiName: 'HL-ApiService',
  });
  }
}