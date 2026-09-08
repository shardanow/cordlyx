import { describe, it, expect } from 'vitest';
import { migrateSnapshot, SNAPSHOT_VERSIONS, CURRENT_SNAPSHOT_VERSION } from './snapshot-migration.js';

describe('migrateSnapshot', () => {
  it('accepts the current version as-is', () => {
    const doc = { version: 1, project: { name: 'A', slug: 'a' } };
    expect(migrateSnapshot(doc)).toBe(doc);
    expect(SNAPSHOT_VERSIONS).toContain(CURRENT_SNAPSHOT_VERSION);
  });

  it('rejects future versions with a clear message', () => {
    expect(() => migrateSnapshot({ version: 2 })).toThrow(/Unsupported snapshot version 2/);
  });

  it('rejects missing versions', () => {
    expect(() => migrateSnapshot({ project: {} })).toThrow(/missing "version"/);
  });

  it('rejects non-objects', () => {
    expect(() => migrateSnapshot(null)).toThrow(/expected a JSON object/);
    expect(() => migrateSnapshot([])).toThrow(/expected a JSON object/);
    expect(() => migrateSnapshot('v1')).toThrow(/expected a JSON object/);
  });
});
