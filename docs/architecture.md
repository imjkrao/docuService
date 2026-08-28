# Architecture

docuservice is a single-pass static site generator. There is no server, no
database and no runtime dependency once the site is built — the output is plain
files that Azure Static Web Apps serves from its CDN.

## Pipeline

```
Markdown files ──▶ discover ──▶ render ──▶ nav ──▶ emit ──▶ site/
                     │            │         │        │
                  front matter  markdown-it  folder   HTML, assets,
                  titles, URLs  link rewrite  tree    search index,
                  git dates     highlight            staticwebapp.config.json
```

| Stage | Module | Responsibility |
| --- | --- | --- |
| Config | `src/config.ts` | Load optional `docuservice.json` over defaults |
| Discover | `src/discover.ts` | Walk the tree, parse front matter, derive title/URL/slug |
| Git | `src/git.ts` | Last-updated dates; infer Azure Repos coordinates from `origin` |
| Render | `src/markdown.ts` | Markdown → HTML, link/image rewriting, highlighting, headings |
| Navigate | `src/nav.ts` | Folder tree → sidebar; flatten for prev/next |
| Layout | `src/render.ts` | HTML shell, sidebar, TOC, footer, search dialog |
| Search | `src/search.ts` | Section-level index emitted as one JSON file |
| Azure | `src/swa.ts` | `staticwebapp.config.json` |
| Orchestrate | `src/build.ts` | Runs the above, writes the output tree |

## Design decisions

**Convention over configuration.** The product thesis is that a repo full of
`.md` files already contains enough structure to build a site. Folder layout is
the navigation; `README.md`/`index.md` is the section landing page; the first
`# heading` is the title. Configuration exists only to override.

**Link rewriting is non-negotiable.** Markdown in a repo is written to be read
*in* the repo — links point at `.md` files. A generator that leaves those alone
produces a site full of broken links. Every relative link is resolved against
the page's own directory and mapped onto the built URL, preserving anchors and
query strings. Anything that resolves to a directory becomes a link
into Azure Repos — copying a linked folder would pull entire sibling projects
into the site — and anything else that exists on disk is copied as an asset.

**Build-time syntax highlighting.** Highlighting runs during the build with
highlight.js rather than shipping a highlighter to the browser. Enterprise
tenants frequently run strict Content Security Policies and block third-party
CDNs; the generated site loads no external script. Mermaid is the one exception
(it needs a browser to lay out diagrams) and can be turned off with
`"mermaid": false`.

**Search without a service.** The index is a single JSON file of per-H2 sections,
scored client-side: every term must match, with title and section hits weighted
above body hits. This holds up well into the low thousands of pages and costs
nothing to operate. Sites larger than that want Azure AI Search — a natural
paid tier rather than a default.

**Deterministic output.** No hashes in asset names and stable ordering, so
rebuilding unchanged content produces an identical tree. That keeps Static Web
Apps deployments small and diffs reviewable.

## Output layout

```
site/
├── index.html
├── 404.html
├── guides/
│   ├── index.html
│   └── setup/index.html
├── assets/
│   ├── styles.css
│   └── app.js
├── search-index.json
├── sitemap.txt
└── staticwebapp.config.json
```

Directory-style URLs (`/guides/setup/`) mean no server-side rewriting is needed
for clean URLs — Static Web Apps serves `index.html` from each directory.

## Extension points

The pieces most likely to need customer-specific behaviour are already isolated:

- **Theme** — `src/theme/` is copied verbatim into `site/assets/`. A customer
  theme is a directory swap, not a code change.
- **Layout** — `renderPage()` takes a single `LayoutInput`; alternative layouts
  slot in without touching discovery or rendering.
- **Markdown** — `createRenderer()` owns one `MarkdownIt` instance. Plugins
  (admonitions, tabs, includes, OpenAPI) attach there.
- **Emit** — `build.ts` writes the index and Azure config through small pure
  functions, so alternative targets (Blob Storage, App Service) are additive.
