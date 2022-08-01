import { logger } from "../logger";
import { Extractor } from "./Extractor";

const buildFileUrl = () => {
  const currentYear = new Date().getFullYear()
  const fileUrl = `https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/${currentYear}_ContributionData.csv.zip`
  return fileUrl
}


(async () => {
  const e = new Extractor({})
  // const tempFilepath = `/var/folders/_r/282gxpc93m384_6mw8yjpyh00000gn/T/20220801152111_2022_ContributionData.csv.zip`
  // const filename = e._extractFileNameFromURL(tempFilepath)
  const url = buildFileUrl()
  // const s3FileName = `20220801195918_20220801195916_20220801183741_2022_ContributionData.csv`

  try {
    // const res = await e.downloadFromS3SanitizeAndSendToS3(s3FileName)
    // const res = await e._sendFileToS3(tempFilepath, filename, 'file-etl-test')
    const res = await e.downloadAndSendToS3(url)
    logger.info(res)
  } catch (error) {
    console.error(error)
  }
})()