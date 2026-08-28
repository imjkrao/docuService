// tsc only emits .js/.d.ts, so the theme's static assets are copied separately.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, 'src', 'theme');
const to = path.join(root, 'dist', 'theme');

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copied theme → ${path.relative(root, to)}`);
