---
title: CLI
order: 2
---

# CLI

## `docuservice build [dir]`

Builds the site. Accepts `--out`, `--base` and `--quiet`.

## `docuservice serve [dir]`

Builds, then serves the result on `http://localhost:4321` and rebuilds on change.
Accepts `--port`.

## `docuservice init [dir]`

Writes `docuservice.json` and `azure-pipelines.yml` into an existing repository.
Existing files are left alone unless `--force` is passed.
