import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as rds from "@aws-cdk/aws-rds";
import { ISecret } from "@aws-cdk/aws-secretsmanager";
import { DEFAULT_PORT_POSTGRES } from '../constants'

interface RDSProxyProps extends cdk.StackProps {
  cluster: rds.DatabaseCluster; 
  subnetA: ec2.PublicSubnet;
  subnetB: ec2.PublicSubnet;
  envName: string;
  env: cdk.Environment;
  secrets: ISecret[]
}

export class CreateRDSProxyStack extends cdk.Stack {
  public readonly proxy: rds.DatabaseProxy
  public readonly proxyReadOnly: rds.CfnDBProxyEndpoint
  
    constructor(scope: cdk.Construct, id: string, props: RDSProxyProps) {
        super(scope, id, props);

        const vpc = ec2.Vpc.fromLookup(this, "Import-Default-VPC", {
            isDefault: true,
        });
      
        this.proxy = new rds.DatabaseProxy(this, `${props?.envName}-RDS-Proxy`, {
          proxyTarget: rds.ProxyTarget.fromCluster(props?.cluster),
          secrets: props?.secrets,
          vpc,
          debugLogging: true,
          securityGroups: props?.cluster.connections.securityGroups,
          vpcSubnets: {
              subnets: [props.subnetA, props.subnetB],
          },
          idleClientTimeout: cdk.Duration.seconds(15)
        });  
        
        /* 
          Read-only Proxy endpoint
          https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.CfnDBProxyEndpoint.html
        */
        this.proxyReadOnly = new rds.CfnDBProxyEndpoint(this, `${props?.envName}-ReadOnly-RDS-Proxy`, {
          dbProxyEndpointName: `${props?.envName}ReadOnlyProxy`,
          dbProxyName: this.proxy.dbProxyName,
          vpcSubnetIds: [props.subnetA.subnetId, props.subnetB.subnetId],
          // the properties below are optional
          
          // tags: [{
          //   key: 'key',
          //   value: 'value',
          // }],
          /* 
            A value that indicates whether the DB proxy endpoint can be used for read/write or read-only operations.
            Valid Values: READ_WRITE | READ_ONLY
          */
          targetRole: 'READ_ONLY',
          vpcSecurityGroupIds: props?.cluster.connections.securityGroups.map(sg => sg.securityGroupId),
        });
    }
}
