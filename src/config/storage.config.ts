import { Request } from 'express';
import multer, { diskStorage } from 'multer';
import { extname, isAbsolute, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { env } from './environment.config';

const rootPath = isAbsolute(env.UPLOAD_TMP_DIR)
  ? env.UPLOAD_TMP_DIR
  : join(process.cwd(), env.UPLOAD_TMP_DIR);

const storage: multer.StorageEngine = diskStorage({
  destination: rootPath,
  filename: (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, filename: string) => void,
  ) => {
    callback(null, generateFilename(file));
  },
});

function generateFilename(file: Express.Multer.File) {
  return `${uuidv4()}${extname(file.originalname)}`;
}

export { storage };
