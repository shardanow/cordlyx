import { describe, it, expect } from 'vitest';
import { isHtmlBody, renderBody, markdownToHtml, bodyExcerpt } from './markdown';

describe('markdown body utils', () => {
  it('detects HTML vs legacy markdown', () => {
    expect(isHtmlBody('<p>hi</p>')).toBe(true);
    expect(isHtmlBody('  <div>x</div>')).toBe(true);
    expect(isHtmlBody('## Вопрос')).toBe(false);
    expect(isHtmlBody('- [ ] task')).toBe(false);
    expect(isHtmlBody(null)).toBe(true);
  });

  it('passes HTML through untouched', () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(renderBody(html)).toBe(html);
  });

  it('renders headings, bold and links from markdown', () => {
    const out = renderBody('## Вопрос\nSome **bold** and [doc](https://example.com)');
    expect(out).toContain('<h2>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('href="https://example.com"');
  });

  it('renders - [ ] task lists as disabled checkboxes', () => {
    const out = renderBody('- [ ] open\n- [x] done');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('disabled');
    expect(out).toContain('checked');
  });

  it('converts markdown to HTML in-memory for the editor', () => {
    expect(markdownToHtml('## Hi')).toContain('<h2>');
    expect(markdownToHtml('<p>Hi</p>')).toBe('<p>Hi</p>');
  });

  it('builds excerpts without markup', () => {
    expect(bodyExcerpt('## Вопрос Подтвердить', 200)).not.toContain('##');
    expect(bodyExcerpt('<p>Hello</p>', 200)).toBe('Hello');
    expect(bodyExcerpt('- [ ] task one', 200)).toContain('task one');
  });
});
