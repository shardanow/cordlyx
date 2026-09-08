import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  dedupeKey,
  parseCsv,
  detectImportFormat,
  mapImportHeaders,
  parseImportBuffer,
  bulkRequestSchema,
} from './items-import.service.js';

describe('normalizeName', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeName('  Fix   LOGIN  ')).toBe('fix login');
    expect(normalizeName(null)).toBe('');
  });
});

describe('dedupeKey', () => {
  it('is case- and whitespace-insensitive', () => {
    expect(dedupeKey('Fix login', 'Bug')).toBe(dedupeKey('  fix   LOGIN ', 'bug'));
  });

  it('differs by title or type', () => {
    expect(dedupeKey('A', 'Bug')).not.toBe(dedupeKey('B', 'Bug'));
    expect(dedupeKey('A', 'Bug')).not.toBe(dedupeKey('A', 'Task'));
  });
});

describe('parseCsv', () => {
  it('parses simple rows', () => {
    const rows = parseCsv('Title,Type\nFix login,Bug\nAdd docs,Task');
    expect(rows).toEqual([
      { Title: 'Fix login', Type: 'Bug' },
      { Title: 'Add docs', Type: 'Task' },
    ]);
  });

  it('handles quoted commas, escaped quotes and multiline fields', () => {
    const rows = parseCsv('Title,Description\n"Fix, login","He said ""hi"""\n"Multi\nline",Plain');
    expect(rows).toEqual([
      { Title: 'Fix, login', Description: 'He said "hi"' },
      { Title: 'Multi\nline', Description: 'Plain' },
    ]);
  });

  it('skips empty lines and strips BOM', () => {
    const rows = parseCsv('\uFEFFTitle\n\nA\n\n');
    expect(rows).toEqual([{ Title: 'A' }]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\n\n')).toEqual([]);
  });
});

describe('detectImportFormat', () => {
  it('prefers file extension', () => {
    expect(detectImportFormat('a.csv', '[]')).toBe('csv');
    expect(detectImportFormat('a.json', 'Title,Type')).toBe('json');
    expect(detectImportFormat('a.jsonl', '{}')).toBe('jsonl');
    expect(detectImportFormat('a.ndjson', '{}')).toBe('jsonl');
  });

  it('sniffs content without extension', () => {
    expect(detectImportFormat('file', '[{"title":"x"}]')).toBe('json');
    expect(detectImportFormat('file', '{"title":"a"}\n{"title":"b"}')).toBe('jsonl');
    expect(detectImportFormat('file', 'Title,Type\nA,Bug')).toBe('csv');
  });
});

describe('mapImportHeaders', () => {
  it('maps export CSV headers to import fields and drops technical columns', () => {
    expect(
      mapImportHeaders({
        ID: 'uuid',
        Sequence: '3',
        Title: 'Fix login',
        Type: 'Bug',
        Status: 'To Do',
        Category: 'todo',
        Priority: 'High',
        Assignee: 'Bob',
        Email: 'bob@example.com',
        Created: '2024-01-01',
        'Due Date': '2024-02-01',
        'Est. Hours': '5',
      }),
    ).toEqual({
      title: 'Fix login',
      type: 'Bug',
      status: 'To Do',
      priority: 'High',
      assignee: 'Bob',
      assigneeEmail: 'bob@example.com',
      dueDate: '2024-02-01',
      estimatedHours: '5',
    });
  });

  it('ignores unknown headers and empty values', () => {
    expect(mapImportHeaders({ Title: 'A', Foo: 'bar', Type: '' })).toEqual({ title: 'A' });
  });
});

describe('parseImportBuffer', () => {
  it('parses CSV files', () => {
    const { format, rows } = parseImportBuffer(Buffer.from('Title,Type\nA,Bug'), 'items.csv');
    expect(format).toBe('csv');
    expect(rows).toEqual([{ title: 'A', type: 'Bug' }]);
  });

  it('parses JSON arrays', () => {
    const { format, rows } = parseImportBuffer(Buffer.from('[{"title":"A","type":"Bug"}]'), 'items.json');
    expect(format).toBe('json');
    expect(rows).toEqual([{ title: 'A', type: 'Bug' }]);
  });

  it('parses JSONL line by line and reports bad lines', () => {
    const { format, rows } = parseImportBuffer(
      Buffer.from('{"title":"A"}\n\n{"title":"B"}\n'),
      'items.jsonl',
    );
    expect(format).toBe('jsonl');
    expect(rows).toHaveLength(2);
    expect(() => parseImportBuffer(Buffer.from('{"title":"A"}\nnope\n'), 'x.jsonl')).toThrow(
      /line 2/,
    );
  });

  it('rejects empty files and non-array JSON', () => {
    expect(() => parseImportBuffer(Buffer.from('   '), 'x.csv')).toThrow(/empty/);
    expect(() => parseImportBuffer(Buffer.from('{"a":1}'), 'x.json')).toThrow(/array/);
  });

  it('rejects oversized files', () => {
    expect(() => parseImportBuffer(Buffer.alloc(10 * 1024 * 1024 + 1), 'x.csv')).toThrow(/too large/);
  });
});

describe('bulkRequestSchema', () => {
  it('accepts valid payloads with defaults', () => {
    const parsed = bulkRequestSchema.parse({ items: [{ title: 'A' }] });
    expect(parsed.dedupe).toBe(true);
    expect(parsed.dryRun).toBe(false);
  });

  it('rejects empty and oversized arrays', () => {
    expect(() => bulkRequestSchema.parse({ items: [] })).toThrow();
    expect(() => bulkRequestSchema.parse({ items: new Array(101).fill({}) })).toThrow();
  });
});
