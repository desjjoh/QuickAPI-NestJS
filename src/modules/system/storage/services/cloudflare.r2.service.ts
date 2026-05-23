import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

import { env } from '@/config/environment.config';

import {
  DeleteStorageObjectInput,
  PutStorageObjectInput,
  StorageObjectModel,
  StorageService,
} from '../types/storage.types';

@Injectable()
export class CloudflareStorageService extends StorageService {
  private readonly client: S3Client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  public async putObject(
    input: PutStorageObjectInput,
  ): Promise<StorageObjectModel> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
      }),
    );

    return {
      key: input.key,
      url: this.buildPublicUrl(input.key),
      contentType: input.contentType,
      sizeBytes: this.getBodySize(input.body),
    };
  }

  public async deleteObject(input: DeleteStorageObjectInput): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: input.key,
      }),
    );
  }

  public async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: key,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  private buildPublicUrl(key: string): string {
    const baseUrl = env.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
    const normalizedKey = key.replace(/^\/+/, '');

    return `${baseUrl}/${normalizedKey}`;
  }

  private getBodySize(body: Buffer | Uint8Array | string): number {
    if (typeof body === 'string') return Buffer.byteLength(body);

    return body.byteLength;
  }
}
