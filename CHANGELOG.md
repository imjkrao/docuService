# Changelog

All notable changes to this project are documented here. Versions follow
[semantic versioning](https://semver.org); while the package is below 1.0, a
minor bump may carry a behavioural change.

## 0.2.0

Everything here came out of running 0.1.0 against a real Azure repository —
a Data Analytics repo full of Power BI projects — rather than a sample.

### Fixed

- **Links to anything containing a space never resolved.** markdown-it
  normalises hrefs, so a target arrived percent-encoded (`My%20Folder`) while
  the filesystem and page map held the decoded name. Page links produced dead
  URLs and images were never copied, both silently. Targets are now decoded
  before resolution and re-encoded per segment for site URLs.
- **A link to a folder copied the whole folder into the site.** A linked Power
  BI project dragged in locked `.pbi` directories that the next build then
  could not delete. Folder links now resolve to the folder in Azure Repos.
- **The docs pipeline watched the wrong file.** When `init` diverted around an
  existing `azure-pipelines.yml`, the generated `azure-pipelines-docs.yml` still
  filtered on `azure-pipelines.yml` — so editing the application pipeline
  triggered a docs build, while editing the docs pipeline did not.
- The multi-stage pipeline template had no path filter and ran on every commit
  to `main`.

### Changed

- **`init` never overwrites a pipeline it did not generate.** An existing
  `azure-pipelines.yml` is left alone and the docs pipeline is written to
  `azure-pipelines-docs.yml`, which Azure DevOps runs as its own definition.
  `--force` refreshes docuservice's own files and cannot clobber a foreign one.
  Generated YAML carries a `# docuservice:generated` marker.
- `init` prints a `PublishDocs` job for teams who would rather add the docs
  build to a pipeline they already maintain, and accepts `--pipeline <file>`.
- Folder links open in a new tab with `rel="noopener noreferrer"`, since they
  leave the site. With no `repo` configured there is nowhere correct to send
  them, so the author's link is left untouched and the build reports the count.

### API

- `BuildResult.skippedDirectories` now means "folder links that could not be
  pointed anywhere", and `BuildResult.repoLinkedDirectories` lists those that
  resolved to Azure Repos.
- Added `scanSource()`, which returns pages and directories from one walk.
  `discoverPages()` is unchanged.
- Added `repoPathUrl()`, which deep links to any repository path. `editUrl()`
  is now a thin wrapper over it.

## 0.1.0

Initial release.

- `build`, `serve` and `init` commands.
- Navigation derived from folder structure; numeric prefixes order without
  reaching the URL.
- Relative `.md` links rewritten to built URLs; referenced assets copied.
- Client-side search over a compile-time index.
- Per-page table of contents, previous/next links, anchored headings.
- Build-time syntax highlighting and Mermaid diagrams.
- "Edit this page in Azure Repos" and last-updated dates inferred from git.
- Light and dark themes, responsive, keyboard accessible.
- Emits `staticwebapp.config.json` for Azure Static Web Apps.
- Azure Pipelines templates, single-stage and multi-stage.

### Fixed after the initial publish

- **`serve` rebuilt in a loop.** The output directory sits inside the directory
  being watched, so every file the build wrote woke the watcher that produced
  it. On Windows this surfaced as repeated `EPERM` on rmdir. ([#2])

[#2]: https://github.com/imjkrao/docuService/issues/2
