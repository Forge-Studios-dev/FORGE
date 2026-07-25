import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Incident: PR #151 removed the inline UUID regex constraint from
 * VideosController's `:id` route (path-to-regexp v7 / Express 5 dropped that
 * syntax). An unconstrained `:id` matches ANY single path segment, including
 * literal segments like "feed" or "public" that FeedController owns under
 * the same `videos` prefix. ContentModule (VideosController) registers
 * before FeedModule (FeedController) in app.module.ts, so Express tried the
 * earlier-registered `:id` catch-all first and FeedController's static
 * single-segment routes (`feed`, `public`, `by-skills`) became unreachable —
 * caught by the production smoke test, which triggered an auto-rollback.
 *
 * This statically re-derives module import order + route decorators to
 * guard both halves of the fix: FeedModule must import before ContentModule,
 * and neither controller may reintroduce an unconstrained single-segment
 * catch-all that would shadow the other's literal routes.
 */

const API_SRC = join(__dirname, '..', '..');

function importOrderIndex(moduleName: string): number {
  const appModuleSource = readFileSync(join(API_SRC, 'app.module.ts'), 'utf8');
  const importsBlockMatch = appModuleSource.match(/imports:\s*\[([\s\S]*?)\n {2}\],/);
  expect(importsBlockMatch).not.toBeNull();
  const importsBlock = importsBlockMatch![1];
  const index = importsBlock
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .findIndex((line) => new RegExp(`^\\s*${moduleName}\\s*,?\\s*$`).test(line));
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

interface RouteEntry {
  method: string;
  path: string;
  controller: string;
}

function extractRoutes(file: string, controllerPrefix: string, controller: string): RouteEntry[] {
  const source = readFileSync(file, 'utf8');
  const prefixMatch = source.match(/@Controller\(\s*(['"`])((?:(?!\1).)*)\1\s*\)/);
  expect(prefixMatch?.[2]).toBe(controllerPrefix);

  const routeDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
  const pattern = new RegExp(`@(${routeDecorators.join('|')})\\(\\s*(?:(['"\`])((?:(?!\\2).)*)\\2)?\\s*\\)`, 'g');
  const routes: RouteEntry[] = [];
  for (const match of source.matchAll(pattern)) {
    routes.push({ method: match[1], path: match[3] ?? '', controller });
  }
  return routes;
}

/** Express-style single-segment match: literal must match exactly, ':param' matches any one segment. */
function matchesPath(routePath: string, testPath: string): boolean {
  const routeSegments = routePath.split('/');
  const testSegments = testPath.split('/');
  if (routeSegments.length !== testSegments.length) return false;
  return routeSegments.every((seg, i) => seg.startsWith(':') || seg === testSegments[i]);
}

/** First route (in effective registration order) whose pattern matches testPath, or undefined. */
function resolve(routes: RouteEntry[], method: string, testPath: string): RouteEntry | undefined {
  return routes.find((r) => r.method === method && matchesPath(r.path, testPath));
}

describe('videos/feed route registration order (regression: PR #151 route shadow)', () => {
  it('FeedModule imports before ContentModule in app.module.ts', () => {
    expect(importOrderIndex('FeedModule')).toBeLessThan(importOrderIndex('ContentModule'));
  });

  it('GET /videos/feed, /videos/public, /videos/by-skills resolve to FeedController, not VideosController\'s :id catch-all', () => {
    const videosRoutes = extractRoutes(
      join(API_SRC, 'modules', 'content', 'videos.controller.ts'),
      'videos',
      'VideosController',
    );
    const feedRoutes = extractRoutes(
      join(API_SRC, 'modules', 'feed', 'feed.controller.ts'),
      'videos',
      'FeedController',
    );

    // Mirror real registration order: whichever module imports first in
    // app.module.ts has its controller's routes registered first.
    const feedFirst = importOrderIndex('FeedModule') < importOrderIndex('ContentModule');
    const effectiveOrder = feedFirst ? [...feedRoutes, ...videosRoutes] : [...videosRoutes, ...feedRoutes];

    for (const testPath of ['feed', 'public', 'by-skills']) {
      const winner = resolve(effectiveOrder, 'Get', testPath);
      expect(winner?.controller).toBe('FeedController');
    }
  });
});
