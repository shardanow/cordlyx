import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface UploadOptions {
  filename?: string;
  mimeType: string;
}

export interface UploadResult {
  path: string;
  filename: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private basePath = process.env.STORAGE_LOCAL_PATH ?? './data/uploads';

  async upload(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
    const ext = options.filename?.split('.').pop() ?? 'bin';
    const filename = `${randomUUID()}.${ext}`;
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const storagePath = join(datePath, filename);
    const fullPath = join(this.basePath, storagePath);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    return {
      path: storagePath,
      filename,
      url: `/uploads/${storagePath}`,
    };
  }

  async delete(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') {
        this.logger.warn(`Failed to delete file ${fullPath}: ${err.message}`);
      }
    });
  }

  getUrl(path: string): string {
    return `/uploads/${path}`;
  }
}
