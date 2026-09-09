'use client';

import MarkdownIt from 'markdown-it';

type MdInstance = InstanceType<typeof MarkdownIt>;

let md: MdInstance | null = null;

function getMd(): MdInstance {
  if (!md) {
    md = new MarkdownIt({
      html: false,
      linkify: true,
      breaks: true,
    });
  }
  return md;
}

/** Heuristic: stored HTML (from Tiptap) vs legacy markdown. HTML always starts with '<' after trim. */
export function isHtmlBody(body: string | null | undefined): boolean {
  if (!body) return true;
  return body.trimStart().startsWith('<');
}

/**
 * Unified body renderer for item descriptions and comments.
 * - HTML passthrough (Tiptap output).
 * - Markdown (incl. - [ ] task lists, headings) via markdown-it.
 * No DB writes here — pure read path, safe for 100+ legacy rows.
 */
export function renderBody(body: string | null | undefined): string {
  if (!body) return '';
  if (isHtmlBody(body)) return body;
  const html = getMd().render(body);
  // markdown-it renders - [ ] as plain text; upgrade to disabled checkboxes.
  return html
    .replace(/<li>\[ \]/g, '<li class="md-task"><input type="checkbox" disabled />')
    .replace(/<li>\[x\]/gi, '<li class="md-task md-task-checked"><input type="checkbox" checked disabled />');
}

/** Convert legacy markdown to HTML in-memory for loading into Tiptap. Persisted only on Save. */
export function markdownToHtml(body: string | null | undefined): string {
  if (!body || isHtmlBody(body)) return body ?? '';
  return renderBody(body);
}

/** Plain-text excerpt for list rows (strips both HTML and markdown syntax). */
export function bodyExcerpt(body: string | null | undefined, max = 80): string {
  if (!body) return '';
  const text = isHtmlBody(body)
    ? body.replace(/<[^>]+>/g, '')
    : body
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^[-*]\s+\[.\]\s+/gm, '')
        .replace(/^[-*]\s+/gm, '')
        .replace(/^>\s?/gm, '');
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.substring(0, max)}...` : flat;
}
