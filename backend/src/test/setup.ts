import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load root .env first
config({ path: resolve(__dirname, '../../../../.env') });
// Then override with test-specific if exists
config({ path: resolve(__dirname, '../../.env.test') });

// Ensure critical env vars
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-testing';
process.env.REDIS_URL ??= 'redis://localhost:6379/0';
process.env.DATABASE_URL ??= 'postgres://cordlyx:cordlyx@localhost:5432/cordlyx';
