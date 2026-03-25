import * as cdk from 'aws-cdk-lib';
import {
  Peer,
  Port,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import {
  AuroraPostgresEngineVersion,
  ClusterInstance,
  Credentials,
  DatabaseCluster,
  DatabaseClusterEngine,
} from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { environment } from '../helpers/environments';

interface DBStackProps extends cdk.StackProps {
  vpc: Vpc;
  hl_env: environment;
}

export class DBStack extends Construct {
  public readonly dbSecurityGroup: SecurityGroup;
  public readonly dbCredentialsSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: DBStackProps) {
    super(scope, id);

    // Secret con credenciales de la base de datos
    this.dbCredentialsSecret = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      secretName: 'hl-DBCredentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'hladmin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // Security Group para Aurora PostgreSQL
    this.dbSecurityGroup = new SecurityGroup(this, 'DBSecurityGroup', {
      securityGroupName: 'HLDBSecurityGroupAurora',
      vpc: props.vpc,
      description: 'Permitir acceso a Aurora PostgreSQL desde Lambda o EC2',
      allowAllOutbound: true,
    });

    // Aurora PostgreSQL Serverless v2
    const auroraCluster = new DatabaseCluster(this, 'HL-Aurora-PG', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_17_6,
      }),
      writer: ClusterInstance.serverlessV2('writer', {
        publiclyAccessible: true,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      credentials: Credentials.fromSecret(this.dbCredentialsSecret),
      clusterIdentifier: 'hl-aurora-pg',
      defaultDatabaseName: 'HLDB',
      securityGroups: [this.dbSecurityGroup],
      backup: {
        retention: cdk.Duration.days(1),
      },
      deletionProtection: false,
    });

    // Regla de acceso público para entorno DEV
    if (props.hl_env === environment.DEV) {
      this.dbSecurityGroup.addIngressRule(
        Peer.anyIpv4(),
        Port.tcp(5432),
        'Allow public access to Aurora PostgreSQL'
      );
    }

    // Outputs
    new cdk.CfnOutput(this, 'DBClusterEndpoint', {
      value: auroraCluster.clusterEndpoint.hostname,
      exportName: 'AuroraClusterEndpoint',
    });

    new cdk.CfnOutput(this, 'DBReaderEndpoint', {
      value: auroraCluster.clusterReadEndpoint.hostname,
      exportName: 'AuroraReaderEndpoint',
    });
  }
}