import * as cdk from "@aws-cdk/core";
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';


interface SecretFromNameStackProps extends cdk.StackProps {
  env?: cdk.Environment;
  secretName: string;
}

export class SecretFromNameStack extends cdk.Stack {
  public readonly secret: secretsmanager.ISecret

  constructor(scope: cdk.Construct, id: string, props: SecretFromNameStackProps) {
    super(scope, id, props);

    const { secretName } = props;

    this.secret = secretsmanager.Secret.fromSecretNameV2(this, `SecretFromName-${secretName}`, secretName);
  }
}
