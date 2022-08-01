import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios'
import { ParseOne } from 'unzipper';
import { logger } from '../logger';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Transform } from 'stream';

export class Extractor {

  private _s3Client!: S3Client
  private _tempDirectory!: string;
  private _s3BucketName: string = 'file-etl-test'

  constructor(options: any){
    const {
      _fileDirectory = null, 
      _client = null
    } = options
    // init client
    this._setS3Client(_client)
    // init temp directory target
    this._setTempDirectory(_fileDirectory)
  }

  // init s3 client
  _setS3Client = (_client = null) => {
    this._s3Client = _client || new S3Client({});
  }
  
  _getS3Client = () => {
    return this._s3Client
  }

  // init s3 bucket name
  _setS3BucketName = (_bucketName: string) => {
    this._s3BucketName = _bucketName
  }
  
  _getS3BucketName = () => {
    return this._s3BucketName
  }
  
  // init temp dir variable
  _setTempDirectory = (fileDirectory = null) => {
    this._tempDirectory = fileDirectory || os.tmpdir()
  }
  
  _getTempDirectory = (): string => {
    return this._tempDirectory
  }

  _getTimestamp = () => {
    const today = new Date();
    const isoTimestamp = today.toISOString()
    const calendarDate = isoTimestamp.split('T')[0].split('-').join('')
    const formattedSeconds = isoTimestamp.split('T')[1].split('.')[0].split(':').join('')
    return `${calendarDate}${formattedSeconds}`
  }

  _extractFileNameFromURL = (url: string) => {
    const urlSplitCharacter = '/'
    const splitURL = url.split(urlSplitCharacter)
    return splitURL[splitURL.length - 1]
  }

  _buildTempFileDestination = (filename: string, filePrefix = null) => {
    logger.debug(`Extractor._buildTempFileDestination prefix: ${filePrefix}`)
    const timestamp = this._getTimestamp()
    const prefix = timestamp
    const prefixedFilename = `${prefix}_${filename}`
    return path.join(this._getTempDirectory(), prefixedFilename)
  }

  _fileStreamPromise = (filestream: fs.WriteStream) => {
    return new Promise((resolve, reject) => {
      filestream
        .on('finish', () => {
          const finishLog = `Extractor._fileStreamPromise complete!`
          logger.info(finishLog)
          filestream.close();
          resolve(finishLog)
        })
        .on('error', (error) => {
          logger.error(`ERROR within Extractor._fileStreamPromise: ${error}`)
          reject(error)
        });
    });
  }

  _writeStreamToFile = async (inputStream: { pipe: (arg0: fs.WriteStream) => void; }, targetFilepath: fs.PathLike) => {
    const writeFileStream = fs.createWriteStream(targetFilepath)
    const writeFileStreamPromise = this._fileStreamPromise(writeFileStream);
    inputStream.pipe(writeFileStream)
    await writeFileStreamPromise
  }

  // download file from interwebs
  _downloadTargetFile = async (
    url: string
  ) => {
    const downloadFilename = this._extractFileNameFromURL(url)
    const writeFileDestination = this._buildTempFileDestination(downloadFilename)
    
    logger.info(`Extractor._downloadTargetFile, download filename: ${downloadFilename} and destination: ${writeFileDestination}`)
    const result = {
      targetFilepath: writeFileDestination
    }

    try {
      axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        timeout: 60000 // in ms
      }).then(async (response) => {
        await this._writeStreamToFile(response.data, writeFileDestination)
        response.data.on('end', () => {
          logger.debug('streaming complete!')
        })
        response.data.on('error', (error: any) => {
          logger.error(error)
        })
      })

