import path from 'node:path';
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js';
import type { Heading, Page, RenderedPage, SiteConfig } from './types.js';
import { slugify } from './discover.js';

export interface MarkdownContext {
  config: SiteConfig;
  /** relPath (POSIX, relative to srcDir) → page URL. Used to rewrite .md links. */
  pageByRelPath: Map<string, Page>;
  /** Collected local asset references: relPath from srcDir → true. */
  assets: Set<string>;
}

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

export function createRenderer(context: MarkdownContext): (page: Page) => RenderedPage {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        } catch {
          /* fall through to escaped plain text */
        }
      }
      return '';
    },
  });

  md.use(anchor, {
    slugify,
    level: [2, 3, 4],
    permalink: anchor.permalink.linkInsideHeader({
      symbol: '#',
      placement: 'after',
      class: 'heading-anchor',
      ariaHidden: true,
    }),
  });

  installLinkRewriter(md, context);
  installImageRewriter(md, context);
  installFenceRenderer(md, context);
  installTableWrapper(md);

  return (page: Page): RenderedPage => {
    const env: Record<string, unknown> = { page };
    const tokens = md.parse(stripLeadingH1(page), env);
    const headings = collectHeadings(md, tokens);
    const html = md.renderer.render(tokens, md.options, env);
    return { ...page, html, headings, text: toPlainText(page.body) };
  };
}

/**
 * The page title is rendered by the layout, so a leading H1 that matches it
 * would show twice. Drop it when it is the first block of the document.
 */
function stripLeadingH1(page: Page): string {
  const match = page.body.match(/^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (!match) return page.body;
  if (match[1]?.trim() !== page.title) return page.body;
  return page.body.slice(match[0].length);
}

function installLinkRewriter(md: MarkdownIt, context: MarkdownContext): void {
  const defaultRender =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token?.attrGet('href');
    const page = (env as { page?: Page }).page;

    if (token && href && page) {
      if (EXTERNAL.test(href)) {
        token.attrSet('rel', 'noopener noreferrer');
        token.attrSet('target', '_blank');
        token.attrJoin('class', 'external-link');
      } else if (!href.startsWith('#')) {
        token.attrSet('href', rewriteInternalHref(href, page, context));
      }
    }

    return defaultRender(tokens, idx, options, env, self);
  };
}

/** Map `../guides/setup.md#step-2` onto the built URL of that page. */
export function rewriteInternalHref(href: string, page: Page, context: MarkdownContext): string {
  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const queryStart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const qIndex = queryStart.indexOf('?');
  const query = qIndex >= 0 ? queryStart.slice(qIndex) : '';
  const target = qIndex >= 0 ? queryStart.slice(0, qIndex) : queryStart;

  if (!target) return `${query}${hash}`;

  const resolved = resolveFromPage(target, page);
  const match =
    context.pageByRelPath.get(resolved) ??
    context.pageByRelPath.get(`${resolved}.md`) ??
    context.pageByRelPath.get(`${resolved}/index.md`) ??
    context.pageByRelPath.get(`${resolved}/README.md`);

  if (match) return `${match.url}${query}${hash}`;

  // Not a known page: treat as a static asset to copy verbatim.
  context.assets.add(resolved);
  return `${context.config.base}${resolved}${query}${hash}`;
}

function installImageRewriter(md: MarkdownIt, context: MarkdownContext): void {
  const defaultRender =
    md.renderer.rules.image ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token?.attrGet('src');
    const page = (env as { page?: Page }).page;

    if (token && src && page && !EXTERNAL.test(src) && !src.startsWith('data:')) {
      const resolved = resolveFromPage(src, page);
      context.assets.add(resolved);
      token.attrSet('src', `${context.config.base}${resolved}`);
      token.attrSet('loading', 'lazy');
      token.attrSet('decoding', 'async');
    }

    return defaultRender(tokens, idx, options, env, self);
  };
}

function installFenceRenderer(md: MarkdownIt, context: MarkdownContext): void {
  const defaultFence =
    md.renderer.rules.fence ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const info = (token?.info ?? '').trim().split(/\s+/)[0] ?? '';

    if (context.config.mermaid && info.toLowerCase() === 'mermaid') {
      return `<div class="mermaid">${md.utils.escapeHtml(token?.content ?? '')}</div>\n`;
    }

    const rendered = defaultFence(tokens, idx, options, env, self);
    const label = info ? `<span class="code-lang">${md.utils.escapeHtml(info)}</span>` : '';
    return `<div class="code-block">${label}<button class="copy-button" type="button" aria-label="Copy code">Copy</button>${rendered}</div>\n`;
  };
}

/** Tables need a scroll container so wide content never scrolls the page body. */
function installTableWrapper(md: MarkdownIt): void {
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';
}

function collectHeadings(md: MarkdownIt, tokens: ReturnType<MarkdownIt['parse']>): Heading[] {
  const headings: Heading[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token || token.type !== 'heading_open') continue;
    const level = Number(token.tag.slice(1));
    if (level < 2 || level > 3) continue;
    const inline = tokens[i + 1];
    const id = token.attrGet('id');
    if (!inline || !id) continue;
    headings.push({ level, id, text: inlineText(inline.children ?? []) });
  }

  return headings;
}

function inlineText(children: { type: string; content: string }[]): string {
  return children
    .filter((child) => child.type === 'text' || child.type === 'code_inline')
    .map((child) => child.content)
    .join('')
    .trim();
}

/** Resolve a relative link against the page's own directory, POSIX-style. */
function resolveFromPage(target: string, page: Page): string {
  if (target.startsWith('/')) return target.replace(/^\/+/, '');
  const dir = path.posix.dirname(page.relPath);
  return path.posix.normalize(dir === '.' ? target : `${dir}/${target}`).replace(/^\/+/, '');
}

/** Crude Markdown → text used only for the search index. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_>#|-]+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
