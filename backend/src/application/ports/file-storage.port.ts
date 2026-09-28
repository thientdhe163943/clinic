export interface UploadFileInput {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  folder?: string;
}

export interface UploadedFile {
  key: string;
  url: string;
}

export interface FileStoragePort {
  upload(input: UploadFileInput): Promise<UploadedFile>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
