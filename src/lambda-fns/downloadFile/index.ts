import { logger } from '../../logger';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// init params, for reuse outside of Lambda execution
const { S3_BUCKET_URL } = process.env
const s3Client = new S3Client();

export const handler = async (event: any, context: any) => {
  const batchId = context.awsRequestId
  logger.defaultMeta = { requestId: batchId };

  const { env, name: batchUuid, dailyFileURL } = event;
  logger.info(`Environment: ${env}, Batch ID: ${batchUuid}, target file: ${dailyFileURL}`);

  
  // logic for handling Daily URL here
  // Upload our locations to S3.
  try {
    const bucketParams = {
      Bucket: S3_BUCKET_URL,
      Key: `downloads/${dailyFileURL}`,
      Body: dailyFileURL,
    };

    const s3Result = await s3Client.send(new PutObjectCommand(bucketParams));
    logger.info(`Successfully uploaded object: ${bucketParams.Bucket}/${bucketParams.Key}`);
  } catch (err) {
    logger.info('Error', err);
  }
  
  const dailyFileS3URL = `${S3_BUCKET_URL}/downloads/${dailyFileURL}`
  return dailyFileS3URL
}
