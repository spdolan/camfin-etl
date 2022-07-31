import * as path from 'path'
import * as cdk from "@aws-cdk/core";
import * as sfn from '@aws-cdk/aws-stepfunctions'
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as logs from '@aws-cdk/aws-logs'
import * as events from '@aws-cdk/aws-events'
import * as targets from '@aws-cdk/aws-events-targets'
import { NodejsLambdaStack } from '../lambda/nodejs-function-stack'
import { CreateS3Bucket } from "../s3buckets/create-s3-bucket";
import { BasicQueueStack } from "../sqs/queue-stack";

interface FileETLStackProps extends cdk.StackProps{
  environmentName: string;
  env: cdk.Environment;
}

export class FileETLStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: FileETLStackProps) {
    super(scope, id, props);

    const environmentName = props.environmentName
    const env = props.env

    // file storage - S3
    const s3BucketStack = new CreateS3Bucket(
      this,
      `FileETLBucket-${environmentName}`,
      {
          envName: environmentName,
          env,
          bucketName: `file-etl-${environmentName}`,
      }
    );
    const { bucket: fileETLS3Bucket } = s3BucketStack
    
    // Final data queue - SQS
    const camfinDataSanitized = `Camfin-Data-Santized`
    const sanitizedDataQueueStack = new BasicQueueStack(this, `${camfinDataSanitized}-${environmentName}`, {
      env,
      queueName: `${camfinDataSanitized}-${environmentName}`,
      needsDLQ: true
    });

    const { queue: sanitizedDataQueue, deadLetterQueue: sanitizedDataDLQ } = sanitizedDataQueueStack

