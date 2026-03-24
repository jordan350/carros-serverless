import * as cdk from 'aws-cdk-lib';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class webSiteStack extends Construct {
  public readonly websiteBucket: Bucket; 
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const webSiteBucket = new Bucket(this, 'hlwebbucket', {
      bucketName: 'hl-websitebucket',
      websiteIndexDocument: 'index.html', // Entry point for the React app
      websiteErrorDocument: 'index.html', // Handle routing by pointing all errors to index.html
      publicReadAccess: true, // Make the bucket publicly accessible
      blockPublicAccess: new BlockPublicAccess({ // Allow bucket-level public access
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically clean up the bucket on stack deletion
      autoDeleteObjects: true, // Delete all objects in the bucket when the stack is deleted
    });

    webSiteBucket.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      principals: [new AnyPrincipal()],
      actions: ['s3:GetObject'],
      resources: [`${webSiteBucket.bucketArn}/*`],
    }));

    // Deploy the React app's build folder to the S3 bucket
    new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset('./carros-serverless/dist/carros-serverless/browser')],
      destinationBucket: webSiteBucket,
    });
    
    this.websiteBucket = webSiteBucket;
  }
}