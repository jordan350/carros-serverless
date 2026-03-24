#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HL_CDK } from '../lib/hl-main-stack';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Environment } from 'aws-cdk-lib/aws-appconfig';

const app = new cdk.App();
const stack = new HL_CDK(app, 'HL-CDK', {env: {
    region: 'us-east-1', 
  }});

// // Apply the policy to resources with the prefix 'cdk'
// const resources = stack.node.findAll().filter(resource => resource.node.id.startsWith('cdk') && resource instanceof Role);

// const arnArray: string[] = resources.map(item => `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${item.node.id}`);

// const passRolePolicy = new PolicyStatement({
//   actions: ['iam:PassRole'],
//   resources: arnArray,
// });

// // Iterar sobre los roles y agregar la política a cada uno
// resources.forEach(role => {
//   (role as Role).addToPolicy(passRolePolicy);
// });