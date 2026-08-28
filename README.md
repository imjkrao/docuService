# docuservice

**Turn the Markdown already sitting in your Azure Repo into a published static
website — without moving the files, restructuring the repo, or learning a site
generator.**

Teams write `.md` files and commit them. Publishing them is where it stalls:
every existing option asks you to adopt a whole documentation framework, add a
`mkdocs.yml` or `docusaurus.config.js`, restructure folders, and maintain a
sidebar file by hand. docuservice takes the opposite position — point it at a
folder of Markdown and it produces a complete site. Configuration is optional.

```bash
npx docuservice build ./docs --out ./site
```

## What it produces

A plain static site with no runtime server, ready for Azure Static Web Apps:

- **Navigation derived from your folders.** No sidebar file to maintain. A
  numeric prefix (`01-guides/`) controls order without leaking into the URL.
- **Working internal links.** `[setup](guides/setup.md)` is rewritten to the
  built page URL, anchors and all. Images and other referenced files are copied.
- **Client-side search** over an index built at compile time — one JSON file, no
  search service to run or pay for.
- **Per-page table of contents**, previous/next links, and anchored headings.
- **"Edit this page in Azure Repos"**, deep-linked to the file on the right
  branch. Coordinates are read from `remote.origin.url`; nothing to configure.
- **Links to folders resolve to Azure Repos.** `[project](powerbi/Sales.Report)`
  opens that folder in Azure DevOps rather than dragging the whole tree into the
  site or emitting a dead link.
- **"Last updated"** dates taken from the commit that last touched each file.
- **Build-time syntax highlighting** (no CDN, no client-side highlighter) and
  Mermaid diagrams from ` ```mermaid ` fences.
- **Light and dark themes**, responsive down to mobile, keyboard accessible.
- **`staticwebapp.config.json`** emitted alongside the site so 404s, caching and
  baseline security headers work on Azure without extra setup.

## Getting started

### 1. Try it locally

```bash
npx docuservice serve ./docs
```

Builds the site, serves it at `http://localhost:4321`, and rebuilds on change.

### 2. Wire it into Azure

```bash
npx docuservice init
```

Writes `docuservice.json` and `azure-pipelines.yml` into your repository.

If you already have an `azure-pipelines.yml` — most repositories do — it is left
untouched and the docs pipeline goes to `azure-pipelines-docs.yml` instead. Azure
DevOps runs that as its own pipeline definition, independent of your application
build. `init` also prints a job you can paste into an existing pipeline if you
would rather keep one definition. `--force` refreshes files docuservice
generated; it will not overwrite a pipeline it did not write.

Then:

1. Create a Static Web App in the Azure portal (**Deployment source: Other**).
2. Copy its deployment token.
3. Add a **secret** pipeline variable `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. Create the pipeline from the YAML file and run it.

Pull request builds deploy to a Static Web Apps staging environment, so
reviewers see the rendered page instead of a diff. See [`azure/`](azure/) for a
multi-stage variant with a manual approval before production.

## Commands

| Command | Purpose |
| --- | --- |
| `docuservice build [dir]` | Build the site. `--out`, `--base`, `--quiet` |
| `docuservice serve [dir]` | Preview with rebuild-on-change. `--port` |
| `docuservice init [dir]` | Scaffold `docuservice.json` + a pipeline. `--force`, `--pipeline <file>` |

## Configuration

Optional. Drop a `docuservice.json` next to your Markdown:

```json
{
  "title": "Platform Docs",
  "description": "Everything about running the platform.",
  "srcDir": ".",
  "outDir": "site",
  "base": "/",
  "exclude": ["node_modules", "CHANGELOG.md"],
  "search": true,
  "mermaid": true,
  "theme": {
    "accent": "#0078d4",
    "logo": "/img/logo.svg",
    "footer": "© Contoso",
    "defaultColorScheme": "auto"
  }
}
```

Every key has a working default — see
[`docs/configuration.md`](docs/configuration.md) for the full reference.

### Front matter

All fields are optional:

```markdown
---
title: Deploying to Azure
description: Shown in search results and meta tags.
order: 2
hidden: false
---
```

Without front matter the title comes from the first `# heading`, then from the
filename.

## How it decides things

| Input | Result |
| --- | --- |
| `README.md` or `index.md` in a folder | That folder's landing page and title |
| `docs/guides/setup.md` | `/guides/setup/` |
| `docs/02-reference/api.md` | `/reference/api/`, sorted second |
| `order:` in front matter | Explicit sidebar position |
| `hidden: true` | Excluded from the build entirely |
| No root `index.md`/`README.md` | A home page is generated listing each section |

## Development

```bash
npm install
npm run build     # compile TypeScript + copy theme assets
npm test          # unit tests + end-to-end build assertions
npm run demo      # build the sample docs in examples/
npm run dev       # serve the sample docs
```

Further reading: [running from source](docs/local-testing.md) ·
[architecture](docs/architecture.md) · [configuration](docs/configuration.md) ·
[changelog](CHANGELOG.md) · [product notes](docs/product.md).

## License

MIT
