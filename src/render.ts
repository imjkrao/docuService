import type { NavNode, RenderedPage, SiteConfig } from './types.js';
import { editUrl } from './git.js';

export interface LayoutInput {
  page: RenderedPage;
  nav: NavNode[];
  config: SiteConfig;
  prev: { title: string; url: string } | null;
  next: { title: string; url: string } | null;
}

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';

export function renderPage(input: LayoutInput): string {
  const { page, config } = input;
  const title = page.isHome ? config.title : `${page.title} · ${config.title}`;
  const description = String(page.frontMatter.description ?? config.description ?? '');

  return `<!doctype html>
<html lang="en" data-color-scheme="${config.theme.defaultColorScheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
<meta property="og:title" content="${escapeHtml(title)}">
${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ''}
<link rel="stylesheet" href="${config.base}assets/styles.css">
<style>:root{--accent:${escapeHtml(config.theme.accent)}}</style>
<script>
  (function () {
    try {
      var stored = localStorage.getItem('docuservice-theme');
      if (stored === 'light' || stored === 'dark') {
        document.documentElement.setAttribute('data-color-scheme', stored);
      }
    } catch (e) { /* private mode: keep the configured default */ }
  })();
</script>
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>
${renderHeader(config)}
<div class="layout">
  <aside class="sidebar" id="sidebar" aria-label="Documentation navigation">
    <nav>${renderNav(input.nav, page.url)}</nav>
  </aside>
  <main class="content" id="content">
    <article class="prose">
      <h1>${escapeHtml(page.title)}</h1>
      ${description && page.isHome ? `<p class="lede">${escapeHtml(description)}</p>` : ''}
      ${page.html}
    </article>
    ${renderPageFooter(input)}
  </main>
  ${renderToc(page)}
</div>
${renderSearchDialog(config)}
<script src="${config.base}assets/app.js" defer></script>
${config.mermaid ? renderMermaid() : ''}
</body>
</html>
`;
}

function renderHeader(config: SiteConfig): string {
  const logo = config.theme.logo
    ? `<img class="brand-logo" src="${escapeHtml(config.theme.logo)}" alt="">`
    : '';
  return `<header class="topbar">
  <button class="icon-button sidebar-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="sidebar">☰</button>
  <a class="brand" href="${config.base}">${logo}<span>${escapeHtml(config.title)}</span></a>
  <div class="topbar-actions">
    ${config.search ? '<button class="search-trigger" type="button" data-search-open>Search<kbd>/</kbd></button>' : ''}
    <button class="icon-button theme-toggle" type="button" aria-label="Toggle colour scheme">◐</button>
  </div>
</header>`;
}

function renderNav(nodes: NavNode[], currentUrl: string): string {
  if (nodes.length === 0) return '';

  const items = nodes
    .map((node) => {
      const isCurrent = node.url === currentUrl;
      const label = escapeHtml(node.title);
      const link = node.url
        ? `<a href="${node.url}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a>`
        : `<span class="nav-group-label">${label}</span>`;
      const children = node.children.length
        ? `<div class="nav-group">${renderNav(node.children, currentUrl)}</div>`
        : '';
      return `<li class="${node.children.length ? 'nav-group-item' : 'nav-leaf'}">${link}${children}</li>`;
    })
    .join('\n');

  return `<ul class="nav-list">${items}</ul>`;
}

function renderToc(page: RenderedPage): string {
  if (page.headings.length < 2) return '<div class="toc-spacer"></div>';
  const items = page.headings
    .map(
      (heading) =>
        `<li class="toc-h${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join('\n');
  return `<aside class="toc" aria-label="On this page">
  <p class="toc-title">On this page</p>
  <ul>${items}</ul>
</aside>`;
}

function renderPageFooter(input: LayoutInput): string {
  const { page, config, prev, next } = input;

  const meta: string[] = [];
  if (page.lastUpdated) {
    const date = new Date(page.lastUpdated);
    if (!Number.isNaN(date.getTime())) {
      meta.push(
        `<span>Last updated <time datetime="${escapeHtml(page.lastUpdated)}">${date.toISOString().slice(0, 10)}</time></span>`,
      );
    }
  }
  if (config.repo) {
    meta.push(
      `<a class="edit-link" href="${escapeHtml(editUrl(config.repo, page.relPath))}" target="_blank" rel="noopener noreferrer">Edit this page in Azure Repos</a>`,
    );
  }

  const pager =
    prev || next
      ? `<nav class="pager" aria-label="Page navigation">${[
          prev
            ? `<a class="pager-link pager-prev" href="${prev.url}"><span>Previous</span><strong>${escapeHtml(prev.title)}</strong></a>`
            : '<span></span>',
          next
            ? `<a class="pager-link pager-next" href="${next.url}"><span>Next</span><strong>${escapeHtml(next.title)}</strong></a>`
            : '<span></span>',
        ].join('\n')}</nav>`
      : '';

  return `<footer class="page-footer">
  <div class="page-meta">${meta.join('')}</div>
  ${pager}
  ${config.theme.footer ? `<p class="site-footer">${escapeHtml(config.theme.footer)}</p>` : ''}
</footer>`;
}

function renderSearchDialog(config: SiteConfig): string {
  if (!config.search) return '';
  return `<div class="search-overlay" data-search-overlay hidden>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search documentation">
    <input class="search-input" type="search" placeholder="Search the docs…" autocomplete="off" data-search-input>
    <ul class="search-results" data-search-results></ul>
    <p class="search-empty" data-search-empty hidden>No matches.</p>
  </div>
</div>
<script>window.__DOCUSERVICE_SEARCH__ = ${JSON.stringify(`${config.base}search-index.json`)};</script>`;
}

function renderMermaid(): string {
  return `<script type="module">
  if (document.querySelector('.mermaid')) {
    try {
      const { default: mermaid } = await import(${JSON.stringify(MERMAID_CDN)});
      const dark = getComputedStyle(document.documentElement).getPropertyValue('--is-dark').trim() === '1';
      mermaid.initialize({ startOnLoad: true, theme: dark ? 'dark' : 'default' });
    } catch (error) {
      console.warn('Mermaid could not be loaded; diagrams are shown as source.', error);
    }
  }
</script>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
