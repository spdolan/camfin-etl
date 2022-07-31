import * as path from 'path'
import * as cdk from "@aws-cdk/core";
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'
import { FileETLStack } from './create-file-etl-stack'
import { NodejsLambdaStack } from '../lambda/nodejs-function-stack'

interface StartFileETLStackProps extends cdk.StackProps{
  environmentName: string;
}

export class StartFileETLStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: StartFileETLStackProps) {
    super(scope, id, props);
    const {environmentName} = props
    const fileEtlStack = new FileETLStack(this, `${environmentName}-FileETLStack`, {
      environmentName,
      // env: defaultEnv
    })

    const {stateMachine: etlStateMachine} = fileEtlStack

    /*
      Lambda - kick off File ETL Step Functions CRON Daily
    */
    const startFileETLFunctionName = `StartFileETL-${environmentName}`
    const startFileETLLambdaStack = new NodejsLambdaStack(this, `StartFileETLLambdaStack-${environmentName}`, {
      functionName: `${startFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../../src/lambda-fns/startETL/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        environment: {
          ['process.env.STATE_MACHINE_ARN']: JSON.stringify(etlStateMachine.stateMachineArn),
        }
      }
    })
    const { lambda: startFileETLLambda } = startFileETLLambdaStack
    startFileETLLambdaStack.addDependency(fileEtlStack)
    // grant Step Function execution to Lambda
    etlStateMachine.grantStartExecution(startFileETLLambda);

    /* 
      CRON event
    */
    const eventRule = new events.Rule(this, `US-MT-9AM-ScheduleRule-${environmentName}`, {
      // generate event every day at 9AM US MT (UTC-7), CRON is created in UTC
      schedule: events.Schedule.cron({ minute: '0', hour: '15' }),
    });
    eventRule.addTarget(new targets.LambdaFunction(startFileETLLambda))
  }
}