import type { RenderedPage, SearchDoc } from './types.js';

const MAX_CHARS_PER_DOC = 1200;

/**
 * Build a flat search index. One entry per H2 section keeps results specific
 * enough to deep-link, while staying small enough to ship as a single JSON file.
 */
export function buildSearchIndex(pages: RenderedPage[]): SearchDoc[] {
  const docs: SearchDoc[] = [];

  for (const page of pages) {
    const sections = splitSections(page);
    if (sections.length === 0) {
      docs.push({
        url: page.url,
        title: page.title,
        section: '',
        text: page.text.slice(0, MAX_CHARS_PER_DOC),
      });
      continue;
    }
    docs.push(...sections);
  }

  return docs;
}

function splitSections(page: RenderedPage): SearchDoc[] {
  const h2s = page.headings.filter((heading) => heading.level === 2);
  if (h2s.length === 0) return [];

  const text = page.text;
  const docs: SearchDoc[] = [];
  const intro = sliceUntil(text, h2s[0]?.text ?? '');
  if (intro.trim()) {
    docs.push({ url: page.url, title: page.title, section: '', text: intro.slice(0, MAX_CHARS_PER_DOC) });
  }

  h2s.forEach((heading, index) => {
    const start = indexOfHeading(text, heading.text);
    if (start < 0) return;
    const nextHeading = h2s[index + 1];
    const end = nextHeading ? indexOfHeading(text, nextHeading.text, start + 1) : text.length;
    docs.push({
      url: `${page.url}#${heading.id}`,
      title: page.title,
      section: heading.text,
      text: text.slice(start, end < 0 ? text.length : end).slice(0, MAX_CHARS_PER_DOC),
    });
  });

  return docs;
}

function indexOfHeading(text: string, heading: string, from = 0): number {
  return heading ? text.indexOf(heading, from) : -1;
}

function sliceUntil(text: string, heading: string): string {
  const index = indexOfHeading(text, heading);
  return index < 0 ? text : text.slice(0, index);
}
