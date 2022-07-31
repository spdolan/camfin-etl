import * as path from 'path'
import * as cdk from "@aws-cdk/core";
import * as sfn from '@aws-cdk/aws-stepfunctions'
import * as tasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as logs from '@aws-cdk/aws-logs'
import { NodejsLambdaStack } from '../lambda/nodejs-function-stack'
import { CreateS3Bucket } from "../s3buckets/create-s3-bucket";
import { BasicQueueStack } from "../sqs/queue-stack";

interface FileETLStackProps extends cdk.StackProps{
  environmentName: string;
}

export class FileETLStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine

  constructor(scope: cdk.Construct, id: string, props: FileETLStackProps) {
    super(scope, id, props);

    const environmentName = props.environmentName

    // file storage - S3
    const s3BucketStack = new CreateS3Bucket(
      this,
      `FileETLBucket-${environmentName}`,
      {
          envName: environmentName,
          bucketName: `file-etl-${environmentName.toLowerCase()}`,
      }
    );
    const { bucket: fileETLS3Bucket } = s3BucketStack
    
    // Final data queue - SQS
    const camfinDataSanitized = `Camfin-Data-Santized`
    const sanitizedDataQueueStack = new BasicQueueStack(this, `${camfinDataSanitized}-${environmentName}`, {
      queueName: `${camfinDataSanitized}-${environmentName}`,
      needsDLQ: true
    });

    const { queue: sanitizedDataQueue, deadLetterQueue: sanitizedDataDLQ } = sanitizedDataQueueStack

    // Lambda functions
    // Download File Lambda
    const downloadFileETLFunctionName = `downloadFileETL-${environmentName}`
    const downloadFileETLLambdaStack = new NodejsLambdaStack(this, `downloadFileETLLambdaStack-${environmentName}`, {
      functionName: `${downloadFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../../src/lambda-fns/downloadFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        environment: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketWebsiteUrl),
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
      functionEntry: path.join(__dirname, `/../../../src/lambda-fns/unzipFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        environment: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketWebsiteUrl),
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
      functionEntry: path.join(__dirname, `/../../../src/lambda-fns/sanitizeFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        environment: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketWebsiteUrl),
        }
      }
    })
    const { lambda: sanitizeFileETLLambda } = sanitizeFileETLLambdaStack
    // Lambda stack dependencies
    sanitizeFileETLLambdaStack.addDependency(s3BucketStack)

    // Parse File Lambda
    const dlqUrl = sanitizedDataDLQ ? sanitizedDataDLQ.queueUrl.toString() : ''
    const parseSanitizedFileETLFunctionName = `parseSanitizedFileETL-${environmentName}`
    const parseSanitizedFileETLLambdaStack = new NodejsLambdaStack(this, `parseSanitizedFileETLLambdaStack-${environmentName}`, {
      functionName: `${parseSanitizedFileETLFunctionName}`,
      functionEntry: path.join(__dirname, `/../../../src/lambda-fns/parseSanitizedFile/index.ts`),
      functionProps: {
        timeout: cdk.Duration.seconds(45),
        environment: {
          ['process.env.S3_BUCKET_URL']: JSON.stringify(fileETLS3Bucket.bucketWebsiteUrl),
          ['process.env.QUEUE_URL']: JSON.stringify(sanitizedDataQueue.queueUrl.toString()),
          ['process.env.DLQ_URL']: JSON.stringify(dlqUrl),
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
    if(sanitizedDataDLQ){
      sanitizedDataDLQ.grantSendMessages(parseSanitizedFileETLLambda)
    }

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
    const dailyFileIsNotPresentChoice = new sfn.Choice(this, `FileIsNotPresent-${environmentName}`, {
      comment: 'checks output for daily S3 URL value.',
    })
    const dailyFileIsNotPresentCondition = sfn.Condition.isNotPresent(`$.dailyFileS3URL`)
    // Unzipped file present Choice and Condition
    const unzippedFileIsNotPresentChoice = new sfn.Choice(this, `UnzippedFileNotPresent-${environmentName}`, {
      comment: 'checks output for unzipped S3 URL value.',
    })
    const unzippedFileIsNotPresentCondition = sfn.Condition.isNotPresent(`$.unzippedFileS3URL`)
    // Sanitized file present Choice and Condition
    const sanitizedFileIsNotPresentChoice = new sfn.Choice(this, `SanitizedFileNotPresent-${environmentName}`, {
      comment: 'checks output for sanitized S3 URL value.',
    })
    const sanitizedFileIsNotPresentCondition = sfn.Condition.isNotPresent(`$.sanitizedFileS3URL`)
    
    
    const fileETLStepFunctionDefinition =
      // Download target file - Lambda
      runDownloadFileETLLambda
        .next(
          dailyFileIsNotPresentChoice
          // file not present - finish
          .when(
            dailyFileIsNotPresentCondition,
            // No file - finish
            dailyFileNotPresentSucceeded
          )
          .otherwise(
            // Unzip target file - Lambda
            runUnzipFileETLLambda
            .next(
              unzippedFileIsNotPresentChoice
              // file present - move forward
              .when(
                unzippedFileIsNotPresentCondition,
                // No file - finish with a failure
                unzippedFileNotPresentFailure
              )
              // Sanitize unzipped file - Lambda
              .otherwise(
                runSanitizeFileETLLambda
                .next(
                  sanitizedFileIsNotPresentChoice
                  // file present - move forward
                  .when(
                    sanitizedFileIsNotPresentCondition,
                    // No file - failed
                    sanitizedFileNotPresentFailure
                  )
                  // Parse sanitized file to Queue - Fargate?/Lambda
                  .otherwise(
                    runParseSanitizedFileETLLambda.next(
                      succeeded
                    )
                  )
                )
              )
            ) 
          )
        )
        
    
    // State Machine definition
    const logGroup = new logs.LogGroup(this, `StartFileETL-LogGroup-${environmentName}`);
    this.stateMachine = new sfn.StateMachine(this, `StateMachine-${environmentName}`, {
      stateMachineName: `CamFinFileETL-${environmentName}`,
      definition: fileETLStepFunctionDefinition,
      timeout: cdk.Duration.minutes(90),
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL
      }
    });

    // TODO: Insert data to target DB - Lambda
  }
}
