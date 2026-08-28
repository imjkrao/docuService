# Azure templates

Drop-in pipeline definitions for publishing a Markdown repository as an Azure
Static Web App. `docuservice init` writes `azure-pipelines.yml` into your
repository root; the copies here are for reference and for teams that prefer to
vendor the YAML by hand.

| File | Use it when |
| --- | --- |
| `azure-pipelines.yml` | Single environment: every push to `main` publishes production. |
| `azure-pipelines.multistage.yml` | Separate staging and production Static Web Apps with a manual approval between them. |

## When you already have an azure-pipelines.yml

Most repositories do, driving the application build. `docuservice init` never
edits it. The docs pipeline is written to `azure-pipelines-docs.yml` and you
create a second pipeline definition pointing at that file — Azure DevOps is
happy to run any number of YAML definitions from one repository, each with its
own triggers.

Prefer a single definition? Add the docs build as another job in the pipeline you
already have. `docuservice init` prints a ready-made `PublishDocs` job for exactly
this; `--pipeline <file>` writes to a filename you choose.

Note the `paths` filter in the templates: the docs pipeline only runs when
Markdown actually changes, so it does not fire on every application commit.

## One-time setup

1. Create a Static Web App in the Azure portal with **Deployment source: Other**.
2. Copy the deployment token from *Manage deployment token*.
3. In Azure DevOps, add a **secret** pipeline variable
   `AZURE_STATIC_WEB_APPS_API_TOKEN` with that value.
4. Create the pipeline from the existing YAML file and run it.

Pull request builds publish to a Static Web Apps staging environment
automatically, so reviewers read the rendered page rather than the diff.
