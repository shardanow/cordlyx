import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { access } from 'node:fs/promises';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/index.js';
import helmet from 'helmet';

// Tag groups with descriptions for the Swagger sidebar.
const SWAGGER_TAGS: Array<{ name: string; description: string }> = [
  { name: 'Auth', description: 'Register, login, token rotation. Public except logout/change-password.' },
  { name: 'Users', description: 'Own profile, user search (member picker), avatar, account deletion.' },
  { name: 'projects', description: 'Projects, members, saved views, stats, config (types/statuses/priorities), sync, snapshots.' },
  { name: 'ProjectMembers', description: 'Project membership and roles (admin only).' },
  { name: 'project-config', description: 'Per-project vocabulary: item types, statuses, priorities (+ JSON template transfer).' },
  { name: 'items', description: 'Issues/tasks: CRUD, filters, bulk, CSV/JSON import/export, votes, duplicates check.' },
  { name: 'Board', description: 'Kanban board columns + drag-and-drop moves.' },
  { name: 'QuickCreate', description: 'One-shot item creation from any context (needs project slug).' },
  { name: 'comments', description: 'Threaded comments with @mentions and emoji reactions.' },
  { name: 'Reactions', description: 'Emoji reactions on comments.' },
  { name: 'Tags', description: 'Project tag vocabulary + toggling tags on items.' },
  { name: 'attachments', description: 'File uploads (MIME + magic-byte validated, 10 MB max).' },
  { name: 'Relations', description: 'Typed links between items (blocks, depends_on, relates_to, duplicates, child_of, next_action).' },
  { name: 'Activities', description: 'Project and item activity timelines.' },
  { name: 'Search', description: 'Full-text search across accessible items.' },
  { name: 'plans', description: 'Plans (releases/milestones) + bulk/import/export.' },
  { name: 'roadmaps', description: 'Roadmaps with lanes, scheduling, bulk/import/export.' },
  { name: 'api-keys', description: 'Manage personal API keys (secret shown once at creation). JWT only.' },
  { name: 'notifications', description: 'Inbox, unread counts, per-project prefs, email digests.' },
  { name: 'Admin', description: 'Server administration (server admins only). JWT only.' },
  { name: 'webhooks', description: 'Project webhooks with signing secret and delivery log (admin only).' },
];

const DELETED_PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f3f4f6" rx="8"/>
  <g fill="#9ca3af" transform="translate(200,120)">
    <rect x="-28" y="-20" width="56" height="44" rx="4" stroke="#d1d5db" stroke-width="2" fill="none"/>
    <circle cx="-6" cy="-8" r="6" stroke="#d1d5db" stroke-width="2" fill="none"/>
    <polygon points="-28,20 -10,0 4,14 16,4 28,20" stroke="#d1d5db" stroke-width="2" fill="none"/>
  </g>
  <text x="200" y="200" text-anchor="middle" fill="#9ca3af" font-size="18" font-family="system-ui">Image deleted</text>
  <text x="200" y="225" text-anchor="middle" fill="#d1d5db" font-size="13" font-family="system-ui">(file was removed)</text>
</svg>`;

// Prevent pino-http worker thread crash from killing the server during hot-reload
process.on('uncaughtException', (err: Error) => {
  if (err.message?.includes('worker has exited') || err.message?.includes('thread-stream')) {
    return; // pino worker died, non-fatal during development
  }
  console.error('[FATAL] Uncaught exception:', err.message);
  process.exit(1);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Helmet configured for API: disable CSP (not serving HTML), allow cross-origin fetches
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
  }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'health', method: 0 }] });

  // Trust the first proxy hop (nginx in docker / VPS). Required so Express
  // parses X-Forwarded-For: without it req.ips is empty and rate limiting
  // (plus logging) sees every client as the proxy's own IP — one shared bucket.
  // Spoofing is not possible: Express takes the address before the trusted hop,
  // and nginx appends the real client IP. Direct (no-proxy) dev traffic is unaffected.
  app.set('trust proxy', 1);

  // OpenAPI docs (Swagger UI at /api/docs, raw JSON at /api/docs-json).
  // Served directly on the HTTP adapter, so the global api/v1 prefix does not apply.
  // Request schemas come from the shared Zod schemas (single source of truth)
  // via backend/src/common/swagger helpers — never hand-duplicated.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CordLyx API')
    .setDescription(
      'Project-management API: items (create, bulk, import, export), comments, plans, roadmaps, webhooks.\n\n' +
        '## Authentication\n' +
        'Click **Authorize** and fill ONE scheme: `api-key` with an `X-API-Key: clx_...` value ' +
        '(Profile → API Keys), or `jwt` with `Authorization: Bearer <accessToken>` ' +
        '(from `POST /auth/login`). Every locked endpoint accepts either one.\n\n' +
        '## Typical flow (copy-paste ids between calls)\n' +
        '1. `POST /auth/register` (or login) → Authorize.\n' +
        '2. `POST /projects` → note the `slug`.\n' +
        '3. `GET /projects/{slug}/types|statuses|priorities` → note the ids.\n' +
        '4. `POST /projects/{slug}/items` with `title` + `typeId` → note `sequenceNum`.\n' +
        '5. Open `/projects/{slug}/items/{sequenceNum}` — comments, tags, attachments, relations.\n\n' +
        '## Conventions\n' +
        '- Cursor pagination: `?limit=` + `meta.cursor` → next page `?cursor=`.\n' +
        '- Errors share one envelope: `{ statusCode, error, message, requestId, timestamp }`.\n' +
        '- Rate limits: 120 req/min per IP/key (auth endpoints: isolated 10 req/min bucket). ' +
        'Over-limit answers are `429` with a `Retry-After` header.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'api-key')
    // Every endpoint accepts either scheme (OR). Public auth endpoints
    // opt out per-operation via @ApiOperation({ security: [] }).
    .addSecurityRequirements('jwt')
    .addSecurityRequirements('api-key')
    .build();
  // Tag groups with descriptions (addTag() in this swagger version takes no options).
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  swaggerDocument.tags = SWAGGER_TAGS;
  SwaggerModule.setup('api/docs', app, swaggerDocument);
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? process.env.CORS_ORIGIN : ['http://localhost:3000'],
    credentials: true,
  });

  // Serve uploaded files with fallback placeholder for missing/deleted files
  const storagePath = process.env.STORAGE_LOCAL_PATH ?? './data/uploads';
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(/^\/uploads\/(.+)/, async (req: any, res: any) => {
    const filePath = join(process.cwd(), storagePath, req.params[0]);
    try {
      await access(filePath);
      res.sendFile(filePath);
    } catch {
      res.type('image/svg+xml').send(DELETED_PLACEHOLDER_SVG);
    }
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
}

bootstrap();
