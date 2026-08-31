import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';

type NestImport =
  | (new (...args: unknown[]) => unknown)
  | { forwardRef: () => unknown }
  | { module: new (...args: unknown[]) => unknown; imports?: NestImport[] };

/**
 * Walks @Module imports after the full graph is loaded. Catches the class of
 * prod boot failure where an ES cycle leaves a module class `undefined` inside
 * another module's static imports array (UndefinedModuleException on Fly).
 */
function assertImportsDefined(
  mod: new (...args: unknown[]) => unknown,
  path: string[],
  seen: Set<unknown>,
): void {
  if (seen.has(mod)) return;
  seen.add(mod);

  const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, mod) ?? []) as NestImport[];
  imports.forEach((imp, index) => {
    const at = `${path.join(' → ')} → imports[${index}]`;
    if (imp == null) {
      throw new Error(`Undefined Nest import at ${at}`);
    }
    if (typeof imp === 'object' && 'forwardRef' in imp && typeof imp.forwardRef === 'function') {
      const resolved = imp.forwardRef();
      if (resolved == null) {
        throw new Error(`forwardRef resolved to undefined at ${at}`);
      }
      if (typeof resolved === 'function') {
        assertImportsDefined(resolved as new (...args: unknown[]) => unknown, [...path, resolved.name], seen);
      } else if (resolved && typeof resolved === 'object' && 'module' in (resolved as object)) {
        const dyn = resolved as { module: new (...args: unknown[]) => unknown; imports?: NestImport[] };
        assertImportsDefined(dyn.module, [...path, dyn.module.name], seen);
        for (const nested of dyn.imports ?? []) {
          if (nested && typeof nested === 'object' && 'forwardRef' in nested) {
            const r = nested.forwardRef();
            if (r == null) throw new Error(`DynamicModule forwardRef undefined under ${at}`);
            if (typeof r === 'function') {
              assertImportsDefined(r as new (...args: unknown[]) => unknown, [...path, r.name], seen);
            }
          } else if (typeof nested === 'function') {
            assertImportsDefined(nested, [...path, nested.name], seen);
          }
        }
      }
      return;
    }
    if (typeof imp === 'object' && 'module' in imp) {
      assertImportsDefined(imp.module, [...path, imp.module.name], seen);
      for (const nested of imp.imports ?? []) {
        if (nested && typeof nested === 'object' && 'forwardRef' in nested) {
          const r = nested.forwardRef();
          if (r == null) throw new Error(`DynamicModule forwardRef undefined under ${at}`);
          if (typeof r === 'function') {
            assertImportsDefined(r as new (...args: unknown[]) => unknown, [...path, r.name], seen);
          }
        } else if (typeof nested === 'function') {
          assertImportsDefined(nested, [...path, nested.name], seen);
        }
      }
      return;
    }
    if (typeof imp === 'function') {
      assertImportsDefined(imp, [...path, imp.name || 'Anonymous'], seen);
    }
  });
}

describe('AppModule import graph', () => {
  it('has no undefined module imports (circular-load regression)', () => {
    assertImportsDefined(AppModule, ['AppModule'], new Set());
  });
});
