#!/usr/bin/env node
/**
 * Generates a Postman v2.1 collection + curl cookbook from a live OpenAPI doc.
 *
 * Usage:
 *   node scripts/openapi-to-postman.mjs openapi.json [out-dir]
 *
 * Fails loudly if the documented transfer routes are missing, so CI catches
 * docs-vs-code drift (see REVIEW_CHECKLIST.md).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, outDir = 'postman'] = process.argv.slice(2);
if (!input) {
  console.error('Usage: openapi-to-postman.mjs <openapi.json> [out-dir]');
  process.exit(1);
}

const REQUIRED_PATHS = [
  '/api/v1/projects/{projectSlug}/items/bulk',
  '/api/v1/projects/{projectSlug}/items/import',
  '/api/v1/projects/{projectSlug}/items/export',
  '/api/v1/projects/{projectSlug}/plans/bulk',
  '/api/v1/projects/{projectSlug}/plans/import',
  '/api/v1/projects/{projectSlug}/config/export',
  '/api/v1/projects/{projectSlug}/config/import',
  '/api/v1/projects/{projectSlug}/roadmaps/import',
  '/api/v1/projects/{projectSlug}/snapshot/export',
  '/api/v1/projects/{projectSlug}/snapshot/import',
  '/api/v1/projects/snapshot/import-new',
];

const spec = JSON.parse(readFileSync(input, 'utf-8'));
for (const p of REQUIRED_PATHS) {
  if (!spec.paths?.[p]) {
    console.error(`Missing documented route: ${p}`);
    process.exit(1);
  }
}

function exampleFor(schema = {}) {
  if (schema.example !== undefined) return schema.example;
  if (schema.enum?.length) return schema.enum[0];
  switch (schema.type) {
    case 'string':
      if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000001';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return '2026-01-01';
      if (schema.format === 'binary') return null;
      return 'string';
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return schema.items ? [exampleFor(schema.items)] : [];
    case 'object': {
      const out = {};
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = exampleFor(v);
      return out;
    }
    default:
      return null;
  }
}

function collectionUrl(openApiPath) {
  const withVars = openApiPath.replace(/\{([^}]+)\}/g, ':$1');
  return {
    raw: `{{baseUrl}}${withVars}`,
    host: ['{{baseUrl}}'],
    path: withVars.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? `:${s.slice(1)}` : s)),
    query: [],
  };
}

const groups = new Map();
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) continue;
    const tags = op.tags?.length ? op.tags : ['default'];
    const tag = tags[0];
    if (!groups.has(tag)) groups.set(tag, []);
    const headers = [
      { key: 'Authorization', value: 'Bearer {{jwt}}', type: 'text' },
      { key: 'X-API-Key', value: '{{apiKey}}', type: 'text', disabled: true },
    ];
    let body;
    const requestBody = op.requestBody?.content;
    if (requestBody?.['multipart/form-data']) {
      body = {
        mode: 'formdata',
        formdata: [{ key: 'file', type: 'file', src: null, description: 'Upload .csv / .json / .jsonl (max 10 MB)' }],
      };
    } else if (requestBody?.['application/json']?.schema) {
      body = { mode: 'raw', raw: JSON.stringify(exampleFor(requestBody['application/json'].schema), null, 2), options: { raw: { language: 'json' } } };
    }
    const url = collectionUrl(path);
    for (const param of op.parameters ?? []) {
      if (param.in === 'query') {
        url.query.push({ key: param.name, value: '', description: param.description ?? '', disabled: param.required !== true });
        url.raw += `${url.raw.includes('?') ? '&' : '?'}${param.name}=`;
      }
    }
    groups.get(tag).push({
      name: `${method.toUpperCase()} ${path}`,
      request: { method: method.toUpperCase(), header: headers, url, ...(body ? { body } : {}), description: op.summary ?? '' },
      response: [],
    });
  }
}

const collection = {
  info: {
    name: 'CordLyx API',
    description: `Generated from OpenAPI ${spec.info?.version ?? ''}. Set baseUrl/jwt/apiKey variables to call.`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'jwt', value: '<access-token>' },
    { key: 'apiKey', value: 'clx_...' },
  ],
  item: [...groups].map(([name, item]) => ({ name, item })),
};

let cookbook = `# CordLyx API cookbook\n\nGenerated from OpenAPI. \`BASE=http://localhost:4000/api/v1\`, \`AUTH="Authorization: Bearer <jwt>"\` (or \`-H "X-API-Key: clx_..."\`).\n`;
for (const [tag, items] of groups) {
  cookbook += `\n## ${tag}\n`;
  for (const item of items) {
    const { method, url } = item.request;
    let path = url.raw.replace('{{baseUrl}}', '$BASE').replace('$BASE/api/v1', '$BASE');
    const display = path.replace('$BASE', '').replace(/\{([^}]+)\}/g, '<$1>') || '/';
    const runnable = path.replace(/\{([^}]+)\}/g, '<$1>');
    cookbook += `\n### ${method} ${display}\n`;
    if (item.request.description) cookbook += `${item.request.description}\n`;
    if (item.request.body?.mode === 'formdata') {
      cookbook += `\n\`\`\`bash\ncurl -X ${method} "${runnable}" -H "$AUTH" -F "file=@data.csv"\n\`\`\`\n`;
    } else if (item.request.body?.raw) {
      cookbook += `\n\`\`\`bash\ncurl -X ${method} "${runnable}" -H "$AUTH" -H 'Content-Type: application/json' -d '${item.request.body.raw}'\n\`\`\`\n`;
    } else {
      cookbook += `\n\`\`\`bash\ncurl -X ${method} "${runnable}" -H "$AUTH"\n\`\`\`\n`;
    }
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'CordLyx.postman_collection.json'), `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(resolve(outDir, 'CURL.md'), `${cookbook}\n`);
const total = [...groups.values()].reduce((n, items) => n + items.length, 0);
console.log(`Wrote ${outDir}/CordLyx.postman_collection.json + ${outDir}/CURL.md (${total} requests, ${groups.size} groups)`);
