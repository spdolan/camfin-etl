import * as cdk from "@aws-cdk/core";
import * as lambda from '@aws-cdk/aws-lambda-nodejs'

interface NodejsLambdaStackProps extends cdk.StackProps {
  env?: cdk.Environment;
  functionName: string;
  functionEntry: string;
  functionProps: {[x:string]: any};
}

export class NodejsLambdaStack extends cdk.Stack {
  public readonly lambda: lambda.NodejsFunction

    constructor(scope: cdk.Construct, id: string, props: NodejsLambdaStackProps) {
        super(scope, id, props);

      const { functionName, functionEntry, functionProps: {timeout, memorySize, vpc, define} } = props;
      this.lambda = new lambda.NodejsFunction(this, `${functionName}Lambda`, {
        entry: functionEntry, // accepts .js, .jsx, .ts and .tsx files
        // handler: 'handler', // defaults to 'handler'
        functionName,
        bundling: {
          // minify: true, // minify code, defaults to false
          sourceMap: true,
          define, // Replace strings during build time
        },
        timeout,
        memorySize, // default is 128 MB
        vpc
      });
    }
}
