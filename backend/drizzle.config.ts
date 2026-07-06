import { defineConfig } from 'drizzle-kit';

// Use compiled schema to avoid .js import resolution issues with drizzle-kit
export default defineConfig({
  schema: './dist/src/database/schema/index.js',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://cordlyx:cordlyx@localhost:5432/cordlyx',
  },
  verbose: true,
  strict: true,
});
