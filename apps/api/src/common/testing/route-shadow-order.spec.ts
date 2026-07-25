import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Incident: PR #151 removed the inline UUID regex constraint from
 * VideosController's `:id` route (path-to-regexp v7 / Express 5 dropped that
 * syntax). An unconstrained `:id` matches ANY single path segment. Originally
 * `feed`/`public`/`by-skills` lived in a separate FeedController under the
 * same `videos` prefix; a first fix attempt (#152) tried reordering
 * app.module.ts's imports so FeedModule registered first, verified by a
 * static import-order check — but FeedModule imports ContentModule directly
 * (for VideosService), so Nest's dependency-first module resolution always
 * initializes ContentModule before FeedModule regardless of app.module.ts
 * order. That fix was a no-op: the next deploy hit the identical shadow,
 * this time surfacing as a real HTTP 500 (id="feed" reaching
 * VideosController.findOne, which threw on an invalid UUID query) rather
 * than the deploy-timing flake that masked earlier attempts.
 *
 * The actual fix: `feed`, `public`, and `by-skills` are now declared
 * directly in VideosController, ahead of its own `:id` route — the only
 * ordering NestJS actually guarantees is within a single controller class
 * (declaration order). FeedController no longer declares them at all. This
 * test guards both halves: the literals exist in VideosController before
 * `:id`, and are NOT redeclared in FeedController (where they'd be
 * silently unreachable again).
 */

const API_SRC = join(__dirname, '..', '..');

interface RouteEntry {
  method: string;
  path: string;
}

function extractRoutes(file: string, controllerPrefix: string): RouteEntry[] {
  const source = readFileSync(file, 'utf8');
  const prefixMatch = source.match(/@Controller\(\s*(['"`])((?:(?!\1).)*)\1\s*\)/);
  expect(prefixMatch?.[2]).toBe(controllerPrefix);

  const routeDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
  const pattern = new RegExp(`@(${routeDecorators.join('|')})\\(\\s*(?:(['"\`])((?:(?!\\2).)*)\\2)?\\s*\\)`, 'g');
  const routes: RouteEntry[] = [];
  for (const match of source.matchAll(pattern)) {
    routes.push({ method: match[1], path: match[3] ?? '' });
  }
  return routes;
}

describe('videos/feed route registration order (regression: PR #151 → #152 route shadow)', () => {
  const videosRoutes = extractRoutes(join(API_SRC, 'modules', 'content', 'videos.controller.ts'), 'videos');
  const feedRoutes = extractRoutes(join(API_SRC, 'modules', 'feed', 'feed.controller.ts'), 'videos');

  it('VideosController declares feed/public/by-skills ahead of its own :id catch-all', () => {
    const paths = videosRoutes.filter((r) => r.method === 'Get').map((r) => r.path);
    const idIndex = paths.indexOf(':id');
    expect(idIndex).toBeGreaterThan(-1);

    for (const literal of ['feed', 'public', 'by-skills']) {
      const literalIndex = paths.indexOf(literal);
      expect(literalIndex).toBeGreaterThan(-1);
      expect(literalIndex).toBeLessThan(idIndex);
    }
  });

  it('FeedController does not redeclare feed/public/by-skills (would be silently unreachable)', () => {
    const feedPaths = feedRoutes.map((r) => r.path);
    for (const literal of ['feed', 'public', 'by-skills']) {
      expect(feedPaths).not.toContain(literal);
    }
  });
});
