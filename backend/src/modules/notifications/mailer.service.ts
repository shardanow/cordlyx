import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export interface DigestItem {
  type: string;
  actorName: string | null;
  itemTitle: string | null;
  itemSequenceNum: number | null;
  projectSlug: string | null;
  createdAt: string;
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  private getTransporter(): Transporter | null {
    if (!this.isConfigured()) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER || process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
    }
    return this.transporter;
  }

  appUrl(): string {
    return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  fromAddress(): string {
    return process.env.SMTP_FROM ?? 'CordLyx <noreply@localhost>';
  }

  buildDigestSubject(items: DigestItem[]): string {
    return items.length === 1 ? '1 unread notification' : `${items.length} unread notifications`;
  }

  buildDigestText(name: string, items: DigestItem[]): string {
    const lines = items.map((i) => {
      const what = i.itemTitle ? `"${i.itemTitle}"` : 'an item';
      const link =
        i.projectSlug && i.itemSequenceNum
          ? `${this.appUrl()}/projects/${i.projectSlug}/items/${i.itemSequenceNum}`
          : null;
      return `- ${i.actorName ?? 'Someone'}: ${i.type} on ${what}${link ? ` (${link})` : ''}`;
    });
    return `Hi ${name},\n\nYou have ${this.buildDigestSubject(items).toLowerCase()}:\n\n${lines.join('\n')}\n\n— CordLyx`;
  }

  buildDigestHtml(name: string, items: DigestItem[]): string {
    const rows = items
      .map((i) => {
        const what = i.itemTitle ? `<strong>${escapeHtml(i.itemTitle)}</strong>` : 'an item';
        const link =
          i.projectSlug && i.itemSequenceNum
            ? ` <a href="${this.appUrl()}/projects/${i.projectSlug}/items/${i.itemSequenceNum}">open</a>`
            : '';
        return `<li>${escapeHtml(i.actorName ?? 'Someone')}: ${escapeHtml(i.type)} on ${what}${link}</li>`;
      })
      .join('');
    return `<p>Hi ${escapeHtml(name)},</p><p>You have <strong>${items.length}</strong> unread notification(s):</p><ul>${rows}</ul><p>— CordLyx</p>`;
  }

  async sendDigest(to: string, name: string, items: DigestItem[]): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter || items.length === 0) return false;
    try {
      await transporter.sendMail({
        from: this.fromAddress(),
        to,
        subject: `[CordLyx] ${this.buildDigestSubject(items)}`,
        text: this.buildDigestText(name, items),
        html: this.buildDigestHtml(name, items),
      });
      return true;
    } catch (err) {
      this.logger.warn(`Digest email to ${to} failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
