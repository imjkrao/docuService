---
title: Configuration
order: 1
---

# Configuration

Everything is optional. A repository with no `docuservice.json` still builds.

## Top-level keys

| Key | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | string | repo name | Shown in the header |
| `srcDir` | string | `.` | Folder scanned for Markdown |
| `outDir` | string | `site` | Build output |
| `base` | string | `/` | Set when hosting under a sub-path |
| `exclude` | string[] | see below | Path segments skipped during discovery |
| `search` | boolean | `true` | Generate the client-side search index |
| `mermaid` | boolean | `true` | Render ` ```mermaid ` fences as diagrams |

## Theme

```json
{
  "theme": {
    "accent": "#0078d4",
    "logo": "/assets/logo.svg",
    "footer": "© Contoso",
    "defaultColorScheme": "auto"
  }
}
```

## Repository linkage

`docuservice` reads `remote.origin.url` and derives the Azure DevOps
organisation, project and repository automatically. Override it only when the
docs live in a different repository from the one being built.
