import { logger } from '../../logger';
import { SFNClient, StartExecutionCommand} from '@aws-sdk/client-sfn'
const { v4: uuidv4 } = require('uuid');

// init params, for reuse outside of Lambda execution
const { STATE_MACHINE_ARN } = process.env
const sfnClient = new SFNClient({});

const buildFileUrl = () => {
  const currentYear = new Date().getFullYear()
  const fileUrl = `https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/${currentYear}_ContributionData.csv.zip`
  return fileUrl
}

export const handler = async (event: any, context: any) => {
  const batchId = context.awsRequestId
  logger.defaultMeta = { requestId: batchId };
  logger.debug(`event: ${event}`)

  const uuid = uuidv4();
  
  // logic for createing Daily URL here
  const dailyFileURL = buildFileUrl()
  // Kick off our ETL Step Function.
  try {
    const params = {
      input: JSON.stringify({dailyFileURL}),
      name: `${uuid}`,
      stateMachineArn: STATE_MACHINE_ARN,
      traceHeader: undefined,
    };

    const command = new StartExecutionCommand(params);
    return sfnClient.send(command);
  } catch (err) {
    logger.error('Error', err);
    return err
  }
  
}
