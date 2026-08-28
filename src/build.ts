import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { scanSource, toPosix } from './discover.js';
import { attachLastUpdated, detectRepo } from './git.js';
import { createRenderer, type MarkdownContext } from './markdown.js';
import { buildNav, flattenNav } from './nav.js';
import { renderPage, escapeHtml } from './render.js';
import { buildSearchIndex } from './search.js';
import { staticWebAppConfig } from './swa.js';
import type { Page, RenderedPage, SiteConfig } from './types.js';

const THEME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'theme');

export interface BuildOptions {
  /** Directory containing the Markdown (and optionally docuservice.json). */
  root: string;
  /** Overrides the configured output directory. */
  outDir?: string;
  /** Overrides the configured base path. */
  base?: string;
  /** Suppress per-page logging. */
  quiet?: boolean;
  /**
   * Remove the output directory before writing. Default true.
   * `serve` disables it for rebuilds: deleting a tree that a preview request or
   * a Windows file lock is holding open throws EPERM, and the delete is not
   * worth the failure mode mid-edit.
   */
  clean?: boolean;
}

export interface BuildResult {
  config: SiteConfig;
  outDir: string;
  pageCount: number;
  assetCount: number;
  /** Folders linked from Markdown that now point at Azure Repos. */
  repoLinkedDirectories: string[];
  /**
   * Folders linked from Markdown that could not be pointed anywhere, because no
   * Azure Repos remote was detected or configured. Their links are left as-is.
   */
  skippedDirectories: string[];
  durationMs: number;
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const started = Date.now();
  const root = path.resolve(options.root);
  const config = await loadConfig(root);

  if (options.base) config.base = options.base.endsWith('/') ? options.base : `${options.base}/`;
  const srcDir = path.resolve(root, config.srcDir);
  const outDir = path.resolve(root, options.outDir ?? config.outDir);

  if (!existsSync(srcDir)) throw new Error(`Source directory not found: ${srcDir}`);
  if (outDir === srcDir) throw new Error('outDir must not be the same directory as the Markdown source.');

  // `docuservice serve .` puts the output inside the source by default. That is
  // fine, but the build must never discover — or later delete — its own output.
  const nestedOut = nestedOutDir(srcDir, outDir);
  const { pages, directories } = await scanSource(srcDir, config, nestedOut ? [nestedOut] : []);
  if (pages.length === 0) throw new Error(`No Markdown files found under ${srcDir}`);

  await attachLastUpdated(pages, srcDir);
  if (!config.repo) {
    config.repo = await detectRepo(srcDir, toPosix(path.relative(root, srcDir)));
  }
  if (config.title === 'Documentation' && config.repo?.repository) {
    config.title = config.repo.repository;
  }

  const home = ensureHomePage(pages, config);
  const context: MarkdownContext = {
    config,
    pageByRelPath: new Map(pages.map((page) => [page.relPath, page])),
    assets: new Set(),
    directories,
    repoLinks: new Set(),
    unlinkedDirectories: new Set(),
  };

  const render = createRenderer(context);
  const rendered: RenderedPage[] = pages.map(render);
  const nav = buildNav(pages);
  const flat = flattenNav(nav);

