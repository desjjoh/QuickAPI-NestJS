import { Request } from 'express';
import multer, { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const rootPath = join(process.cwd(), 'upload');

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
