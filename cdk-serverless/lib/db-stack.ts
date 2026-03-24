import * as cdk from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { environment } from '../helpers/environments';

interface DBStackProps extends cdk.StackProps {
  vpc: Vpc,
  hl_env: environment,
}

export class DBStack extends Construct {
  public readonly dbSecurityGroup: SecurityGroup;
  public readonly dbCredentialsSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DBStackProps) {
    super(scope, id);

    // database credentials
    this.dbCredentialsSecret = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      secretName: 'hl-DBCredentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'hladmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });
    
    // Security group to clúster RDS
    this.dbSecurityGroup = new SecurityGroup(this, 'DBSecurityGroup', {
      securityGroupName: 'HLDBSecurityGroup',
      vpc: props.vpc,
      description: 'Permitir acceso a la base de datos desde Lambda o EC2',
      allowAllOutbound: true
    });

    const rdsInstance = new DatabaseInstance(this, 'HL-RDS-DB', {
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_17 // max POSTGRESQL version compatible
      }),
      instanceType: InstanceType.of(InstanceClass.BURSTABLE4_GRAVITON, InstanceSize.MICRO),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      credentials: Credentials.fromSecret(this.dbCredentialsSecret),
      instanceIdentifier: 'HL-database',
      securityGroups: [this.dbSecurityGroup],
      publiclyAccessible: true,
      allocatedStorage: 20,
      multiAz: false,
      backupRetention: cdk.Duration.days(1),
      databaseName: 'HLDB',
    });

    if (props.hl_env == environment.DEV){
      this.dbSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(5432), 'Allow public access to the DB');
    }

    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: rdsInstance.instanceEndpoint.hostname,
      exportName: 'RdsDBEndpoint',
    });
  }
}