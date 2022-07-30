import * as stream from 'stream';

export const promisifyStream = (promiseStream:stream.Stream) => {
  if (!promiseStream) {
    console.error('No read or write stream provided to promisifyStream utility');
    throw new Error('No read or write stream provided to utility');
  }

  // if (!(promiseStream instanceof stream.Readable) && !(promiseStream instanceof stream.Writable)) {
  //   console.error(
  //     'Parameter provided to promisifyStream utility is not a stream, please validate input.',
  //   );
  //   throw new Error('Parameter provided to utility is not a stream.');
  // }

  return new Promise((resolve, reject) => {
    promiseStream.on('end', resolve).on('error', reject);
  });
};