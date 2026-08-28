import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { FrontMatter, Page, SiteConfig } from './types.js';

const MARKDOWN_EXT = new Set(['.md', '.markdown', '.mdown']);
const INDEX_NAMES = new Set(['index', 'readme']);

/**
 * Walk `srcDir` and turn every Markdown file into a Page.
 * Ordering is stable: index pages first, then front-matter `order`, then title.
 */
export async function discoverPages(
  srcDir: string,
  config: SiteConfig,
  /** Exact POSIX paths relative to srcDir that must never be walked (e.g. outDir). */
  excludeExact: string[] = [],
): Promise<Page[]> {
  return (await scanSource(srcDir, config, excludeExact)).pages;
}

export interface SourceScan {
  pages: Page[];
  /** Every directory walked, as a POSIX path relative to srcDir. */
  directories: Set<string>;
}

/**
 * Single walk of the source tree yielding both the pages and the directories.
 * Rendering needs the directory set to tell a link to a folder from a link to
 * a missing file, and the walk is too expensive to repeat.
 */
export async function scanSource(
  srcDir: string,
  config: SiteConfig,
  excludeExact: string[] = [],
): Promise<SourceScan> {
  const directories = new Set<string>();
  const files = await walk(srcDir, srcDir, config.exclude, new Set(excludeExact), directories);
  const pages: Page[] = [];

  for (const file of files) {
    const page = await readPage(srcDir, file, config);
    if (!page.frontMatter.hidden) pages.push(page);
  }

  pages.sort(comparePages);
  return { pages, directories };
}

async function walk(
  root: string,
  dir: string,
  exclude: string[],
  excludeExact: Set<string>,
  directories: Set<string>,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = toPosix(path.relative(root, full));
    if (excludeExact.has(rel) || isExcluded(rel, entry.name, exclude)) continue;

    if (entry.isDirectory()) {
      directories.add(rel);
      found.push(...(await walk(root, full, exclude, excludeExact, directories)));
    } else if (entry.isFile() && MARKDOWN_EXT.has(path.extname(entry.name).toLowerCase())) {
      found.push(full);
    }
  }

  return found;
}

/** A path is excluded when any exclude entry matches a whole segment or the full relative path. */
function isExcluded(rel: string, name: string, exclude: string[]): boolean {
  if (name.startsWith('.')) return true;
  const segments = rel.split('/');
  return exclude.some((pattern) => {
    const clean = pattern.replace(/^\.\//, '').replace(/\/$/, '');
    return clean === rel || segments.includes(clean);
  });
}

async function readPage(srcDir: string, file: string, config: SiteConfig): Promise<Page> {
  const raw = await readFile(file, 'utf8');
  const parsed = matter(raw);
  const frontMatter = (parsed.data ?? {}) as FrontMatter;
  const body = parsed.content;

  const relPath = toPosix(path.relative(srcDir, file));
  const parsedPath = path.posix.parse(relPath);
  const stem = parsedPath.name;
  const isIndex = INDEX_NAMES.has(stem.toLowerCase());
  const segments = parsedPath.dir ? parsedPath.dir.split('/') : [];
  const isHome = isIndex && segments.length === 0;

  const slugSegments = isHome
    ? []
    : isIndex
      ? segments.map(slugify)
      : [...segments.map(slugify), slugify(stem)];

  const url = config.base + (slugSegments.length ? `${slugSegments.join('/')}/` : '');
  const outPath = slugSegments.length ? `${slugSegments.join('/')}/index.html` : 'index.html';

  return {
    sourcePath: file,
    relPath,
    outPath,
    url,
    segments,
    title: resolveTitle(frontMatter, body, stem, segments),
    frontMatter,
    body,
    isIndex,
    isHome,
    lastUpdated: null,
  };
}

/** Title precedence: front matter → first H1 → humanised folder name (for index) or filename. */
function resolveTitle(fm: FrontMatter, body: string, stem: string, segments: string[]): string {
  if (typeof fm.title === 'string' && fm.title.trim()) return fm.title.trim();

  const h1 = body.match(/^\s{0,3}#\s+(.+?)\s*#*\s*$/m);
  if (h1?.[1]) return h1[1].trim();

  if (INDEX_NAMES.has(stem.toLowerCase())) {
    const last = segments.at(-1);
    return last ? humanize(last) : 'Home';
  }
  return humanize(stem);
}

function comparePages(a: Page, b: Page): number {
  const depth = a.segments.length - b.segments.length;
  if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
  if (depth !== 0 && a.segments.join('/') !== b.segments.join('/')) {
    return a.segments.join('/').localeCompare(b.segments.join('/'));
  }
  if (a.isIndex !== b.isIndex) return a.isIndex ? -1 : 1;
  const orderA = numeric(a.frontMatter.order);
  const orderB = numeric(b.frontMatter.order);
  if (orderA !== orderB) return orderA - orderB;
  return a.title.localeCompare(b.title);
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

/** "01-getting-started" → "Getting Started"; "api_reference" → "Api Reference". */
export function humanize(value: string): string {
  return value
    .replace(/^\d+[-_. ]+/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** URL-safe segment that keeps numeric ordering prefixes out of the public URL. */
export function slugify(value: string): string {
  return value
    .replace(/^\d+[-_.]+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'page';
}

export function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}
