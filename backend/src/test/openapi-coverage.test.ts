import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { AppModule } from '../app.module.js';

// Metadata keys (stable @nestjs/common / @nestjs/swagger internals;
// this test fails loudly if they are ever renamed).
const PATH_METADATA = 'path';
const OP_METADATA = 'swagger/apiOperation';
const PARAMS_METADATA = 'swagger/apiParameters';
const RESPONSE_METADATA = 'swagger/apiResponse';
const EXCLUDE_CONTROLLER = 'swagger/apiExcludeController';
const EXCLUDE_ENDPOINT = 'swagger/apiExcludeEndpoint';

type Ctor = new (...args: never[]) => unknown;

function moduleControllers(modules: unknown[], seen = new Set<unknown>()): Ctor[] {
  const out: Ctor[] = [];
  for (const mod of modules) {
    if (typeof mod !== 'function' || seen.has(mod)) continue;
    seen.add(mod);
    out.push(...((Reflect.getMetadata('controllers', mod) as Ctor[] | undefined) ?? []));
    const imports = (Reflect.getMetadata('imports', mod) as unknown[] | undefined) ?? [];
    // Dynamic modules register as { module: X, ... }; forwardRef as { forwardRef }.
    const nested = imports
      .map((i) => (i && typeof i === 'object' && 'module' in (i as object) ? (i as { module: unknown }).module : i))
      .filter((i): i is Ctor => typeof i === 'function');
    out.push(...moduleControllers(nested, seen));
  }
  return [...new Set(out)];
}

function joinPath(...parts: Array<string | string[] | undefined>): string {
  const segs = parts
    .flatMap((p) => (p === undefined ? [] : Array.isArray(p) ? p : [p]))
    .flatMap((p) => String(p).split('/'))
    .filter((s) => s.length > 0);
  return `/${segs.join('/')}`;
}

interface RouteInfo {
  handler: string;
  fullPath: string;
}

function documentedRoutes(): RouteInfo[] {
  const controllers = moduleControllers([AppModule]).filter(
    (c) => !Reflect.getMetadata(EXCLUDE_CONTROLLER, c),
  );
  const routes: RouteInfo[] = [];
  for (const controller of controllers) {
    const proto = controller.prototype as Record<string, unknown>;
    const basePath = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const fn = proto[name];
      if (typeof fn !== 'function') continue;
      if (Reflect.getMetadata(PATH_METADATA, fn) === undefined) continue; // not a route
      if (Reflect.getMetadata(EXCLUDE_ENDPOINT, fn)) continue;
      routes.push({
        handler: `${controller.name}.${name}`,
        fullPath: joinPath(basePath, Reflect.getMetadata(PATH_METADATA, fn) as string | string[]),
      });
    }
  }
  return routes;
}

function operationOf(controllerName: string, methodName: string) {
  const controllers = moduleControllers([AppModule]);
  const controller = controllers.find((c) => c.name === controllerName);
  const fn = (controller?.prototype as Record<string, unknown> | undefined)?.[methodName];
  return typeof fn === 'function'
    ? (Reflect.getMetadata(OP_METADATA, fn) as { summary?: string } | undefined)
    : undefined;
}

function paramsOf(controllerName: string, methodName: string) {
  const controllers = moduleControllers([AppModule]);
  const controller = controllers.find((c) => c.name === controllerName);
  const fn = (controller?.prototype as Record<string, unknown> | undefined)?.[methodName];
  if (typeof fn !== 'function') return [];
  return (Reflect.getMetadata(PARAMS_METADATA, fn) as Array<{ name?: string }> | undefined) ?? [];
}

function responsesOf(controllerName: string, methodName: string) {
  const controllers = moduleControllers([AppModule]);
  const controller = controllers.find((c) => c.name === controllerName);
  const fn = (controller?.prototype as Record<string, unknown> | undefined)?.[methodName];
  if (typeof fn !== 'function') return {};
  return (
    (Reflect.getMetadata(RESPONSE_METADATA, fn) as
      | Record<string, { description?: string; type?: unknown } | undefined>
      | undefined) ?? {}
  );
}

describe('OpenAPI coverage', () => {
  it('discovers the controller registry', () => {
    expect(moduleControllers([AppModule]).length).toBeGreaterThanOrEqual(20);
    expect(documentedRoutes().length).toBeGreaterThanOrEqual(100);
  });

  it('every route documents a summary', () => {
    const missing = documentedRoutes().filter(({ handler }) => {
      const [controllerName, methodName] = handler.split('.') as [string, string];
      return !operationOf(controllerName, methodName)?.summary?.trim();
    });
    expect(missing).toEqual([]);
  });

  it('every :path param is documented', () => {
    const missing: string[] = [];
    for (const { handler, fullPath } of documentedRoutes()) {
      const [controllerName, methodName] = handler.split('.') as [string, string];
      const declared = new Set(
        paramsOf(controllerName, methodName).map((p) => p.name).filter((n): n is string => !!n),
      );
      for (const match of fullPath.matchAll(/:([A-Za-z0-9_]+)/g)) {
        if (!declared.has(match[1]!)) missing.push(`${handler} → :${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every documented response has a description', () => {
    const missing: string[] = [];
    for (const { handler } of documentedRoutes()) {
      const [controllerName, methodName] = handler.split('.') as [string, string];
      for (const [status, res] of Object.entries(responsesOf(controllerName, methodName))) {
        if (!res?.description?.trim()) missing.push(`${handler} → ${status}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
