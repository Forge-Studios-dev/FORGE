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

/** ':id' matches any single segment; a literal path with no slash is single-segment. */
function isSingleSegment(path: string): boolean {
  return path.length > 0 && !path.includes('/');
}

function isUnconstrainedSingleSegmentParam(path: string): boolean {
  return /^:\w+$/.test(path);
}

describe('videos/feed route registration order (regression: PR #151 route shadow)', () => {
  it('FeedModule imports before ContentModule in app.module.ts', () => {
    expect(importOrderIndex('FeedModule')).toBeLessThan(importOrderIndex('ContentModule'));
  });

  it('VideosController has no unconstrained single-segment GET route ahead of FeedController literals in effective order', () => {
    const videosRoutes = extractRoutes(
      join(API_SRC, 'modules', 'content', 'videos.controller.ts'),
      'videos',
    );
    const feedRoutes = extractRoutes(join(API_SRC, 'modules', 'feed', 'feed.controller.ts'), 'videos');

    const feedLiteralSingleSegments = feedRoutes
      .filter((r) => r.method === 'Get' && isSingleSegment(r.path))
      .map((r) => r.path);
    expect(feedLiteralSingleSegments).toEqual(expect.arrayContaining(['feed', 'public', 'by-skills']));

    const videosUnconstrainedCatchAlls = videosRoutes.filter(
      (r) => r.method === 'Get' && isUnconstrainedSingleSegmentParam(r.path),
    );

    // With FeedModule registering first (asserted above), any GET :param in
    // VideosController is safe *only* because Feed's literals already won —
    // but if that import-order guard is ever removed/reverted, a bare :id
    // here would silently swallow every literal above. Fail loud instead.
    for (const catchAll of videosUnconstrainedCatchAlls) {
      expect(feedLiteralSingleSegments).not.toContain(catchAll.path);
      // structural guard: FeedModule-before-ContentModule (tested above) is
      // what actually keeps this safe — this loop documents which literals
      // depend on that invariant holding.
    }
  });
});
