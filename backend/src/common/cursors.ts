import { BadRequestException } from '@nestjs/common';

/**
 * Decode a base64 `ISO-date|id` pagination cursor, rejecting garbage with 400
 * instead of leaking a 500 from the database driver.
 */
export function decodeCursorDate(cursor: string): { date: string; id: string | null } {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64').toString('utf-8');
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
  const [date, id] = decoded.split('|');
  if (!date || Number.isNaN(Date.parse(date))) {
    throw new BadRequestException('Invalid cursor');
  }
  return { date, id: id || null };
}
