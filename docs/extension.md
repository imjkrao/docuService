# The Azure DevOps extension

`docuservice` also ships as an Azure Pipelines task, so adopting it is **Add task →
fill two fields** instead of hand-written YAML. The CLI is bundled inside the extension,
so the task installs nothing at run time and works on agents with no access to npmjs.org.

This page is for maintaining and publishing the extension. Users of the task want
[`extension/overview.md`](../extension/overview.md), which becomes the Marketplace listing.

## Layout

```
extension/
├── vss-extension.json          # extension manifest
├── overview.md                 # Marketplace listing body
├── images/extension-icon.png   # generated; replace with a real design
├── scripts/
│   ├── make-icon.mjs           # regenerates the placeholder icon
│   └── stage.mjs               # prepares the tree for tfx
└── DocuServiceBuild/           # task folder; name must match the manifest contribution
    ├── task.json
    ├── index.ts                # wrapper: read inputs → spawn the bundled CLI
    ├── package.json
    └── tsconfig.json
```

The extension deliberately lives outside the npm package. The root `package.json` is
`"type": "module"` while `azure-pipelines-task-lib` is CommonJS, so the task carries its
own `package.json` and `node_modules`. The npm `files` array is untouched — no extension
bytes reach npm consumers.

## Build and package

```bash
npm run ext:build      # install task deps, compile index.ts
npm run ext:package    # stage, prune to production deps, produce the .vsix
```

`ext:package` writes to `extension/dist/`, which is gitignored along with `*.vsix`.

`extension/scripts/stage.mjs` does two things `tfx` cannot:

1. Copies the root `LICENSE` into `extension/`, because a manifest can only reference
   files at or below its own directory. Copying beats committing a second licence file
   that would silently drift from the original.
2. Reinstalls the task's dependencies with `--omit=dev`, so TypeScript and the type
   packages do not ship. It then asserts the bundled CLI is present, because a package
   missing it would install cleanly and fail on every agent.

## Testing without an agent

`tests/extension.test.js` runs the compiled task the way an agent does — inputs as
`INPUT_*` environment variables — and asserts on the logging commands it emits. The tests
skip when the task has not been built, so a fresh clone's `npm test` still passes.

Two things worth knowing if you extend those tests:

- **A failing task still exits 0.** `tl.setResult` signals failure through a
  `##vso[task.complete result=Failed]` log command that the agent parses. Assert on the
  output, never on the exit code.
- **`tl.loc()` needs `tl.setResourcePath()`** pointing at `task.json`, or it emits the
  message key instead of the message.

To drive it by hand:

```bash
INPUT_SOURCEDIRECTORY="$(pwd)/examples/docs" \
INPUT_OUTPUTDIRECTORY=/tmp/site \
node extension/DocuServiceBuild/index.js
```

## Versioning

The extension version, the task version and the npm package version are all independent.

**Both `vss-extension.json` and `DocuServiceBuild/task.json` must be incremented** for a
change to take effect — Azure DevOps serves the cached task otherwise, and the symptom is
a pipeline that silently runs the old code. `CHANGELOG.md` tracks the npm package only.

When the bundled CLI should move to a newer `docuservice`, bump the dependency in
`extension/DocuServiceBuild/package.json`, then bump both versions above.

## Publishing

The manifest publishes under the **`imjkrao`** publisher. This must match the publisher
registered at <https://marketplace.visualstudio.com/manage> exactly, or the upload is
rejected.

1. **Create a PAT** with the **Marketplace → Publish** scope. This is one-time. `Publish`
   is the minimal scope that works; a token with `Publish` is accepted even where an
   administrator has restricted the creation of global PATs.
2. **Publish privately and share with your own organization first:**

   ```bash
   npx tfx extension publish --root extension --manifest-globs vss-extension.json \
     --share-with <your-org> --token <pat>
   ```

   Replace `<your-org>` with your Azure DevOps organization name — that is a different
   value from the publisher ID.

3. **Install it**: Organization settings → Extensions → *Shared with me* → Get it free.
4. **Go public** by setting `"public": true` in the manifest and republishing. This
   requires a **verified publisher**; verification is a separate Microsoft process, so
   start it early if a public listing is the goal. Private sharing works immediately.

Microsoft virus-scans every upload, so an extension is not live the instant it is
published.

## Using the task

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

Add `fetchDepth: 0` to the `checkout` step so "Last updated" dates come from real commits.

The task builds only. Deployment stays with Microsoft's `AzureStaticWebApp@0`, which
already handles staging environments for pull requests and token auth — and leaves the
output usable for any other target.

## Known follow-ups

- **The icon is a placeholder.** `npm run ext:icon` regenerates it; replace the PNG with a
  real design when one exists.
- **No screenshots.** The Marketplace listing would be stronger with one image of a
  rendered site.
- **No CI.** Packaging and publishing are manual. The Microsoft
  [Azure DevOps Extension Tasks](https://marketplace.visualstudio.com/items?itemName=ms-devlabs.vsts-developer-tools-build-tasks)
  automate version bump, package and publish once the manual path is proven.
- **No output variables beyond the path.** A `--json` flag on the CLI would let the task
  surface `pageCount`, `repoLinkedDirectories` and `skippedDirectories` as variables a
  later step could gate on. That needs an npm release, so it is deliberately deferred.
