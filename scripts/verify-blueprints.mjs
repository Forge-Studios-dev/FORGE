#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINTS = join(ROOT, 'docs/design/blueprints');
const PLATFORMS = ['web', 'mobile', 'admin'];
const EXPECTED_COUNT = 143;

let errors = 0;

function fail(msg) {
  console.error(`✗ ${msg}`);
  errors++;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

function walkBlueprints() {
  const screens = [];
  for (const platform of PLATFORMS) {
    const dir = join(BLUEPRINTS, platform);
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name === 'node_modules') continue;
      screens.push({ id: ent.name, path: join(dir, ent.name, 'index.html') });
    }
  }
  return screens;
}

function main() {
  console.log('Verifying FORGE blueprints...\n');
  const screens = walkBlueprints();

  if (screens.length !== EXPECTED_COUNT) {
    fail(`Expected ${EXPECTED_COUNT} screens, found ${screens.length}`);
  } else {
    ok(`${screens.length} blueprint screens found`);
  }

  for (const { path, id } of screens) {
    if (!existsSync(path)) {
      fail(`${id}: missing index.html`);
      continue;
    }
    const html = readFileSync(path, 'utf8');
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<!doctype html>')) {
      fail(`${id}: missing DOCTYPE`);
    }
  }
  ok('All HTML files pass structure checks');

  const manifestPath = join(BLUEPRINTS, 'screens.json');
  if (!existsSync(manifestPath)) {
    fail('screens.json not found — run npm run manifest');
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.count !== screens.length) {
      fail(`Manifest count ${manifest.count} !== actual ${screens.length}`);
    } else {
      ok(`Manifest matches disk (${manifest.screens.length})`);
    }
  }

  console.log('');
  if (errors > 0) {
    console.error(`FAILED with ${errors} error(s)`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main();
