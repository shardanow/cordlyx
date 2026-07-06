#!/usr/bin/env node
/**
 * Post-build script: rewrites .ts -> .js in compiled require() calls.
 * SWC preserves .ts extensions when using allowImportingTsExtensions,
 * but Node.js CJS can only load .js files.
 */
const { readdirSync, readFileSync, writeFileSync, statSync } = require('fs');
const { join } = require('path');

const distDir = join(__dirname, '..', 'dist');

function walk(dir) {
  let files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files = files.concat(walk(full));
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

let fixed = 0;
for (const file of walk(distDir)) {
  const original = readFileSync(file, 'utf8');
  const updated = original
    .replace(/require\("([^"]+)\.ts"\)/g, 'require("$1.js")')
    .replace(/require\('([^']+)\.ts'\)/g, "require('$1.js')");
  if (updated !== original) {
    writeFileSync(file, updated);
    fixed++;
  }
}
console.log(`Fixed .ts imports in ${fixed} compiled file(s).`);
