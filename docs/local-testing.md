# Running from source

`docuservice` is on npm, so `npx docuservice` works. Run it from source when you
are changing the tool itself, or testing a fix before it ships. Three ways, in
order of how much you want it to feel like the released package.

## Prerequisites

Node.js 20 or later, and git.

```bash
git clone https://github.com/imjkrao/docuService.git
cd docuService
npm install
npm run build
```

`npm run build` compiles TypeScript into `dist/` and copies the theme. Rerun it
after any change to `src/`.

## Option 1 — run it in place (quickest)

No install step. Point it at any folder of Markdown on your machine:

```bash
node dist/cli.js build /path/to/your/repo --out /tmp/site
node dist/cli.js serve /path/to/your/repo
```

`serve` builds, opens on <http://localhost:4321>, and rebuilds as you edit.

To see it working against the bundled sample first:

```bash
npm run dev      # serves examples/docs
```

## Option 2 — `npm link` (behaves like a global install)

Puts a real `docuservice` command on your `PATH`, backed by your working copy —
so edits show up after a rebuild, with no reinstall.

```bash
npm link                          # from the docuService checkout
cd /path/to/your/repo
docuservice build . --out ./site
```

Undo it with `npm unlink -g docuservice`.

On macOS or Linux, if `npm link` fails with `EACCES`, point npm at a directory
you own rather than using sudo:

```bash
npm config set prefix ~/.npm-global
export PATH="$HOME/.npm-global/bin:$PATH"   # add to ~/.zshrc or ~/.bashrc
```

## Option 3 — build a tarball (closest to a published package)

This is exactly what `npm publish` would upload, so it catches packaging
mistakes — a missing file in `files`, a broken `bin` path — that Options 1 and 2
hide.

```bash
npm pack                          # writes docuservice-<version>.tgz
npm install -g ./docuservice-0.2.0.tgz
docuservice --help
```

Uninstall with `npm uninstall -g docuservice`.

A tarball is also how you run an unreleased fix through a real pipeline — see below.

## Trying it on a real repository

The point of the tool is that it needs nothing from you, so test it that way:
clone a repo that already has Markdown in it, and run the build without adding
any config.

```bash
cd /path/to/some/repo/with/docs
docuservice serve .
```

Things worth checking on your own content:

- Does the sidebar match how you think about the docs, or do you need `order:`
  front matter or numbered folders?
- Do cross-file links land on the right pages? Broken ones point at files that
  are excluded, or paths that never existed.
- Do images show up? Anything referenced but missing on disk is skipped
  silently.
- Is anything in the site that should not be? Add it to `exclude`.

## Installing the CLI in Azure Pipelines

The generated `azure-pipelines.yml` installs the CLI from a variable:

```yaml
variables:
  DOCUSERVICE_PACKAGE: docuservice
```

The default pulls the published package from npm and needs no changes. Point the
variable elsewhere when the agent cannot reach npmjs.org, or when you want to
pin an unreleased build:

> Agents with no npm access at all are better served by the
> [Azure DevOps extension](extension.md), which bundles the CLI and installs
> nothing at run time.

**Azure Artifacts feed** — the right answer when the agent has no public npm
access, or when you want an internal mirror with an upstream source.

```bash
npm publish --registry https://pkgs.dev.azure.com/<org>/_packaging/<feed>/npm/registry/
```

Add an `.npmrc` pointing at the feed plus an `npmAuthenticate@0` task before the
build step, and leave `DOCUSERVICE_PACKAGE` as `docuservice`.

**A tarball committed to the repo** — ugly, but it needs no infrastructure and
is a reasonable way to test an unreleased fix on a real pipeline:

```yaml
variables:
  DOCUSERVICE_PACKAGE: tools/docuservice-0.2.0.tgz
```

**A git URL** — if the agent can authenticate to the repository:

```yaml
variables:
  DOCUSERVICE_PACKAGE: git+https://github.com/imjkrao/docuService.git#main
```

Note this installs from source, so the agent needs `devDependencies` and a build
step; a tarball or feed avoids that.

## Deploying the output without a pipeline

The build output is plain static files, so you can push it straight from your
laptop to test hosting:

```bash
npm install -g @azure/static-web-apps-cli
swa deploy ./site --deployment-token <token> --env production
```

Get the token from **Manage deployment token** on the Static Web App in the
Azure portal. Treat it as a secret — do not commit it.
