import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * @nestjs/platform-express v11 (Express 5 / path-to-regexp v7+) dropped support
 * for inline regex param constraints like `:id([0-9a-fA-F-]{36})` — they now
 * throw at route-registration time ("Unexpected ( at index N"), which crashes
 * the whole app on boot. This isn't caught by unit or e2e specs (both compose
 * slim modules, never the full AppModule with every controller's real routes),
 * so it only surfaced as a production deploy failure. Statically scanning every
 * route decorator string closes that gap without needing to boot the app.
 */
function findControllerFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...findControllerFiles(fullPath));
    } else if (entry.endsWith('.controller.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('route decorator path syntax (Express 5 / path-to-regexp v7+ compatibility)', () => {
  const routeDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All'];
  const decoratorPathPattern = new RegExp(
    `@(?:${routeDecorators.join('|')})\\(\\s*(['"\`])((?:(?!\\1).)*)\\1`,
    'g',
  );

  const srcDir = join(__dirname, '..', '..');
  const controllerFiles = findControllerFiles(srcDir);

  it('found at least one controller file to check', () => {
    expect(controllerFiles.length).toBeGreaterThan(0);
  });

  it.each(controllerFiles.map((file) => [file] as const))('%s has no unsupported route path syntax', (file) => {
    const source = readFileSync(file, 'utf8');
    const offendingPaths: string[] = [];

    for (const match of source.matchAll(decoratorPathPattern)) {
      const routePath = match[2];
      // Inline regex param constraints, e.g. `:id([0-9a-fA-F-]{36})` — the
      // exact syntax that broke on the Express 5 / path-to-regexp v7 bump.
      if (/:\w+\(/.test(routePath)) {
        offendingPaths.push(routePath);
      }
    }

    expect(offendingPaths).toEqual([]);
  });
});
