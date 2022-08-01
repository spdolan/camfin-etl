import { logger } from '../../logger';
import { Extractor } from '../../extractor/Extractor';

export const handler = async (event: any, context: any) => {
  const batchId = context.awsRequestId
  logger.defaultMeta = { requestId: batchId };
  const {dailyFileURL} = event
  logger.info(`Running for request ID: ${batchId} and file provided: ${dailyFileURL}`);
  // init Extractor
  const extractor = new Extractor({
    _fileDirectory: '/tmp'
  })
  try {
    logger.info(`Downloading and attempting upload of target file: ${dailyFileURL}`);
    const result = await extractor.downloadAndSendToS3(dailyFileURL)
    logger.info(`Successfully uploaded object: ${result}`);
    return result
  } catch (err) {
    logger.info('Error', err);
    throw err
  }
}
