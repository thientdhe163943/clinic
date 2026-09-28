export const STORAGE_PORT = Symbol('STORAGE_PORT');

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  // Logical folder within the bucket/disk, e.g. "avatars".
  folder: string;
}

export interface StoragePort {
  upload(input: UploadFileInput): Promise<{ url: string }>;
  /** Reads back a file previously returned by upload()'s `url` — each adapter
   *  knows how to resolve its own URL shape (local relative path vs S3/
   *  CloudFront absolute URL). Throws if the file can't be read. */
  read(url: string): Promise<Buffer>;
}
