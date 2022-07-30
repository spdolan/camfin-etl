import { range } from '../utils/arrays';
import { CO_EARLIEST_RECORD_YEAR, CURRENT_YEAR, GenericObject, FILE_TYPES, CONTRIBUTION } from '../utils/constants';
import { downloadFile } from '../utils/downloadFile';

const yearRange = range(CO_EARLIEST_RECORD_YEAR, CURRENT_YEAR, 1);

const fileTypeYears = (): GenericObject[] => {
  const result = Object.keys(FILE_TYPES).map(fileType => {
    return yearRange.map(year => {
      return { fileType, year };
    });
  });
  // one-dimensional - ie. [{year, fileType}...]
  const flattenedResult = [...result.flat(Infinity)];
  return flattenedResult;
};

/*
  example of URLs:
    'https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/2004_ExpenditureData.csv.zip';
    'https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/2000_ContributionData.csv.zip';
    'https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/2000_LoanData.csv.zip';
*/
const URL_BASE = 'https://tracer.sos.colorado.gov/PublicSite/Docs/BulkDataDownloads/';

const generateURLs = () => {
  const urlInfo = fileTypeYears();
  const urls = urlInfo.map((value) => {
    const { year, fileType } = value;
    const fileName = `${year}_${fileType}Data.csv.zip`;
    return {
      url: `${URL_BASE}${fileName}`,
      fileType,
      fileName,
    };
  });
  return urls;
};

(() => {
  // generate target file URLs
  const fileURLs = generateURLs();
  // download files
  fileURLs.filter(info => info.fileType === CONTRIBUTION).forEach(({ url, fileType, fileName }) => {
    downloadFile(url, `${FILE_TYPES[fileType]}/${fileName}`, (message) => {
      console.log(`finished downloading: ${url} - message: ${message}`);
    });
  });
})();