import * as cdk from "@aws-cdk/core";
import { PublicSubnet, Vpc, RouterType } from "@aws-cdk/aws-ec2";
import {SUBNET_GATEWAY_AURORA} from '../constants'

interface Stack2Props extends cdk.StackProps {
  cidrBlock: string;
  availabilityZone: string;
  // envName: string;
}

export class CreateAuroraSubnetStack extends cdk.Stack {
    public readonly subnet: PublicSubnet;

    constructor(scope: cdk.Construct, id: string, props: Stack2Props) {
      super(scope, id, props);

      const defVpc = Vpc.fromLookup(this, "Import-Default-VPC", {
          isDefault: true,
      });

      this.subnet = new PublicSubnet(
          this,
          `Dev-Aurora-Subnet`,
          {
              availabilityZone: props.availabilityZone,
              cidrBlock: props.cidrBlock,
              vpcId: defVpc.vpcId,
              mapPublicIpOnLaunch: true,
          }
      );

      this.subnet.addRoute("Internet-Route", {
          routerId: SUBNET_GATEWAY_AURORA,
          routerType: RouterType.GATEWAY,
          destinationCidrBlock: "0.0.0.0/0",
        });
    }
}
