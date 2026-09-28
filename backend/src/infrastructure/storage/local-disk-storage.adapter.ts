import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Injectable } from '@nestjs/common';
import { StoragePort, UploadFileInput } from '../../application/ports/storage.port';

// Dev-only fallback used when no S3 bucket/credentials are configured (see
// app.module.ts's STORAGE_PORT factory) — saves under ./uploads and relies
// on main.ts's useStaticAssets to serve it back. Not suitable for a real
// deployment: files vanish on every redeploy/container restart and aren't
// shared across multiple instances behind a load balancer.
@Injectable()
export class LocalDiskStorageAdapter implements StoragePort {
  async upload(input: UploadFileInput): Promise<{ url: string }> {
    const dir = join(process.cwd(), 'uploads', input.folder);
    await mkdir(dir, { recursive: true });

    const filename = `${randomUUID()}${extname(input.originalName).toLowerCase()}`;
    await writeFile(join(dir, filename), input.buffer);

    return { url: `/uploads/${input.folder}/${filename}` };
  }

  async read(url: string): Promise<Buffer> {
    return readFile(join(process.cwd(), url));
  }
}
