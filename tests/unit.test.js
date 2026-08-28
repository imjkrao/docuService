import assert from 'node:assert/strict';
import test from 'node:test';
import { humanize, slugify } from '../dist/discover.js';
import { normalizeBase } from '../dist/config.js';
import { editUrl, parseAzureRemote } from '../dist/git.js';
import { buildNav, flattenNav } from '../dist/nav.js';
import { staticWebAppConfig } from '../dist/swa.js';
import { defaultConfig } from '../dist/config.js';

test('slugify strips ordering prefixes and non-url characters', () => {
  assert.equal(slugify('01-getting-started'), 'getting-started');
  assert.equal(slugify('API Reference!'), 'api-reference');
  assert.equal(slugify('___'), 'page');
});

test('humanize turns file stems into titles', () => {
  assert.equal(humanize('02_deploying-to-azure'), 'Deploying To Azure');
  assert.equal(humanize('reference'), 'Reference');
});

test('normalizeBase always yields a /…/ path', () => {
  assert.equal(normalizeBase(''), '/');
  assert.equal(normalizeBase('docs'), '/docs/');
  assert.equal(normalizeBase('/docs'), '/docs/');
  assert.equal(normalizeBase('//docs//'), '/docs/');
});

test('parseAzureRemote handles the Azure Repos remote formats', () => {
  const expected = { organization: 'contoso', project: 'Platform', repository: 'docs' };

  assert.deepEqual(
    parseAzureRemote('https://contoso@dev.azure.com/contoso/Platform/_git/docs'),
    expected,
  );
  assert.deepEqual(parseAzureRemote('https://dev.azure.com/contoso/Platform/_git/docs.git'), expected);
  assert.deepEqual(parseAzureRemote('git@ssh.dev.azure.com:v3/contoso/Platform/docs'), expected);
  assert.deepEqual(parseAzureRemote('https://contoso.visualstudio.com/Platform/_git/docs'), expected);
  assert.equal(parseAzureRemote('https://github.com/contoso/docs.git'), null);
});

test('editUrl deep links into the Azure Repos file view', () => {
  const url = editUrl(
    { organization: 'contoso', project: 'Platform', repository: 'docs', branch: 'main', pathPrefix: 'docs' },
    'guides/setup.md',
  );

  assert.match(url, /^https:\/\/dev\.azure\.com\/contoso\/Platform\/_git\/docs\?/);
  assert.match(url, /path=%2Fdocs%2Fguides%2Fsetup\.md/);
  assert.match(url, /version=GBmain/);
});

test('buildNav nests folders and honours front-matter order', () => {
  const page = (relPath, segments, title, extra = {}) => ({
    relPath,
    segments,
    title,
    url: `/${segments.concat(title.toLowerCase()).join('/')}/`,
    frontMatter: {},
    isIndex: false,
    isHome: false,
    ...extra,
  });

  const nav = buildNav([
    page('index.md', [], 'Home', { isHome: true, isIndex: true }),
    page('guides/index.md', ['guides'], 'Guides', { isIndex: true, url: '/guides/', frontMatter: { order: 1 } }),
    page('guides/b.md', ['guides'], 'Beta', { frontMatter: { order: 2 } }),
    page('guides/a.md', ['guides'], 'Alpha', { frontMatter: { order: 1 } }),
    page('reference/index.md', ['reference'], 'Reference', { isIndex: true, url: '/reference/', frontMatter: { order: 2 } }),
  ]);

  assert.equal(nav.length, 2);
  assert.equal(nav[0].title, 'Guides');
  assert.equal(nav[0].url, '/guides/');
  assert.deepEqual(nav[0].children.map((child) => child.title), ['Alpha', 'Beta']);
  assert.equal(nav[1].title, 'Reference');

  const flat = flattenNav(nav);
  assert.deepEqual(flat.map((entry) => entry.title), ['Guides', 'Alpha', 'Beta', 'Reference']);
});

test('staticWebAppConfig routes unknown paths to the 404 page', () => {
  const config = { ...defaultConfig(), base: '/' };
  const parsed = JSON.parse(staticWebAppConfig(config));

  assert.equal(parsed.navigationFallback.rewrite, '/404.html');
  assert.equal(parsed.responseOverrides['404'].rewrite, '/404.html');
  assert.equal(parsed.globalHeaders['X-Content-Type-Options'], 'nosniff');
});