      const streamResult = {
        ...result,
        success: true
      }
      return streamResult
    } catch (error) {
      logger.error(`Extractor._downloadTargetFile ERROR ${error}`)
      // await fs.unlink(writeFileDestination, () => {
      //   logger.error(error)
      // })
      return {
        ...result,
        success: false
      }
    }
  };

  _getFileFromS3 = (s3Key:string, s3BucketName:string): Promise<string> => {
    const bucketParams = {
      Bucket: s3BucketName,
      Key: s3Key,
      ResponseContentType: 'stream'
    };
    logger.debug(`Extractor._getFileFromS3 bucket params: ${bucketParams}`)
    
    const tempFilepath = this._buildTempFileDestination(s3Key)
    logger.debug(`Extractor._getFileFromS3 temp file: ${tempFilepath}`)
    
    return new Promise((resolve, reject) => {
      const command = new GetObjectCommand(bucketParams)
      this._s3Client.send(command, async (err, data) => {
        // process err and data.
        if(err){
          reject(err)
        }
        
        await this._writeStreamToFile(data?.Body, tempFilepath)
        resolve(tempFilepath)
      })
    })
  }

  _sendFileToS3 = (filepath: fs.PathOrFileDescriptor, s3Key:string, s3BucketName:string) => {
    const bucketParams = {
      Bucket: s3BucketName,
      Key: s3Key
    };
    logger.debug(`Extractor._sendFileToS3 bucket params: ${bucketParams}`)
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, async (error, data) => {
        if(error){
          logger.error(`Error within Extractor._sendFileToS3.readFile`)
          reject(error)
        }
        
        const paramsWithBody = {
          ...bucketParams,
          Body: data
        }

        const command = new PutObjectCommand(paramsWithBody)
        this._s3Client.send(command, (err, data) => {
          // process err and data.
          if(err){
            reject(err)
          }

          resolve(data)
        })
      })
    })
  }

  _unzipFile = async (zipFilepath: string, targetFilepath = null) => {
    logger.info(`Extractor._unzipFile targeting: ${zipFilepath}`)
    const zipFilename = this._extractFileNameFromURL(zipFilepath)
    const extractedFilename = zipFilename.split('.zip')[0]
    const extractedFilepath = targetFilepath || this._buildTempFileDestination(extractedFilename)
    logger.info(`Extractor._unzipFile starting unzip for: ${extractedFilepath}`)
    try {
      const fileContents = fs.createReadStream(zipFilepath);
      const unzip = ParseOne();
      await this._writeStreamToFile(fileContents.pipe(unzip), extractedFilepath)
      logger.info(`Extractor._unzipFile successfully unzipped: ${extractedFilepath}`)
      return {
        unzippedFilepath: extractedFilepath,
        success: true
      }
    } catch (error) {
      logger.error(`Extractor._unzipFile error received: ${error}`)
      return {
        unzippedFilepath: extractedFilepath,
        success: false,
        error
      }
    }
  }

  _santizeStream = new Transform({
    transform: (chunk, encoding, callback) => {

      const replaceInternalQuotes = (str:string) => str.replaceAll(/"([^"]+(?="))"/g, '$1').replaceAll(/((?<!")\n)/g, ' ');
      // delimiter - carriage return
      const carriageReturnLineSplit = '\r\n';
      // delimiter - rows
      const commaDelimiter = ',';
      // checking if chunk is a string
      // @ts-ignore
      const parsedRow = encoding === 'buffer' ? chunk.toString('utf-8') : chunk;
      // logger.debug('parsed row start -------------------\n');
      // logger.debug(parsedRow);
      // logger.debug('parsed row end -------------------\n');
      const parsedReplaceNonQuotedNewline = parsedRow.replaceAll(/((?<!")\r\n)/g, ' ');
      // logger.debug('neg lookbehind parsed row start -------------------\n');
      // logger.debug(parsedReplaceNonQuotedNewline);
      // logger.debug('neg lookbehind parsed row end -------------------\n');
      const splitIntoRows = parsedReplaceNonQuotedNewline.split(carriageReturnLineSplit);
      const splitRowIntoFields = splitIntoRows.map((splitRow:string) => {
        // logger.debug('split row start -------------------\n');
        // logger.debug(splitRow);
        // logger.debug('split row end -------------------\n');
        const fields = splitRow.split(',');
        const sanitizedFields = fields.map(replaceInternalQuotes);
        return sanitizedFields.join(commaDelimiter);
      });
      const sanitized = splitRowIntoFields.join(carriageReturnLineSplit);
      // return sanitized to downstream
      callback(null, sanitized);
    },
  });
  
  _sanitizeFile = async (uncleanFilepath: string, targetFilepath = null) => {
    logger.info(`Extractor._sanitizeFile targeting: ${uncleanFilepath}`)
    const uncleanFilename = this._extractFileNameFromURL(uncleanFilepath)
    const cleanFilename = `CLEAN_${uncleanFilename}`
    const extractedFilepath = targetFilepath || this._buildTempFileDestination(cleanFilename)
    logger.info(`Extractor._sanitizeFile starting cleanup for: ${extractedFilepath}`)
    try {
      const fileContents = fs.createReadStream(uncleanFilepath);
      await this._writeStreamToFile(fileContents.pipe(this._santizeStream), extractedFilepath)
      logger.info(`Extractor._sanitizeFile successfully cleaned: ${extractedFilepath}`)
      return {
        sanitizedFilepath: extractedFilepath,
        success: true
      }
    } catch (error) {
      logger.error(`Extractor._sanitizeFile error received: ${error}`)
      return {
        sanitizedFilepath: extractedFilepath,
        success: false,
        error
      }
    }
  }

  // download file from target, to S3 target
  downloadAndSendToS3 = async (url: string) => {
    try {
      const {targetFilepath, success} = await this._downloadTargetFile(url)
      logger.info(targetFilepath, success)
      const s3Key = this._extractFileNameFromURL(targetFilepath)
      logger.info(s3Key)

      // fs.readdirSync(this._getTempDirectory()).forEach(file => {
      //   logger.info(`temp dir file: ${file}`);
      // });
      if(success){
        logger.info(`Extractor._downloadTargetFile succeeded for file ${s3Key}, proceeding with upload.`)
        const result = await this._sendFileToS3(targetFilepath, s3Key ,this._s3BucketName)
        logger.info(`Extractor._sendFileToS3 result: ${result}`)
        return s3Key
      } else {
        logger.info(`Extractor.downloadAndSendToS3 failed to download file.`)
        return null
      }
    } catch (error) {
      logger.error(`Error within Extractor.downloadAndSendToS3: ${error}`)
      throw error
    }
  }
  
  // download file from S3, Unzip, and send back to S3 target
  downloadFromS3UnzipAndSendToS3 = async (s3Key: string) => {
    logger.debug(`Extractor.downloadFromS3UnzipAndSendToS3 received s3Key: ${s3Key}`)
    try {
      const tempFilepath = await this._getFileFromS3(s3Key, this._getS3BucketName())
      logger.info(`Extractor.downloadFromS3UnzipAndSendToS3 created tempFilepath: ${tempFilepath}`)
      
      const {unzippedFilepath, success} = await this._unzipFile(tempFilepath)

      if(success && unzippedFilepath){
        const targetS3Key = `UNZIPPED_${this._extractFileNameFromURL(unzippedFilepath)}`
        logger.info(`Extractor._unzipFile succeeded for file ${targetS3Key}, proceeding with upload.`)
        const result = await this._sendFileToS3(unzippedFilepath, targetS3Key ,this._s3BucketName)
        logger.info(`Extractor._sendFileToS3 result: ${result}`)
        return targetS3Key
      } else {
        logger.info(`Extractor.downloadFromS3UnzipAndSendToS3 failed to download file.`)
        return null
      }
    } catch (error) {
      logger.error(`Error within Extractor.downloadFromS3UnzipAndSendToS3: ${error}`)
      throw error
    }
  }
  
  // download file from S3, Sanitize, and send back to S3 target
  downloadFromS3SanitizeAndSendToS3 = async (s3Key: string) => {
    logger.debug(`Extractor.downloadFromS3SanitizeAndSendToS3 received s3Key: ${s3Key}`)
    try {
      const tempFilepath = await this._getFileFromS3(s3Key, this._getS3BucketName())
      logger.info(`Extractor.downloadFromS3SanitizeAndSendToS3 created tempFilepath: ${tempFilepath}`)
      
      const {sanitizedFilepath, success} = await this._sanitizeFile(tempFilepath)

      if(success && sanitizedFilepath){
        const targetS3Key = `${this._extractFileNameFromURL(sanitizedFilepath)}`
        logger.info(`Extractor._sanitizeFile succeeded for file ${targetS3Key}, proceeding with upload.`)
        const result = await this._sendFileToS3(sanitizedFilepath, targetS3Key ,this._s3BucketName)
        logger.info(`Extractor._sendFileToS3 result: ${result}`)
        return targetS3Key
      } else {
        logger.info(`Extractor.downloadFromS3SanitizeAndSendToS3 failed to download file.`)
        return null
      }
    } catch (error) {
      logger.error(`Error within Extractor.downloadFromS3SanitizeAndSendToS3: ${error}`)
      throw error
    }
  }
}