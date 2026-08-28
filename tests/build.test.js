import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from '../dist/build.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await mkdir(path.join(root, 'docs', 'guides'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'img'), { recursive: true });

  await writeFile(
    path.join(root, 'docs', 'README.md'),
    '# Handbook\n\nSee the [setup guide](guides/setup.md) and this ![diagram](img/flow.png).\n',
  );
  await writeFile(
    path.join(root, 'docs', 'guides', 'setup.md'),
    '---\ntitle: Setup\norder: 1\n---\n\n# Setup\n\n## Install\n\nRun it.\n\n## Verify\n\nBack to the [handbook](../README.md).\n',
  );
  await writeFile(
    path.join(root, 'docs', 'guides', 'draft.md'),
    '---\ntitle: Draft\nhidden: true\n---\n\nNot published.\n',
  );
  await writeFile(path.join(root, 'docs', 'img', 'flow.png'), 'not-really-a-png');
  await writeFile(
    path.join(root, 'docs', 'docuservice.json'),
    JSON.stringify({ title: 'Handbook', outDir: '../site' }),
  );

  return root;
}

test('build renders pages, rewrites links and copies assets', async () => {
  const root = await fixture();
  const result = await build({ root: path.join(root, 'docs'), quiet: true });

  assert.equal(result.pageCount, 2, 'hidden pages are excluded');
  assert.equal(result.assetCount, 1);

  const home = await readFile(path.join(result.outDir, 'index.html'), 'utf8');
  assert.match(home, /href="\/guides\/setup\/"/, 'relative .md link is rewritten to the page URL');
  assert.match(home, /src="\/img\/flow\.png"/, 'image src is rewritten to a site-absolute path');
  assert.doesNotMatch(home, /<h1>Handbook<\/h1>\s*<h1>/, 'the leading H1 is not duplicated');

  const setup = await readFile(path.join(result.outDir, 'guides', 'setup', 'index.html'), 'utf8');
  assert.match(setup, /href="\/"/, '../README.md resolves back to the home page');
  assert.match(setup, /id="install"/);
  assert.match(setup, /On this page/, 'a page with two H2s gets a table of contents');

  const asset = await readFile(path.join(result.outDir, 'img', 'flow.png'), 'utf8');
  assert.equal(asset, 'not-really-a-png');

  const index = JSON.parse(await readFile(path.join(result.outDir, 'search-index.json'), 'utf8'));
  assert.ok(index.some((doc) => doc.url === '/guides/setup/#install' && doc.section === 'Install'));
});

test('build synthesises a home page when the repo has no root index', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await mkdir(path.join(root, 'notes'), { recursive: true });
  await writeFile(path.join(root, 'notes', 'one.md'), '# One\n\nBody.\n');

  const result = await build({ root, outDir: path.join(root, '.out'), quiet: true });

  const home = await readFile(path.join(result.outDir, 'index.html'), 'utf8');
  assert.match(home, /href="\/notes\/one\/"/);
});

test('build refuses to write into the source directory', async () => {
  const root = await fixture();
  await assert.rejects(
    () => build({ root: path.join(root, 'docs'), outDir: path.join(root, 'docs'), quiet: true }),
    /must not be the same directory/,
  );
});

test('build fails clearly when there is no Markdown', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await assert.rejects(() => build({ root, quiet: true }), /No Markdown files found/);
});

test('build ignores its own output when outDir is inside srcDir (issue #2)', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await writeFile(path.join(root, 'README.md'), '# Notes\n\nBody.\n');

  // `docuservice serve .` — output lands in ./site, inside the source tree.
  const first = await build({ root, outDir: path.join(root, 'site'), quiet: true });
  assert.equal(first.pageCount, 1);

  // A second build must not discover the HTML it just wrote, and must not grow.
  const second = await build({ root, outDir: path.join(root, 'site'), quiet: true });
  assert.equal(second.pageCount, 1, 'output directory is excluded from discovery');
});

test('build does not recursively copy directories linked from Markdown (issue #2)', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await mkdir(path.join(root, 'docs'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'powerbi', 'Report.Report', '.pbi'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'powerbi', 'Report.Report', '.pbi', 'locked.json'), '{}');
  await writeFile(
    path.join(root, 'docs', 'README.md'),
    '# Analytics\n\nSee the [report project](powerbi/Report.Report) and the [logo](logo.png).\n',
  );
  await writeFile(path.join(root, 'docs', 'logo.png'), 'png-bytes');

  const result = await build({ root: path.join(root, 'docs'), outDir: path.join(root, 'out'), quiet: true });

  assert.equal(result.assetCount, 1, 'only the file asset is copied');
  assert.deepEqual(result.skippedDirectories, ['powerbi/Report.Report']);
  assert.equal(existsSync(path.join(root, 'out', 'powerbi')), false, 'the project tree is not copied');
  assert.equal(existsSync(path.join(root, 'out', 'logo.png')), true);
});

test('build tolerates being re-run without cleaning', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-'));
  await writeFile(path.join(root, 'README.md'), '# One\n\nBody.\n');

  const out = path.join(root, 'site');
  await build({ root, outDir: out, quiet: true });
  const second = await build({ root, outDir: out, quiet: true, clean: false });

  assert.equal(second.pageCount, 1);
  assert.equal(existsSync(path.join(out, 'index.html')), true);
});