    // Lambda functions
    // Download File Lambda
    const downloadFileETLFunctionName = `downloadFileETL-${environmentName}`
    const downloadFileETLLambdaStack = new NodejsLambdaStack(this, `downloadFileETLLambdaStack-${environmentName}`, {
      functionName: `${downloadFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../lambda-fns/downloadFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        define: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketURL),
        }
      }
    })
    // Lambda stack dependencies
    downloadFileETLLambdaStack.addDependency(s3BucketStack)
    const { lambda: downloadFileETLLambda } = downloadFileETLLambdaStack

    // Unzip File Lambda
    const unzipFileETLFunctionName = `unzipFileETL-${environmentName}`
    const unzipFileETLLambdaStack = new NodejsLambdaStack(this, `unzipFileETLLambdaStack-${environmentName}`, {
      functionName: `${unzipFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../lambda-fns/unzipFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        define: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketURL),
        }
      }
    })
    // Lambda stack dependencies
    unzipFileETLLambdaStack.addDependency(s3BucketStack)
    const { lambda: unzipFileETLLambda } = unzipFileETLLambdaStack

    // Sanitize File Lambda
    const sanitizeFileETLFunctionName = `sanitizeFileETL-${environmentName}`
    const sanitizeFileETLLambdaStack = new NodejsLambdaStack(this, `sanitizeFileETLLambdaStack-${environmentName}`, {
      functionName: `${sanitizeFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../lambda-fns/sanitizeFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        define: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketURL),
        }
      }
    })
    const { lambda: sanitizeFileETLLambda } = sanitizeFileETLLambdaStack
    // Lambda stack dependencies
    sanitizeFileETLLambdaStack.addDependency(s3BucketStack)

    // Parse File Lambda
    const parseSanitizedFileETLFunctionName = `parseSanitizedFileETL-${environmentName}`
    const parseSanitizedFileETLLambdaStack = new NodejsLambdaStack(this, `parseSanitizedFileETLLambdaStack-${environmentName}`, {
      functionName: `${parseSanitizedFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../lambda-fns/parseSanitizedFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        define: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketURL),
          ['process.env.QUEUE_URL']: JSON.stringify(sanitizedDataQueue.queueUrl.toString()),
          ['process.env.DLQ_URL']: JSON.stringify(sanitizedDataDLQ.queueUrl.toString()),
        }
      }
    })
    // Lambda stack dependencies
    parseSanitizedFileETLLambdaStack.addDependency(s3BucketStack)
    parseSanitizedFileETLLambdaStack.addDependency(sanitizedDataQueueStack)

    const { lambda: parseSanitizedFileETLLambda } = parseSanitizedFileETLLambdaStack

    // S3 Permissions
    fileETLS3Bucket.grantReadWrite(downloadFileETLLambda)
    fileETLS3Bucket.grantReadWrite(unzipFileETLLambda)
    fileETLS3Bucket.grantReadWrite(sanitizeFileETLLambda)
    fileETLS3Bucket.grantRead(parseSanitizedFileETLLambda)

    // Queue Permissions
    sanitizedDataQueue.grantSendMessages(parseSanitizedFileETLLambda)
    sanitizedDataDLQ.grantSendMessages(parseSanitizedFileETLLambda)

    // Step Function
    
    // Tasks
    // Run Download File Lambda
    const runDownloadFileETLLambda = new tasks.LambdaInvoke(this, `RunTaskDownloadTargetFileLambda-${environmentName}`, {
      lambdaFunction: downloadFileETLLambda,
      resultPath: '$.Payload'
    })
    // .addRetry({maxAttempts: MAX_RETRY_ATTEMPTS, backoffRate: RETRY_BACKOFF_RATE})
    
    // Run Unzip File Lambda
    const runUnzipFileETLLambda = new tasks.LambdaInvoke(this, `RunTaskUnzipTargetFileLambda-${environmentName}`, {
      lambdaFunction: unzipFileETLLambda,
      resultPath: '$.Payload'
    })
    // Run Sanitize File Lambda
    const runSanitizeFileETLLambda = new tasks.LambdaInvoke(this, `RunTaskSanitizeTargetFileLambda-${environmentName}`, {
      lambdaFunction: sanitizeFileETLLambda,
      resultPath: '$.Payload'
    })
    // Run Parse File Lambda
    const runParseSanitizedFileETLLambda = new tasks.LambdaInvoke(this, `RunTaskParseSanitizedTargetFileLambda-${environmentName}`, {
      lambdaFunction: parseSanitizedFileETLLambda,
      resultPath: '$.Payload'
    })

    // end states
    const succeeded = new sfn.Succeed(this, 'Success');
    const dailyFileNotPresentSucceeded = new sfn.Succeed(this, 'DailyFileNotPresentSuccess');
    const unzippedFileNotPresentFailure = new sfn.Fail(this, 'UnzippedFileNotPresentFailure');
    const sanitizedFileNotPresentFailure = new sfn.Fail(this, 'SanitizedFileNotPresentFailure');
    
    // Daily file present Choice and Condition
    const dailyFileIsPresentChoice = new sfn.Choice(this, `FilePresent-${environmentName}`, {
      comment: 'checks output for daily S3 URL value.',
    })
    const dailyFileIsPresentCondition = sfn.Condition.isPresent(`$.dailyFileS3URL`)
    // Unzipped file present Choice and Condition
    const unzippedFileIsPresentChoice = new sfn.Choice(this, `UnzippedFilePresent-${environmentName}`, {
      comment: 'checks output for unzipped S3 URL value.',
    })
    const unzippedFileIsPresentCondition = sfn.Condition.isPresent(`$.unzippedFileS3URL`)
    // Sanitized file present Choice and Condition
    const sanitizedFileIsPresentChoice = new sfn.Choice(this, `SanitizedFilePresent-${environmentName}`, {
      comment: 'checks output for sanitized S3 URL value.',
    })
    const sanitizedFileIsPresentCondition = sfn.Condition.isPresent(`$.sanitizedFileS3URL`)
    
    
    const fileETLStepFunctionDefinition =
      // Download target file - Lambda
      runDownloadFileETLLambda
        .next(
          dailyFileIsPresentChoice
            // file present - move forward
            .when(
              dailyFileIsPresentCondition,
              // Unzip target file - Lambda
              runUnzipFileETLLambda
            )
            // No file - finish
            .otherwise(dailyFileNotPresentSucceeded)
        )
        // Sanitize unzipped file - Lambda
        .next(
          unzippedFileIsPresentChoice
            // file present - move forward
            .when(
              unzippedFileIsPresentCondition,
              // Unzip target file - Lambda
              runSanitizeFileETLLambda
            )
            // No file - finish with a failure
            .otherwise(unzippedFileNotPresentFailure)
            )
        // Parse sanitized file to Queue - Fargate?/Lambda
        .next(
          sanitizedFileIsPresentChoice
            // file present - move forward
            .when(
              sanitizedFileIsPresentCondition,
              // Parse target file - Fargate/Lambda
              runParseSanitizedFileETLLambda
            )
            // No file - failed
            .otherwise(sanitizedFileNotPresentFailure)
        )
        .next(
          succeeded
      )
    
    // State Machine definition
    const logGroup = new logs.LogGroup(this, `StartFileETL-LogGroup-${environmentName}`);
    const fileETLStateMachine = new sfn.StateMachine(this, `StateMachine-${environmentName}`, {
      stateMachineName: `CamFinFileETL-${environmentName}`,
      definition: fileETLStepFunctionDefinition,
      timeout: cdk.Duration.minutes(90),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL
      }
    });

    /*
      Lambda - kick off File ETL Step Functions CRON Daily
    */
      const startFileETLFunctionName = `StartFileETL-${environmentName}`
      const startFileETLLambdaStack = new NodejsLambdaStack(this, `StartFileETLLambdaStack-${environmentName}`, {
        functionName: `${startFileETLFunctionName}`,
        functionEntry: path.join(__dirname, `/../../lambda-fns/startETL/index.ts`),
        functionProps: {
          timeout: cdk.Duration.seconds(45),
          define: {
            ['process.env.STATE_MACHINE_ARN']: JSON.stringify(fileETLStateMachine.stateMachineArn),
          }
        }
      })
      const { lambda: startFileETLLambda } = startFileETLLambdaStack
    
    // grant Step Function execution to Lambda
    fileETLStateMachine.grantStartExecution(startFileETLLambda);
    
    /* 
      CRON event
    */
    const eventRule = new events.Rule(this, `US-MT-9AM-ScheduleRule-${environmentName}`, {
      // generate event every day at 9AM US MT (UTC-7), CRON is created in UTC
      schedule: events.Schedule.cron({ minute: '0', hour: '15' }),
    });

    eventRule.addTarget(new targets.LambdaFunction(startFileETLLambda))

    // TODO: Insert data to target DB - Lambda
  }
}
