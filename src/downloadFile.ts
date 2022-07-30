import * as fs from 'fs';
import * as https from 'https';
import { URL } from 'url';

export const downloadFile = (
  url: string | https.RequestOptions | URL,
  dest: fs.PathLike,
  cb: ((err?: NodeJS.ErrnoException | null | undefined) => void) | undefined,
) => {

  const file = fs.createWriteStream(dest);
  https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb); // close() is async, call cb after close completes.
    });
  }).on('error', function(err) { // Handle errors
    // Delete the file async. (But we don't check the result)
    // console.error('ERROR encountered when downloading file: ', err.message);
    fs.unlink(dest, () => {
      if (cb) cb(err);
    });
  });
};
