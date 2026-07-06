import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { access } from 'node:fs/promises';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/index.js';
import helmet from 'helmet';

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
