// Tiny zero-dependency static file server for the project root.
// Usage: node scripts/serve.mjs   (PORT env var overrides the default 5173)
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

async function resolveFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return { status: 400 };
  }
  if (decoded.includes('\0')) return { status: 400 };

  const target = normalize(join(ROOT, decoded));
  // Block path traversal outside the project root.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return { status: 403 };

  try {
    let info = await stat(target);
    let file = target;
    if (info.isDirectory()) {
      file = join(target, 'index.html');
      info = await stat(file);
    }
    if (!info.isFile()) return { status: 404 };
    return { status: 200, file, size: info.size };
  } catch {
    return { status: 404 };
  }
}

export function start({ port = Number(process.env.PORT) || 5173, host = '127.0.0.1' } = {}) {
  const server = createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(res, 405, '405 Method Not Allowed');
    }
    const { pathname } = new URL(req.url, 'http://localhost');
    const result = await resolveFile(pathname);

    if (result.status !== 200) {
      const text = { 400: 'Bad Request', 403: 'Forbidden', 404: 'Not Found' }[result.status];
      console.log(`${result.status} ${req.method} ${pathname}`);
      return send(res, result.status, `${result.status} ${text}`);
    }

    res.writeHead(200, {
      'Content-Type': MIME[extname(result.file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': result.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(result.file)
      .on('error', () => res.destroy())
      .pipe(res);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Try: PORT=${port + 1} npm run serve`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });

  server.listen(port, host, () => {
    console.log(`Serving ${ROOT}\n→ http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
  });

  return server;
}

// Run directly: node scripts/serve.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = start();
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
