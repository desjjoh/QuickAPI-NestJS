export interface PutStorageObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface DeleteStorageObjectInput {
  key: string;
}

export interface StorageObjectModel {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
}

export abstract class StorageService {
  public abstract putObject(
    input: PutStorageObjectInput,
  ): Promise<StorageObjectModel>;

  public abstract deleteObject(input: DeleteStorageObjectInput): Promise<void>;

  public abstract objectExists(key: string): Promise<boolean>;
}
