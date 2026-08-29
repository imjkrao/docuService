/**
 * Prepares extension/ for `tfx extension create`.
 *
 * Two things tfx cannot do itself:
 *  1. The manifest can only reference files at or below its own directory, but
 *     LICENSE lives at the repo root. Copy it rather than committing a second
 *     copy that would silently drift from the original.
 *  2. The agent needs the task's node_modules present in the package, but dev
 *     dependencies (TypeScript, @types) must not ship. Reinstall production-only.
 */
import { copyFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(extensionDir);
const taskDir = path.join(extensionDir, 'DocuServiceBuild');

const compiled = path.join(taskDir, 'index.js');
if (!existsSync(compiled)) {
  throw new Error(`${compiled} is missing — run "npm run ext:build" first.`);
}

copyFileSync(path.join(repoRoot, 'LICENSE'), path.join(extensionDir, 'LICENSE'));
console.log('staged LICENSE');

// --omit=dev prunes TypeScript and the type packages out of the shipped tree.
execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], {
  cwd: taskDir,
  stdio: 'inherit',
});
console.log('pruned task dependencies to production only');

const bundledCli = path.join(taskDir, 'node_modules', 'docuservice', 'dist', 'cli.js');
if (!existsSync(bundledCli)) {
  throw new Error(`The docuservice CLI is not bundled at ${bundledCli}. The package would ship broken.`);
}
console.log('verified the bundled CLI is present');

const outDir = path.join(extensionDir, 'dist');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
