import * as fs from 'fs';
// import { EOL } from 'os';
// import * as path from 'path';
import { Transform } from 'stream';
import * as csv from 'fast-csv';
import { promisifyStream } from './promisifyStream';

export const appendToTargetFile = async (sourceFilePath: fs.PathLike, targetFilePath: fs.PathLike, includeHeaders = false) => {

  const readStream = fs.createReadStream(sourceFilePath);

  const writeStream = fs.createWriteStream(targetFilePath, {
    flags: 'a', // append to file
  });
  const writeStreamPromise = promisifyStream(writeStream);

  readStream
    .pipe(csv.parse({ headers: includeHeaders }))
    .pipe(csv.format({ headers: includeHeaders }))
    .pipe(writeStream);

  await writeStreamPromise;
};

// const replacer = (match: any, p1: any, offset: any, string: any) => {
//   // p1 is non-digits, p2 digits, and p3 non-alphanumerics
//   console.log('match: ', match);
//   console.log('p1: ', p1);
//   console.log('offset: ', offset);
//   console.log('string: ', string);
//   return match;
// };

// const replaceNonQuotedNewline = (str:string) => str.replace(/((?!")\n)/g, ' ');
const replaceInternalQuotes = (str:string) => str.replaceAll(/"([^"]+(?="))"/g, '$1').replaceAll(/((?<!")\n)/g, ' ');
// delimiter - carriage return
// const carriageReturn = '\r';
const carriageReturnLineSplit = '\r\n';
// delimiter - rows
const commaDelimiter = ',';

export const sanitizeTargetFile = async (sourceFilePath: fs.PathLike, targetFilePath: fs.PathLike) => {
  const readStream = fs.createReadStream(sourceFilePath);
  const santizeStream = new Transform({
    transform: (chunk, encoding, callback) => {
      // checking if chunk is a string
      const parsedRow = encoding === 'buffer' ? chunk.toString('utf-8') : chunk;
      // console.log('parsed row start -------------------\n');
      // console.log(parsedRow);
      // console.log('parsed row end -------------------\n');
      const parsedReplaceNonQuotedNewline = parsedRow.replaceAll(/((?<!")\r\n)/g, ' ');
      // console.log('neg lookbehind parsed row start -------------------\n');
      // console.log(parsedReplaceNonQuotedNewline);
      // console.log('neg lookbehind parsed row end -------------------\n');
      const splitIntoRows = parsedReplaceNonQuotedNewline.split(carriageReturnLineSplit);
      const splitRowIntoFields = splitIntoRows.map((splitRow:string) => {
        // console.log('split row start -------------------\n');
        // console.log(splitRow);
        // console.log('split row end -------------------\n');
        const fields = splitRow.split(',');
        const sanitizedFields = fields.map(replaceInternalQuotes);
        return sanitizedFields.join(commaDelimiter);
      });
      const sanitized = splitRowIntoFields.join(carriageReturnLineSplit);
      // return sanitized to downstream
      callback(null, sanitized);
    },
  });

  const writeStream = fs.createWriteStream(targetFilePath);
  const writeStreamPromise = promisifyStream(writeStream);

  readStream
    .pipe(santizeStream)
    .pipe(writeStream);

  await writeStreamPromise;
};