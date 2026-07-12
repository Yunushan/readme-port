import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { PROJECT_ROOT } from './io.mjs';

const REAL_PROJECT_ROOT = await realpath(PROJECT_ROOT);
const SERVED_DIRECTORIES = new Set(['assets', 'examples', 'src', 'templates', 'themes', 'web']);

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.tmpl': 'text/plain; charset=utf-8',
};

function parsePathname(requestUrl) {
  try {
    const url = new URL(requestUrl, 'http://127.0.0.1');
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function resolveRequestPath(pathname) {
  if (pathname.endsWith('/')) pathname += 'index.html';
  const candidate = path.resolve(PROJECT_ROOT, `.${pathname}`);
  const relative = path.relative(PROJECT_ROOT, candidate);
  const segments = relative.split(path.sep);
  if (relative.startsWith('..')
    || path.isAbsolute(relative)
    || segments.some((part) => part.startsWith('.'))
    || !SERVED_DIRECTORIES.has(segments[0])) {
    return null;
  }
  return candidate;
}

export function startServer({ port = 4173, host = '127.0.0.1' } = {}) {
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
      response.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }
    const pathname = parsePathname(request.url || '/');
    if (pathname === null) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }
    if (pathname === '/') {
      response.writeHead(302, { location: '/web/' });
      response.end();
      return;
    }
    const target = resolveRequestPath(pathname);
    if (!target) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }
    try {
      const realTarget = await realpath(target);
      const realRelative = path.relative(REAL_PROJECT_ROOT, realTarget);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }
      const info = await stat(realTarget);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[path.extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(realTarget).pipe(response);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
