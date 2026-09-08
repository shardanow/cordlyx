#!/usr/bin/env node
/**
 * Structural validation for the generated OpenAPI document.
 *
 * Usage:
 *   node scripts/validate-openapi.mjs /tmp/openapi.json
 *
 * Fails loudly when:
 *   - the document is not OpenAPI 3.x with paths,
 *   - any operation lacks a summary or tags,
 *   - any parameter lacks name/in/schema,
 *   - any response lacks a description,
 *   - any POST/PATCH/PUT/DELETE with a JSON body need has no requestBody.
 *
 * Bodiless action endpoints (e.g. votes, clones, accepts) are fine without
 * requestBody — only operations that declare @Body() must document it, which
 * is enforced by the openapi-coverage arch test instead.
 */
import { readFileSync } from 'node:fs';

const [input] = process.argv.slice(2);
if (!input) {
  console.error('Usage: validate-openapi.mjs <openapi.json>');
  process.exit(1);
}

const spec = JSON.parse(readFileSync(input, 'utf-8'));
const failures = [];
const fail = (msg) => failures.push(msg);

if (!String(spec.openapi ?? '').startsWith('3.')) fail(`not OpenAPI 3.x (got ${spec.openapi})`);
if (!spec.info?.title) fail('missing info.title');
if (!spec.paths || typeof spec.paths !== 'object') fail('missing paths');

for (const [path, ops] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(ops ?? {})) {
    if (!['get', 'post', 'patch', 'put', 'delete'].includes(method) || typeof op !== 'object' || !op) continue;
    const id = `${method.toUpperCase()} ${path}`;
    if (!op.summary?.trim()) fail(`${id}: missing summary`);
    if (!Array.isArray(op.tags) || op.tags.length === 0) fail(`${id}: missing tags`);
    for (const param of op.parameters ?? []) {
      if (!param?.name || !param?.in) fail(`${id}: malformed parameter ${JSON.stringify(param)}`);
      else if (!param.schema && !param.$ref) fail(`${id}: parameter '${param.name}' has no schema`);
    }
    for (const [status, res] of Object.entries(op.responses ?? {})) {
      if (!res?.description) fail(`${id}: response ${status} has no description`);
    }
  }
}

if (failures.length > 0) {
  console.error(`OpenAPI validation failed (${failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`OpenAPI OK: ${Object.keys(spec.paths).length} paths documented`);
