import * as cdk from "@aws-cdk/core";
import * as sqs from '@aws-cdk/aws-sqs';

// expressed in seconds
const DEFAULT_QUEUE_TIMEOUT = 60 * 5

interface QueueStackProps extends cdk.StackProps {
  env?: cdk.Environment;
  queueName: string;
  queueTimeout?: cdk.Duration;
  needsDLQ?: boolean;
}

export class BasicQueueStack extends cdk.Stack {
  public readonly queue: sqs.Queue
  public readonly queueURL: string
  public readonly deadLetterQueue: sqs.Queue

    constructor(scope: cdk.Construct, id: string, props: QueueStackProps) {
        super(scope, id, props);

      const { queueName, queueTimeout, needsDLQ } = props;

      const queueVisibilityTimeout = queueTimeout || cdk.Duration.seconds(DEFAULT_QUEUE_TIMEOUT);
      
      const queueConfig: any = {
        queueName,
        visibilityTimeout: queueVisibilityTimeout,
        // deliveryDelay: cdk.Duration.seconds(15),
        // retentionPeriod: cdk.Duration.seconds((4 * 24 * 60 * 60)) // default value is 345600 seconds (4 days)
      }

      // add in our Dead Letter Queue 
      if (needsDLQ) {
        this.deadLetterQueue = new sqs.Queue(this, `${queueName}DLQ`, {
          queueName: `DeadLetterQueue-${queueName}`
        });

        queueConfig.deadLetterQueue = {
          queue: this.deadLetterQueue,
          maxReceiveCount: 5
        }
      }

      this.queue = new sqs.Queue(this, `${queueName}Queue`, queueConfig);
      this.queueURL = this.queue.queueUrl.toString();
    }
}
