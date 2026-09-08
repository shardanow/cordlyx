import { BadRequestException } from '@nestjs/common';

/** Snapshot format versions this backend can import. Bump + add a case when the format changes. */
export const SNAPSHOT_VERSIONS = [1] as const;
export const CURRENT_SNAPSHOT_VERSION = 1;

/**
 * Migrate any supported snapshot document to the current in-memory shape.
 * Throws BadRequestException for unknown versions so callers fail fast
 * with a clear message instead of half-importing.
 */
export function migrateSnapshot(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Invalid snapshot: expected a JSON object');
  }
  const version = (raw as { version?: unknown }).version;
  if (version === CURRENT_SNAPSHOT_VERSION) return raw as Record<string, unknown>;
  if (version === undefined) {
    throw new BadRequestException(
      `Invalid snapshot: missing "version" (supported: ${SNAPSHOT_VERSIONS.join(', ')})`,
    );
  }
  throw new BadRequestException(
    `Unsupported snapshot version ${JSON.stringify(version)} (supported: ${SNAPSHOT_VERSIONS.join(', ')})`,
  );
}
