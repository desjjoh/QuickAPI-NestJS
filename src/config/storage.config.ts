import { Request } from 'express';
import multer, { diskStorage } from 'multer';
import { extname, isAbsolute, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from './environment.config';
import { trackUpload } from '@/common/helpers/upload-tracking.helper';

export const uploadTempRoot = isAbsolute(env.UPLOAD_TMP_DIR)
  ? env.UPLOAD_TMP_DIR
  : join(process.cwd(), env.UPLOAD_TMP_DIR);

const storage: multer.StorageEngine = diskStorage({
  destination: uploadTempRoot,
  filename: (
    req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    const filename = generateFilename(file);
    trackUpload(req, join(uploadTempRoot, filename));
    callback(null, filename);
  },
});

function generateFilename(file: Express.Multer.File) {
  const extension = extname(file.originalname).toLowerCase();
  return `quickapi-upload-${uuidv4()}${/^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''}`;
}

export { storage };
