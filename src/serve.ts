import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { build, type BuildOptions } from './build.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

export interface ServeOptions extends BuildOptions {
  port: number;
}

/** Local preview server: rebuilds on change, serves the output directory. */
export async function serve(options: ServeOptions): Promise<void> {
  let result = await build({ ...options, quiet: true });
  console.log(`Built ${result.pageCount} pages → ${result.outDir}`);

  const srcDir = path.resolve(options.root, result.config.srcDir);
  let rebuilding: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;

  watch(srcDir, { recursive: true }, (_event, filename) => {
    if (filename && /(^|[/\\])(node_modules|\.git)([/\\]|$)/.test(String(filename))) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      rebuilding = build({ ...options, quiet: true })
        .then((next) => {
          result = next;
          console.log(`Rebuilt ${next.pageCount} pages (${next.durationMs}ms)`);
        })
        .catch((error: unknown) => console.error(`Build failed: ${(error as Error).message}`));
    }, 120);
  });

  const server = createServer(async (req, res) => {
    if (rebuilding) await rebuilding.catch(() => undefined);

    const base = result.config.base;
    let pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (base !== '/' && pathname.startsWith(base.slice(0, -1))) {
      pathname = pathname.slice(base.length - 1) || '/';
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    const target = path.join(result.outDir, pathname);
    if (!target.startsWith(result.outDir)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const info = await stat(target);
      const file = info.isDirectory() ? path.join(target, 'index.html') : target;
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      try {
        const notFound = await readFile(path.join(result.outDir, '404.html'));
        res.writeHead(404, { 'content-type': MIME['.html'] as string }).end(notFound);
      } catch {
        res.writeHead(404).end('Not found');
      }
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port, resolve));
  console.log(`Preview running at http://localhost:${options.port}${result.config.base}`);
  console.log('Watching for changes. Press Ctrl+C to stop.');
}
