import * as cdk from "@aws-cdk/core";
import { PublicSubnet, Vpc } from "@aws-cdk/aws-ec2";
import { CreateAuroraSubnetStack } from "./create-aurora-subnet";

interface SubnetsStackProps extends cdk.StackProps {
  env: cdk.Environment,
}

export class SubnetsStack extends cdk.Stack {
  public readonly subnetA: PublicSubnet;
  public readonly subnetB: PublicSubnet;

  constructor(scope: cdk.App, id: string, props?: SubnetsStackProps) {
    super(scope, id, props);

    const auroraSubnetA = new CreateAuroraSubnetStack(scope, "AuroraSubnetA", {
      env: props?.env,
      cidrBlock: "",
      availabilityZone: "us-east-1a",
    });

    const auroraSubnetB = new CreateAuroraSubnetStack(scope, "AuroraSubnetB", {
      env: props?.env,
      cidrBlock: "",
      availabilityZone: "us-east-1b",
    });

    this.subnetA = auroraSubnetA.subnet
    this.subnetB = auroraSubnetB.subnet
  }
}
