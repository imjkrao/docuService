# Configuration reference

Everything is optional. A repository with no `docuservice.json` builds.

docuservice looks for `docuservice.json` (or `.docuservice.json`) in the
directory passed to the command.

## Top level

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | repository name, else `"Documentation"` | Header text and `<title>` suffix |
| `description` | string | `""` | Meta description, and the lede on the home page |
| `base` | string | `"/"` | Site base path. Set when hosting under a sub-path, e.g. `"/docs/"` |
| `srcDir` | string | `"."` | Directory scanned for Markdown, relative to the config file |
| `outDir` | string | `"site"` | Build output directory |
| `exclude` | string[] | see below | Path segments or exact relative paths skipped during discovery |
| `search` | boolean | `true` | Emit `search-index.json` and the search UI |
| `mermaid` | boolean | `true` | Render ` ```mermaid ` fences as diagrams |
| `emitSwaConfig` | boolean | `true` | Emit `staticwebapp.config.json` |
| `theme` | object | see below | Branding |
| `repo` | object | inferred from git | Azure Repos coordinates for edit links |

Default `exclude`: `node_modules`, `.git`, `.github`, `.azuredevops`, `dist`,
`build`, `out`, `vendor`, `.venv`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`.
Dot-prefixed files and directories are always skipped.

## `theme`

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `accent` | string | `"#0078d4"` | Any CSS colour. Used for links, active nav, focus rings |
| `logo` | string \| null | `null` | URL of an image shown beside the title |
| `footer` | string \| null | `null` | Footer line |
| `defaultColorScheme` | `"auto"` \| `"light"` \| `"dark"` | `"auto"` | Initial scheme; visitors can override and the choice persists |

## `repo`

Normally inferred from `remote.origin.url`. Set it explicitly when the docs are
built outside the repository they belong to.

| Key | Type | Description |
| --- | --- | --- |
| `organization` | string | Azure DevOps organisation |
| `project` | string | Project name |
| `repository` | string | Repository name |
| `branch` | string | Branch used for edit links. Defaults to the current branch, or `BUILD_SOURCEBRANCHNAME` in a pipeline |
| `pathPrefix` | string | Path inside the repo that `srcDir` corresponds to |

Set `repo` to `null` to suppress edit links entirely.

## Front matter

| Key | Type | Effect |
| --- | --- | --- |
| `title` | string | Overrides the derived page title |
| `description` | string | Meta description for the page |
| `order` | number | Sidebar position within its folder. Lower sorts first |
| `hidden` | boolean | Excludes the file from the build |

Unrecognised keys are preserved and ignored, so front matter used by other tools
does not need removing.

## Ordering rules

1. `order` in front matter, ascending.
2. A numeric prefix on a folder name (`02-reference/`) sets that folder's
   position and is stripped from the URL and title.
3. Otherwise alphabetical by title, with leaf pages before sub-folders.

## URL rules

| Source | URL |
| --- | --- |
| `README.md` or `index.md` at the root | `/` |
| `guides/setup.md` | `/guides/setup/` |
| `guides/index.md` | `/guides/` |
| `02-reference/api.md` | `/reference/api/` |
| `Getting Started.md` | `/getting-started/` |