  if (options.clean !== false) {
    // maxRetries covers Windows EPERM/EBUSY from antivirus, indexers and sync
    // clients briefly holding handles on files we are removing.
    await rm(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  await mkdir(outDir, { recursive: true });

  for (const page of rendered) {
    const index = flat.findIndex((entry) => entry.url === page.url);
    const html = renderPage({
      page,
      nav,
      config,
      prev: index > 0 ? (flat[index - 1] ?? null) : null,
      next: index >= 0 && index < flat.length - 1 ? (flat[index + 1] ?? null) : null,
    });
    const target = path.join(outDir, page.outPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    if (!options.quiet) console.log(`  ${page.url}  ←  ${page.relPath}`);
  }

  await writeFile(path.join(outDir, '404.html'), renderNotFound(rendered, nav, config), 'utf8');
  await copyTheme(outDir);
  const assets = await copyAssets(context.assets, srcDir, outDir);

  if (config.search) {
    await writeFile(
      path.join(outDir, 'search-index.json'),
      JSON.stringify(buildSearchIndex(rendered)),
      'utf8',
    );
  }
  if (config.emitSwaConfig) {
    await writeFile(path.join(outDir, 'staticwebapp.config.json'), staticWebAppConfig(config), 'utf8');
  }
  await writeFile(path.join(outDir, 'sitemap.txt'), rendered.map((page) => page.url).join('\n'), 'utf8');

  if (home.synthesized && !options.quiet) {
    console.log('  (generated a home page — add index.md or README.md to control it)');
  }
  const repoLinkedDirectories = [...context.repoLinks].sort();
  const unlinkedDirectories = [...context.unlinkedDirectories].sort();

  if (!options.quiet && repoLinkedDirectories.length > 0) {
    console.log(
      `  (${repoLinkedDirectories.length} folder link(s) point at Azure Repos, e.g. ${repoLinkedDirectories[0]})`,
    );
  }
  if (!options.quiet && unlinkedDirectories.length > 0) {
    console.log(
      `  (${unlinkedDirectories.length} folder link(s) left unchanged, e.g. ${unlinkedDirectories[0]} — set "repo" in docuservice.json to link them to Azure Repos)`,
    );
  }

  return {
    config,
    outDir,
    pageCount: rendered.length,
    assetCount: assets.copied,
    repoLinkedDirectories,
    skippedDirectories: unlinkedDirectories,
    durationMs: Date.now() - started,
  };
}

/**
 * Every site needs a root document. When the repo has no top-level index.md or
 * README.md, synthesise one that links to each top-level section.
 */
function ensureHomePage(pages: Page[], config: SiteConfig): { synthesized: boolean } {
  if (pages.some((page) => page.isHome)) return { synthesized: false };

  const sections = new Map<string, Page>();
  for (const page of pages) {
    const key = page.segments[0] ?? '';
    if (!sections.has(key)) sections.set(key, page);
  }

  const body = [...sections.entries()]
    .map(([key, page]) => `- [${key ? titleOfSection(pages, key) : page.title}](${page.relPath})`)
    .join('\n');

  pages.unshift({
    sourcePath: '<generated>',
    relPath: 'index.md',
    outPath: 'index.html',
    url: config.base,
    segments: [],
    title: config.title,
    frontMatter: {},
    body: `${config.description ? `${config.description}\n\n` : ''}${body}\n`,
    isIndex: true,
    isHome: true,
    lastUpdated: null,
  });

  return { synthesized: true };
}

function titleOfSection(pages: Page[], segment: string): string {
  const index = pages.find((page) => page.isIndex && page.segments.at(-1) === segment);
  return index?.title ?? segment;
}

function renderNotFound(pages: RenderedPage[], nav: ReturnType<typeof buildNav>, config: SiteConfig): string {
  const template = pages[0];
  if (!template) throw new Error('Cannot render 404 page without at least one page.');

  return renderPage({
    page: {
      ...template,
      title: 'Page not found',
      url: `${config.base}404`,
      relPath: '404.md',
      headings: [],
      text: '',
      html: `<p>That page does not exist. Try the navigation, or <a href="${escapeHtml(config.base)}">start from the home page</a>.</p>`,
    },
    nav,
    config,
    prev: null,
    next: null,
  });
}

async function copyTheme(outDir: string): Promise<void> {
  const target = path.join(outDir, 'assets');
  await mkdir(target, { recursive: true });
  await cp(THEME_DIR, target, { recursive: true });
}

/**
 * Copy every non-Markdown *file* the content referenced (images, PDFs, downloads).
 *
 * Directories are deliberately not copied. A link to a folder is usually meant to
 * point at the folder in the repository, and copying it recursively can pull an
 * entire sibling project into the site — which then has to be deleted on the next
 * build, and fails outright when anything in it is locked.
 */
async function copyAssets(
  assets: Set<string>,
  srcDir: string,
  outDir: string,
): Promise<{ copied: number }> {
  let copied = 0;

  for (const asset of assets) {
    const from = path.resolve(srcDir, asset);
    // Never escape the source tree, even if the Markdown linked to "../secrets".
    if (from !== srcDir && !from.startsWith(srcDir + path.sep)) continue;

    let info;
    try {
      info = await stat(from);
    } catch {
      continue; // referenced but missing on disk
    }

    // Directories never reach here — rendering routes folder links to Azure
    // Repos — but a symlink or device node could, and neither belongs in a site.
    if (!info.isFile()) continue;

    const to = path.join(outDir, asset);
    await mkdir(path.dirname(to), { recursive: true });
    await cp(from, to);
    copied += 1;
  }

  return { copied };
}

/**
 * POSIX path of outDir relative to srcDir when it sits inside it, else null.
 * Used to keep the build from discovering or watching its own output.
 */
export function nestedOutDir(srcDir: string, outDir: string): string | null {
  const rel = path.relative(srcDir, outDir);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return toPosix(rel);
}
