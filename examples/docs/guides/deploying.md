---
title: Deploying to Azure
order: 2
---

# Deploying to Azure

## Create the Static Web App

In the Azure portal, create a Static Web App with deployment source **Other**.
Copy the deployment token from *Manage deployment token*.

## Add the pipeline

Run `docuservice init` in the repository root. It writes `azure-pipelines.yml`
and `docuservice.json`. Commit both, then create a pipeline from the existing
YAML file.

## Store the token

Add a secret pipeline variable named `AZURE_STATIC_WEB_APPS_API_TOKEN` holding the
token you copied. Never commit the token itself.

| Variable | Secret | Purpose |
| --- | --- | --- |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | Yes | Authenticates the deployment |
| `DOCS_OUTPUT_DIR` | No | Build output folder, defaults to `site` |

> Pull request builds publish to a temporary staging URL, so reviewers can read
> the rendered docs before the change merges.
