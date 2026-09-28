import { randomUUID } from 'crypto';
import { extname } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StoragePort, UploadFileInput } from '../../application/ports/storage.port';

// Real S3 implementation, used whenever S3_BUCKET is configured (see
// app.module.ts's STORAGE_PORT factory, which falls back to
// LocalDiskStorageAdapter otherwise). Deliberately does NOT pass an
// explicit `credentials` block — the AWS SDK's default credential
// provider chain resolves them instead (env vars → shared config/SSO →
// EC2 instance profile / ECS task role). On EC2 this means attaching an
// IAM Role to the instance is enough; no static access key ever needs to
// live in .env. AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY still work as a
// fallback (picked up automatically by the same chain) for local dev
// environments that aren't running on AWS infrastructure.
@Injectable()
export class S3StorageAdapter implements StoragePort {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET ?? '';
    const region = process.env.AWS_REGION ?? 'ap-southeast-1';
    this.client = new S3Client({ region });
    // Prefer serving through CloudFront when configured (custom domain,
    // caching, no public-bucket exposure); fall back to the plain S3 object
    // URL otherwise.
    this.publicBaseUrl = process.env.CLOUDFRONT_URL
      ? process.env.CLOUDFRONT_URL.replace(/\/$/, '')
      : `https://${this.bucket}.s3.${region}.amazonaws.com`;
  }

  async upload(input: UploadFileInput): Promise<{ url: string }> {
    const key = `${input.folder}/${randomUUID()}${extname(input.originalName).toLowerCase()}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
        }),
      );
    } catch (error) {
      this.logger.error(`S3 upload failed key=${key}: ${error instanceof Error ? error.message : error}`);
      throw error;
    }

    return { url: `${this.publicBaseUrl}/${key}` };
  }

  async read(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
