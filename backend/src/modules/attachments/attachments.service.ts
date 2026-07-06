import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../database/client.js';
import { attachments } from '../../database/schema/attachments.js';
import { items } from '../../database/schema/items.js';
import { comments } from '../../database/schema/comments.js';
import { users } from '../../database/schema/users.js';
import { eq, and, isNull } from 'drizzle-orm';
import { StorageService } from '../../storage/storage.service.js';

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/zip', 'application/gzip',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/tab-separated-values',
];

const MAX_SIZE = 10 * 1024 * 1024;

@Injectable()
export class AttachmentsService {
  constructor(private readonly storage: StorageService) {}

  async getByItem(itemId: string) {
    const db = getDb();
    const rows = await db
      .select({
        id: attachments.id,
        itemId: attachments.itemId,
        commentId: attachments.commentId,
        uploaderId: attachments.uploaderId,
        filename: attachments.filename,
        originalFilename: attachments.originalFilename,
        mimeType: attachments.mimeType,
        sizeBytes: attachments.sizeBytes,
        storagePath: attachments.storagePath,
        storageProvider: attachments.storageProvider,
        createdAt: attachments.createdAt,
        deletedAt: attachments.deletedAt,
        uploader: {
          id: users.id,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(attachments)
      .leftJoin(users, eq(attachments.uploaderId, users.id))
      .where(and(eq(attachments.itemId, itemId), isNull(attachments.deletedAt)))
      .orderBy(attachments.createdAt);
    return rows.map((row) => ({ ...row, url: this.storage.getUrl(row.storagePath) }));
  }

  async upload(
    itemId: string,
    uploaderId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    commentId?: string,
  ) {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const db = getDb();
    const id = randomUUID();

    const { path, filename } = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      mimeType: file.mimetype,
    });

    await db.insert(attachments).values({
      id,
      itemId,
      commentId: commentId ?? null,
      uploaderId,
      filename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: path,
    });

    return db.select().from(attachments).where(eq(attachments.id, id)).limit(1).then((r) => {
      const row = r[0];
      if (!row) return row;
      return { ...row, url: this.storage.getUrl(row.storagePath) };
    });
  }

  async delete(attachmentId: string, itemId: string) {
    const db = getDb();
    const att = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.itemId, itemId)))
      .limit(1);
    if (!att[0]) throw new NotFoundException('Attachment not found');

    // Replace <img> references in description and comments before deleting the file
    const escapedPath = att[0].storagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgRegex = new RegExp(`<img[^>]*?src=["'][^"']*${escapedPath}["'][^>]*/?>`, 'gi');
    const replacement = '<span class="attachment-deleted italic text-muted-foreground">[deleted image]</span>';

    const [item] = await db
      .select({ description: items.description })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (item?.description) {
      const newDesc = item.description.replace(imgRegex, replacement);
      if (newDesc !== item.description) {
        await db
          .update(items)
          .set({ description: newDesc, updatedAt: new Date() })
          .where(eq(items.id, itemId));
      }
    }

    const itemComments = await db
      .select({ id: comments.id, body: comments.body })
      .from(comments)
      .where(eq(comments.itemId, itemId));

    for (const comment of itemComments) {
      const newBody = comment.body.replace(imgRegex, replacement);
      if (newBody !== comment.body) {
        await db
          .update(comments)
          .set({ body: newBody, updatedAt: new Date() })
          .where(eq(comments.id, comment.id));
      }
    }

    await this.storage.delete(att[0].storagePath);
    await db
      .update(attachments)
      .set({ deletedAt: new Date() })
      .where(eq(attachments.id, attachmentId));

    return { success: true };
  }
}
