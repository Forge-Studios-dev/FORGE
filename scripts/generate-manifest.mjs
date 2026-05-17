#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINTS = join(ROOT, 'docs/design/blueprints');
const PLATFORMS = ['web', 'mobile', 'admin'];

const STATE_TAGS = [
  'guest', 'user', 'creator', 'owner', 'visitor', 'success', 'error', 'empty',
  'loading', 'offline', 'maintenance', 'expired', 'rejected', 'approval', 'waiting',
  'private', 'unavailable', 'denied', 'gated', 'confirm', 'validation', 'skeleton',
  'failed', 'no_results', 'interaction',
];

function parseTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function deriveCategory(id, platform) {
  let rest = id.startsWith(`${platform}_`) ? id.slice(platform.length + 1) : id;
  return rest.split('_')[0] || 'other';
}

function deriveTags(id) {
  const lower = id.toLowerCase();
  return [...new Set(STATE_TAGS.filter((tag) => lower.includes(tag)))];
}

function isVariant(id) {
  return [
    'feed_user_success', 'feed_guest_success', 'watch_user_success',
    'studio_creator_success', 'studio_video_analytics_details',
  ].includes(id);
}

function collectScreens() {
  const screens = [];
  for (const platform of PLATFORMS) {
    const platformDir = join(BLUEPRINTS, platform);
    for (const ent of readdirSync(platformDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const screenId = ent.name;
      const htmlPath = join(platformDir, screenId, 'index.html');
      const html = readFileSync(htmlPath, 'utf8');
      screens.push({
        id: screenId,
        platform,
        category: deriveCategory(screenId, platform),
        title: parseTitle(html) || screenId,
        path: `/blueprints/${platform}/${screenId}/index.html`,
        tags: deriveTags(screenId),
        variant: isVariant(screenId),
      });
    }
  }
  screens.sort((a, b) => {
    if (a.platform !== b.platform) return a.platform.localeCompare(b.platform);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id.localeCompare(b.id);
  });
  return screens;
}

function main() {
  const screens = collectScreens();
  const manifest = {
    generatedAt: new Date().toISOString(),
    count: screens.length,
    platforms: PLATFORMS,
    categories: [...new Set(screens.map((s) => s.category))].sort(),
    screens,
    recommended: {
      guest: ['web_home_guest_success', 'mobile_feed_guest_empty_state'],
      user: ['web_home_user_success', 'feed_user_success'],
      creator: ['web_studio_creator_overview', 'studio_creator_success'],
      admin: ['admin_login_success', 'admin_dashboard_success_1'],
    },
  };

  const json = JSON.stringify(manifest, null, 2);
  writeFileSync(join(BLUEPRINTS, 'screens.json'), json);
  writeFileSync(join(ROOT, 'docs/design/catalog/public/screens.json'), json);
  console.log(`Generated manifest: ${screens.length} screens`);
}

main();
