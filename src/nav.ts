import type { NavNode, Page } from './types.js';
import { humanize } from './discover.js';

interface FolderNode {
  title: string;
  url: string | null;
  order: number;
  children: Map<string, FolderNode>;
  pages: NavNode[];
}

/**
 * Build the sidebar tree from the folder layout.
 * A folder inherits its title and URL from its index page when one exists.
 */
export function buildNav(pages: Page[]): NavNode[] {
  const root: FolderNode = { title: '', url: null, order: 0, children: new Map(), pages: [] };

  for (const page of pages) {
    if (page.isHome) continue;

    const folder = page.segments.reduce<FolderNode>((node, segment) => {
      let child = node.children.get(segment);
      if (!child) {
        child = {
          title: humanize(segment),
          url: null,
          order: orderOfSegment(segment),
          children: new Map(),
          pages: [],
        };
        node.children.set(segment, child);
      }
      return child;
    }, root);

    if (page.isIndex && page.segments.length > 0) {
      folder.title = page.title;
      folder.url = page.url;
      if (typeof page.frontMatter.order === 'number') folder.order = page.frontMatter.order;
      continue;
    }

    folder.pages.push({
      title: page.title,
      url: page.url,
      order: typeof page.frontMatter.order === 'number' ? page.frontMatter.order : Number.MAX_SAFE_INTEGER,
      children: [],
    });
  }

  return toNavNodes(root);
}

function toNavNodes(node: FolderNode): NavNode[] {
  const folders: NavNode[] = [...node.children.values()].map((child) => ({
    title: child.title,
    url: child.url,
    order: child.order,
    children: toNavNodes(child),
  }));

  return [...node.pages, ...folders].sort(byOrderThenTitle);
}

function byOrderThenTitle(a: NavNode, b: NavNode): number {
  if (a.order !== b.order) return a.order - b.order;
  const aLeaf = a.children.length === 0;
  const bLeaf = b.children.length === 0;
  if (aLeaf !== bLeaf) return aLeaf ? -1 : 1;
  return a.title.localeCompare(b.title);
}

/** A folder named "02-guides" sorts by 2 without leaking the prefix into the title. */
function orderOfSegment(segment: string): number {
  const match = segment.match(/^(\d+)[-_.]/);
  return match?.[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/** Flat, document-order list of page URLs used for prev/next links. */
export function flattenNav(nodes: NavNode[]): { title: string; url: string }[] {
  const flat: { title: string; url: string }[] = [];
  const visit = (list: NavNode[]): void => {
    for (const node of list) {
      if (node.url) flat.push({ title: node.title, url: node.url });
      visit(node.children);
    }
  };
  visit(nodes);
  return flat;
}
