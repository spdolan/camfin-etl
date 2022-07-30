import * as fs from 'fs';
import { ParseOne } from 'unzipper';
import { promisifyStream } from './promisifyStream';


export const unzipFirstFileInArchive = async (inputFile: fs.PathLike, targetFile: fs.PathLike) => {
  try {
    const fileContents = fs.createReadStream(inputFile);
    const unzip = ParseOne();
    const writeStream = fs.createWriteStream(targetFile);
    const writeStreamPromise = promisifyStream(writeStream);

    fileContents.pipe(unzip).pipe(writeStream);
    await writeStreamPromise;
  } catch (error: any) {
    throw new Error(error.message);
  }
};
