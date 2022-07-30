import { SQSClient, SendMessageBatchCommand, SendMessageCommand } from '@aws-sdk/client-sqs';
import {v4 as uuidv4} from 'uuid'
import { logger } from './logger'
import {slicesGenerator} from './arrayHelpers'

const DEFAULT_AWS_REGION = 'us-east-1'
/* 
  SQS Docs: https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessageBatch.html
*/
const AWS_SQS_BATCH_MAX = 10
const region = process.env.AWS_REGION || DEFAULT_AWS_REGION 
logger.info(`setup SQS client for AWS REGION: ${region}`)
export const client = new SQSClient({ region });

export const publishSingleMessage = async (messageParameters: {QueueUrl: string, MessageBody: string}) => {
  logger.silly(
      `Sending message with the following parameters: ${JSON.stringify(messageParameters)}`,
  );
  const command = new SendMessageCommand(messageParameters)
  try {
    const data = await client.send(command);
    logger.debug(`Success publishing SQS message: ${data.MessageId}`);
  } catch (error) {
    const mqErrorText = `Error publishing SQS message: ${error}`
    logger.error(mqErrorText);
    throw new Error(mqErrorText)
  }
};

const publishBatchMessages = async (queueUrl: string, messages: { MessageBody: string }[]) => {
  logger.silly(
    `Publishing batch messages, ${messages.length} to be sent.`,
  );

  const batchedMessages = [...slicesGenerator(messages,AWS_SQS_BATCH_MAX)]
  logger.debug('batchedMessages', batchedMessages)
  try {
    await Promise.all(batchedMessages.map(messageBatch => {
      const batchMessageParameters = {
        QueueUrl: queueUrl,
        Entries: messageBatch
      }

      logger.debug(batchMessageParameters)
      const command = new SendMessageBatchCommand(batchMessageParameters)
      return client.send(command);
    }));
    logger.debug(`Success publishing batch SQS messages`);
  } catch (error) {
    const mqErrorText = `Error publishing SQS message: ${error}`
    logger.error(mqErrorText);
    throw new Error(mqErrorText)
  }
};

const publishMultipleMessages = async (queueUrl:string, messages: any[]) => {
    logger.info(`Received ${messages.length} messages to publish.`);
    // TODO: logic handler for < 10 messages received

    // creates smaller batches of 100 messages to pass into each instance
    const batchSizeOf100 = (AWS_SQS_BATCH_MAX * AWS_SQS_BATCH_MAX)
    const batchedMessages = [...slicesGenerator(messages,batchSizeOf100)]
    try {
      await Promise.all(batchedMessages.map(messages => {
        return publishBatchMessages(queueUrl, messages)
      }))
      logger.info(`Finished publishing ${messages.length} messages.`);
    } catch (error) {
      logger.error(`Received error within publishMultipleMessages: ${error}`)
    }
};

export const publishMessages = async (queueUrl:string, event: any) => {
    if (typeof queueUrl !== 'string') {
        throw new Error('There was an error publishing a message: queueUrl is required.');
    }

    if (!event) {
        throw new Error('There was an error publishing a message: no event(s) present.');
    }

    const messages = [];
    // handle a single event
    if (Object.prototype.toString.call(event) === '[object Object]') {
        messages.push({
            MessageBody: JSON.stringify({
              ...event,
            }),
          // required for SQS batching
            Id: uuidv4(),
          });
        }
        // handle array of events
        if (Array.isArray(event)) {
          event.forEach((eventMessage) => {
            messages.push({
              // The message value is just bytes to Kafka, so we need to serialize our JavaScript
              // object to a JSON string. Other serialization methods like Avro are available.
              MessageBody: JSON.stringify({
                ...eventMessage,
              }),
              // required for SQS batching
              Id: uuidv4(),
            });
        });
    }
    try {      
      await publishMultipleMessages(queueUrl, messages);
    } catch (error) {
      logger.error(error)
      throw new Error(`${error}`)
    }
};
