/** Shared shapes used across discovery, rendering and navigation. */

export interface SiteConfig {
  /** Product/site name shown in the header and <title> suffix. */
  title: string;
  /** Optional tagline rendered under the title on the home page. */
  description: string;
  /** Root-relative base path, e.g. "/" or "/docs/". Always starts and ends with "/". */
  base: string;
  /** Directory (relative to the docs root) scanned for Markdown. */
  srcDir: string;
  /** Output directory for the generated site. */
  outDir: string;
  /** Glob-ish path fragments excluded from discovery. */
  exclude: string[];
  /** Theme + branding knobs. */
  theme: ThemeConfig;
  /** Azure Repos linkage used for "Edit this page" and metadata. */
  repo: RepoConfig | null;
  /** Emit staticwebapp.config.json alongside the site. */
  emitSwaConfig: boolean;
  /** Generate a client-side search index. */
  search: boolean;
  /** Render ```mermaid fences as diagrams. */
  mermaid: boolean;
}

export interface ThemeConfig {
  /** Accent colour used for links, active nav and focus rings. */
  accent: string;
  /** Absolute or site-relative URL of a logo image. */
  logo: string | null;
  /** Footer line, supports plain text. */
  footer: string | null;
  /** "auto" respects the OS setting; "light"/"dark" force one. */
  defaultColorScheme: 'auto' | 'light' | 'dark';
}

export interface RepoConfig {
  /** Azure DevOps organisation, e.g. "contoso". */
  organization: string;
  /** Azure DevOps project name. */
  project: string;
  /** Repository name. */
  repository: string;
  /** Branch used for edit links. */
  branch: string;
  /** Path inside the repo that srcDir corresponds to. */
  pathPrefix: string;
}

/** Front matter recognised on a page. Everything is optional. */
export interface FrontMatter {
  title?: string;
  description?: string;
  order?: number;
  hidden?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface Page {
  /** Absolute path on disk. */
  sourcePath: string;
  /** Path relative to srcDir, POSIX separators, e.g. "guides/setup.md". */
  relPath: string;
  /** Output path relative to outDir, e.g. "guides/setup/index.html". */
  outPath: string;
  /** Site-relative URL including base, e.g. "/guides/setup/". */
  url: string;
  /** Directory segments used to place the page in the nav tree. */
  segments: string[];
  title: string;
  frontMatter: FrontMatter;
  /** Raw Markdown with front matter stripped. */
  body: string;
  /** True when the file is the index (index.md / README.md) of its folder. */
  isIndex: boolean;
  /** True when this is the site home page. */
  isHome: boolean;
  /** ISO date of the last commit touching the file, when git is available. */
  lastUpdated: string | null;
}

export interface RenderedPage extends Page {
  html: string;
  headings: Heading[];
  /** Plain text used for the search index. */
  text: string;
}

export interface Heading {
  level: number;
  id: string;
  text: string;
}

export interface NavNode {
  title: string;
  /** Present for pages and for folders that have an index page. */
  url: string | null;
  order: number;
  children: NavNode[];
}

export interface SearchDoc {
  url: string;
  title: string;
  section: string;
  text: string;
}
