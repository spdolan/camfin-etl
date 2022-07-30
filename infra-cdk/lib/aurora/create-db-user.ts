import * as cdk from "@aws-cdk/core";
import * as rds from "@aws-cdk/aws-rds";
import { ISecret } from "@aws-cdk/aws-secretsmanager";

interface CreateAuroraUserProps extends cdk.StackProps {
  clusterIdentifier: string
  username: string,
  env: cdk.Environment
}

export class CreateAuroraUserStack extends cdk.Stack {

  public readonly secret: ISecret; 

  constructor(scope: cdk.Construct, id: string, props: CreateAuroraUserProps) {
  
    super(scope, id, props);

      const targetDBCluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(this, `targetDBCluster`, {
        clusterIdentifier: props.clusterIdentifier
      })
      const dbUserSecret = new rds.DatabaseSecret(this, `dbUserSecret-${props.username}`, {
        username: props.username,
        secretName: `${props.clusterIdentifier}/${props.username}`, // optional, defaults to a CloudFormation-generated name
        // masterSecret: targetDBCluster,
        // excludeCharacters: '{}[]()\'"/\\', // defaults to the set " %+~`#$&*()|[]{}:;<>?!'/@\"\\"
      });
    
      this.secret = dbUserSecret.attach(targetDBCluster); // Adds DB connections information in the secret
      
  } 
}