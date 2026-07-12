#!/usr/bin/env node
/**
 * Compares web/admin design tokens (packages/design-system/tailwind/theme.css)
 * against the mobile Dart mirror (apps/mobile/lib/core/theme/forge_tokens.dart)
 * so the three apps can't silently drift onto different hex values for the
 * same named color. Exits non-zero only on an actual value mismatch — a token
 * that exists on web but hasn't been ported to mobile yet is reported as a
 * gap, not a failure, since that's expected during incremental rollout.
 *
 * Usage: node scripts/check-token-parity.js
 */
const fs = require('fs');
const path = require('path');

const CSS_PATH = path.join(__dirname, '../packages/design-system/tailwind/theme.css');
const DART_PATH = path.join(__dirname, '../apps/mobile/lib/core/theme/forge_tokens.dart');

function toCamelCase(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function parseCssTokens(css) {
  const tokens = new Map();
  const re = /--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g;
  let match;
  while ((match = re.exec(css))) {
    tokens.set(toCamelCase(match[1]), match[2].toLowerCase());
  }
  return tokens;
}

function parseDartTokens(dart) {
  const tokens = new Map();
  const re = /static const (\w+)\s*=\s*Color\(0x([0-9A-Fa-f]{8})\);/g;
  let match;
  while ((match = re.exec(dart))) {
    const [, name, hex8] = match;
    // Dart uses ARGB (0xAARRGGBB) — drop the alpha byte to compare against CSS #RRGGBB.
    tokens.set(name, `#${hex8.slice(2).toLowerCase()}`);
  }
  return tokens;
}

function main() {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const dart = fs.readFileSync(DART_PATH, 'utf8');
  const cssTokens = parseCssTokens(css);
  const dartTokens = parseDartTokens(dart);

  const mismatches = [];
  const gaps = [];

  for (const [name, cssHex] of cssTokens) {
    const dartHex = dartTokens.get(name);
    if (dartHex === undefined) {
      gaps.push(name);
      continue;
    }
    if (dartHex !== cssHex) {
      mismatches.push({ name, cssHex, dartHex });
    }
  }

  if (gaps.length) {
    console.log(`Not yet mirrored on mobile (${gaps.length}):`);
    for (const name of gaps) console.log(`  - ${name}`);
  }

  if (mismatches.length) {
    console.error(`\nToken value drift (${mismatches.length}) — web and mobile disagree on these colors:`);
    for (const { name, cssHex, dartHex } of mismatches) {
      console.error(`  - ${name}: web=${cssHex} mobile=${dartHex}`);
    }
    console.error('\nFix: update apps/mobile/lib/core/theme/forge_tokens.dart to match packages/design-system/tailwind/theme.css.');
    process.exit(1);
  }

  console.log(`\nToken parity OK — ${cssTokens.size - gaps.length}/${cssTokens.size} web tokens match mobile exactly.`);
}

main();
