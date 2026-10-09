import {
  CallHandler,
  ExecutionContext,
  Injectable,
  mixin,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { catchError, concatMap, finalize, from, type Observable } from 'rxjs';
import { storage } from '@/config/storage.config';
import { cleanupRequestUpload } from '@/common/helpers/upload-cleanup.helper';

/** Owns the file from multipart parsing until the request handler finishes. */
export function ImageFileInterceptor(fieldName: string, maxBytes: number) {
  const MultipartInterceptor = FileInterceptor(fieldName, {
    storage,
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 10,
      fieldSize: 256 * 1024,
      parts: 11,
    },
  });

  @Injectable()
  class UploadInterceptor extends MultipartInterceptor {
    public async intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Promise<Observable<unknown>> {
      const request = context.switchToHttp().getRequest<Request>();
      let stream: Observable<unknown>;
      try {
        stream = await super.intercept(context, next);
      } catch (error) {
        await cleanupRequestUpload(request).catch(() => undefined);
        throw error;
      }
      return stream.pipe(
        concatMap(async (value) => {
          await cleanupRequestUpload(request);
          return value;
        }),
        catchError((error: unknown) =>
          from(
            (async () => {
              await cleanupRequestUpload(request).catch(() => undefined);
              throw error;
            })(),
          ),
        ),
        finalize(() => {
          void cleanupRequestUpload(request).catch(() => undefined);
        }),
      );
    }
  }

  return mixin(UploadInterceptor);
}
