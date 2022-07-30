import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import { RemovalPolicy } from "@aws-cdk/core";
import { Secret } from "@aws-cdk/aws-secretsmanager";
import {DEFAULT_PORT_POSTGRES} from '../constants'

interface AuroraClusterStackProps extends cdk.StackProps {
    subnetA: ec2.PublicSubnet;
    subnetB: ec2.PublicSubnet;
    envName: string;
    instanceClass?: ec2.InstanceClass,
    instanceSize?: ec2.InstanceSize,
    dbName: string;
}

export class CreateAuroraClusterStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster
  constructor(scope: cdk.Construct, id: string, props: AuroraClusterStackProps) {
      super(scope, id, props);

      const engine = rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_12_8, // postgres version 12.8
      });

      const size = props?.instanceSize || ec2.InstanceSize.SMALL;
      const instanceClass = props?.instanceClass || ec2.InstanceClass.BURSTABLE2;
      // db instance properties
      const instanceType = ec2.InstanceType.of(instanceClass, size);

      const vpc = ec2.Vpc.fromLookup(this, "Import-Default-VPC", {
          isDefault: true,
      });
      // security group to allow proxy to query AuroraDB
      const securityGroups = new ec2.SecurityGroup(
          this,
          `${props?.envName}-${props?.dbName}/RDS-Proxy Security Group`,
          {
              vpc,
          }
      );

      securityGroups.addIngressRule(
          securityGroups,
          ec2.Port.tcp(DEFAULT_PORT_POSTGRES),
          "Allow Postgresql Connections"
      );

      // cluster properties
      const clusterIdentifier = `${props?.envName}-${props?.dbName}`;
      const secrets = new Secret(this, `${props?.envName}-${props?.dbName}-DBSecret`, {
          secretName: `${props?.envName}-${props?.dbName}-credentials`,
          generateSecretString: {
              secretStringTemplate: JSON.stringify({
                  username: `${props?.envName}DBAdmin`,
              }),
              excludePunctuation: true,
              includeSpace: false,
              generateStringKey: "password",
          },
      });
    const credentials = rds.Credentials.fromSecret(secrets);
    // this aligns with existing AWS RDS instances
      const defaultDatabaseName = 'clouddb';
      const parameterGroup = new rds.ParameterGroup(
          this,
          `${props?.envName}-${props?.dbName}-ClusterParameterGroup`,
          {
              engine: engine,
              parameters: {
                ["pgaudit.log"]:
                    "ddl,function,misc,read,role,write,none,all,-ddl,-function,-misc,-read,-role,-write",
                ["pgaudit.log_catalog"]: "1",
                ["pgaudit.log_level"]: "log",
                ["pgaudit.log_parameter"]: "1",
                ["pgaudit.log_relation"]: "1",
                ["pgaudit.log_statement_once"]: "1",
                ["pgaudit.role"]: "rds_pgaudit", // this role needs to be created directly in DB via psql or pgadmin
                ["rds.force_ssl"]: "1",
                ["shared_preload_libraries"]: "pg_stat_statements,pgaudit",
              },
          }
      );
      const removalPolicy = RemovalPolicy.DESTROY;
      const storageEncrypted = true;

      this.cluster = new rds.DatabaseCluster(
          this,
          `${props?.envName}-${props?.dbName}`,
          {
              engine,
              instanceProps: {
                instanceType,
                securityGroups: [securityGroups],
                vpc,
                vpcSubnets: {
                  subnets: [props.subnetA, props.subnetB],
                },
                publiclyAccessible: true,
                enablePerformanceInsights: true,
              },
              clusterIdentifier,
              credentials,
              defaultDatabaseName,
              parameterGroup,
              removalPolicy,
              storageEncrypted,
          }
      );

      this.cluster.connections.allowDefaultPortFromAnyIpv4();
    }
}
