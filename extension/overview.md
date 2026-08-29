# DocuService

**Publish the Markdown already in your Azure Repo as a static website — without moving the files, restructuring the repo, or learning a site generator.**

Your team writes `.md` files and commits them. The files are good. They are also close to unreadable: people browse them one at a time through the Azure Repos file viewer, with no search across the set, no navigation, and no link to send anyone outside the team.

This task closes the last hundred metres between *files that exist* and *a site people can read*.

## Add it to a pipeline

```yaml
- task: DocuServiceBuild@1
  inputs:
    sourceDirectory: '$(Build.SourcesDirectory)'
    outputDirectory: 'site'

- task: AzureStaticWebApp@0
  inputs:
    app_location: '$(DocuServiceBuild.outputDirectory)'
    output_location: ''
    skip_app_build: true
    skip_api_build: true
    azure_static_web_apps_api_token: $(AZURE_STATIC_WEB_APPS_API_TOKEN)
```

That is the whole setup. There is no configuration file to write — a repository of Markdown is already valid input.

> **Tip:** add `fetchDepth: 0` to your `checkout` step so "Last updated" dates come from real commits rather than a shallow clone.

## What you get

- **Navigation derived from your folders.** No sidebar file to maintain. A numeric prefix (`01-guides/`) controls order without appearing in the URL.
- **Working internal links.** `[setup](guides/setup.md)` is rewritten to the built page URL, anchors and all. Links to *folders* resolve to that folder in Azure Repos. Images and other referenced files are copied.
- **Search across the whole set**, from an index built at compile time — one JSON file, no search service to run or pay for.
- **Per-page table of contents**, previous/next links, and anchored headings.
- **"Edit this page in Azure Repos"**, deep-linked to the file on the right branch. Read from your git remote; nothing to configure.
- **"Last updated"** dates taken from the commit that last touched each file.
- **Light and dark themes**, responsive down to mobile, keyboard accessible.
- **`staticwebapp.config.json`** emitted alongside the site, so 404s, caching and baseline security headers work on Azure with no extra setup.

## Works on locked-down agents

The `docuservice` CLI is bundled inside this extension. The task installs nothing at run time, so it works on self-hosted agents behind a firewall with no access to npmjs.org.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `sourceDirectory` | `$(Build.SourcesDirectory)` | Folder holding the Markdown, and optionally `docuservice.json` |
| `outputDirectory` | `site` | Where the site is written. Relative paths resolve against the source directory |
| `basePath` | `/` | Set when hosting under a sub-path, e.g. `/docs/` |
| `quiet` | `false` | Log only the summary instead of one line per page |

**Output variable:** `DocuServiceBuild.outputDirectory` — the absolute path of the generated site, for the deployment task that follows.

## Configuration is optional

Every default works. To brand the site, drop a `docuservice.json` next to your Markdown:

```json
{
  "title": "Platform Docs",
  "theme": {
    "accent": "#0078d4",
    "footer": "© Contoso"
  }
}
```

Full reference: [configuration](https://github.com/imjkrao/docuService/blob/main/docs/configuration.md).

## How it decides things

| Input | Result |
| --- | --- |
| `README.md` or `index.md` in a folder | That folder's landing page and title |
| `docs/guides/setup.md` | `/guides/setup/` |
| `docs/02-reference/api.md` | `/reference/api/`, sorted second |
| `order:` in front matter | Explicit sidebar position |
| `hidden: true` | Excluded from the build |
| No root `index.md` / `README.md` | A home page is generated listing each section |

## Also available as a CLI

The same tool runs locally, so you can preview before pushing:

```bash
npx docuservice serve ./docs
```

[docuservice on npm](https://www.npmjs.com/package/docuservice)

## Links

- [Documentation](https://github.com/imjkrao/docuService#readme)
- [Configuration reference](https://github.com/imjkrao/docuService/blob/main/docs/configuration.md)
- [Architecture](https://github.com/imjkrao/docuService/blob/main/docs/architecture.md)
- [Changelog](https://github.com/imjkrao/docuService/blob/main/CHANGELOG.md)
- [Report an issue](https://github.com/imjkrao/docuService/issues)

Released under the MIT licence.
