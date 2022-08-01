import { logger } from '../../logger';
import { Extractor } from '../../extractor/Extractor';

export const handler = async (event: any, context: any) => {
  const batchId = context.awsRequestId
  logger.defaultMeta = { requestId: batchId };
  const {unzippedFileS3URL: { lambdaOutput }} = event
  logger.info(`Running for request ID: ${batchId} and file provided: ${lambdaOutput}`);
  // init Extractor
  const extractor = new Extractor({
    _fileDirectory: '/tmp'
  })
  try {
    // const dailyFileURL = buildFileUrl()
    logger.info(`Downloading and attempting upload of target file: ${lambdaOutput}`);
    const result = await extractor.downloadFromS3UnzipAndSendToS3(lambdaOutput)
    logger.info(`Successfully uploaded unzipped object: ${result}`);
    return result
  } catch (err) {
    logger.info('Error', err);
    throw err
  }
}