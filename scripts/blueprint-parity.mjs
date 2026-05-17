#!/usr/bin/env node
/**
 * Generates docs/design/BLUEPRINT_PARITY.md from screens.json + route mapping.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'docs/design/blueprints/screens.json');

/** @type {Record<string, { route: string; notes?: string }>} */
const ROUTE_MAP = {
  web_home_guest_success: { route: '/' },
  web_home_guest_empty: { route: '/', notes: 'empty feed' },
  web_home_guest_error: { route: '/', notes: 'API error' },
  web_home_user_success: { route: '/' },
  web_home_user_empty_category: { route: '/?category=…' },
  web_home_user_error: { route: '/' },
  web_home_creator_success: { route: '/' },
  web_home_creator_error: { route: '/' },
  web_home_loading: { route: '/' },
  web_home_loading_skeleton: { route: '/' },
  web_home_error_state: { route: '/' },
  feed_user_success: { route: '/' },
  web_watch_guest_success: { route: '/watch/[id]' },
  web_watch_guest_comment_gated: { route: '/watch/[id]' },
  web_watch_guest_auth_gate: { route: '/watch/[id]' },
  web_watch_user_success: { route: '/watch/[id]' },
  web_watch_creator_owner_success: { route: '/watch/[id]' },
  web_watch_private_access_denied: { route: '/watch/[id]' },
  web_watch_video_unavailable: { route: '/watch/[id]' },
  web_watch_loading: { route: '/watch/[id]/loading' },
  watch_user_success: { route: '/watch/[id]' },
  web_channel_visitor_success: { route: '/[username]' },
  web_channel_owner_success: { route: '/[username]' },
  web_channel_visitor_404_not_found: { route: '/[username] not-found' },
  web_search_results: { route: '/search' },
  web_search_empty_1: { route: '/search' },
  web_search_empty_2: { route: '/search' },
  web_studio_creator_overview: { route: '/studio' },
  web_studio_user_role_gate_1: { route: '/studio' },
  web_studio_user_role_gate_2: { route: '/studio' },
  web_studio_user_role_gate_3: { route: '/studio' },
  admin_dashboard_success_1: { route: '/dashboard' },
  admin_403_not_authorized_1: { route: '/403' },
};

function inferRoute(screen) {
  if (ROUTE_MAP[screen.id]) return ROUTE_MAP[screen.id].route;
  const { platform, category, id } = screen;
  if (platform === 'admin') return `/admin/${category}`;
  if (platform === 'mobile') return `/mobile/${category}`;
  if (id.startsWith('web_')) {
    const rest = id.replace(/^web_/, '').split('_');
    if (rest[0] === 'upload') return '/upload';
    if (rest[0] === 'studio') return '/studio';
    if (rest[0] === 'shell') return `/${rest.slice(1).join('-')}`;
    return `/${rest[0]}`;
  }
  return `—`;
}

function main() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const lines = [
    '# Blueprint parity checklist',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total: **${manifest.count}** screens (web ${manifest.screens.filter((s) => s.platform === 'web').length}, mobile ${manifest.screens.filter((s) => s.platform === 'mobile').length}, admin ${manifest.screens.filter((s) => s.platform === 'admin').length})`,
    '',
    '| Platform | ID | Route | Tags | Status |',
    '|----------|-----|-------|------|--------|',
  ];

  for (const s of manifest.screens) {
    const route = inferRoute(s);
    const tags = s.tags.length ? s.tags.join(', ') : '—';
    lines.push(`| ${s.platform} | \`${s.id}\` | ${route} | ${tags} | ⬜ |`);
  }

  lines.push('', 'Run `npm run parity` to regenerate this file.');
  const out = join(ROOT, 'docs/design/BLUEPRINT_PARITY.md');
  writeFileSync(out, lines.join('\n'));
  console.log(`Wrote ${out} (${manifest.count} rows)`);
}

main();
