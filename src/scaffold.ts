import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { detectRepo } from './git.js';
import { defaultConfig } from './config.js';

export interface InitOptions {
  root: string;
  /** Overwrite files that already exist. */
  force: boolean;
}

export interface InitResult {
  written: string[];
  skipped: string[];
}

/** Drop the two files a customer needs into their existing Azure repo. */
export async function init(options: InitOptions): Promise<InitResult> {
  const root = path.resolve(options.root);
  const repo = await detectRepo(root, '');
  const written: string[] = [];
  const skipped: string[] = [];

  const files: Record<string, string> = {
    'docuservice.json': configTemplate(repo?.repository ?? path.basename(root)),
    'azure-pipelines.yml': pipelineTemplate(),
  };

  for (const [name, contents] of Object.entries(files)) {
    const target = path.join(root, name);
    if (existsSync(target) && !options.force) {
      skipped.push(name);
      continue;
    }
    await writeFile(target, contents, 'utf8');
    written.push(name);
  }

  return { written, skipped };
}

function configTemplate(title: string): string {
  const defaults = defaultConfig();
  return `${JSON.stringify(
    {
      title,
      description: 'Documentation built from Markdown in this repository.',
      srcDir: '.',
      outDir: 'site',
      exclude: defaults.exclude,
      theme: {
        accent: defaults.theme.accent,
        defaultColorScheme: 'auto',
        footer: `© ${new Date().getFullYear()} ${title}`,
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Azure Pipelines definition: build the site, then deploy it to Azure Static
 * Web Apps. The deployment token is read from a pipeline secret variable.
 */
function pipelineTemplate(): string {
  return `# Publishes the Markdown in this repository as an Azure Static Web App.
#
# Setup (once):
#   1. Create a Static Web App in the Azure portal (Deployment source: "Other").
#   2. Copy its deployment token.
#   3. In this pipeline, add a secret variable named AZURE_STATIC_WEB_APPS_API_TOKEN.

trigger:
  branches:
    include:
      - main
  paths:
    include:
      - '**/*.md'
      - docuservice.json
      - azure-pipelines.yml

pr:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  DOCS_OUTPUT_DIR: site

steps:
  - checkout: self
    # Full history so "Last updated" dates come from real commits.
    fetchDepth: 0

  - task: NodeTool@0
    displayName: Use Node.js 20
    inputs:
      versionSpec: '20.x'

  - script: npx --yes docuservice build . --out "$(DOCS_OUTPUT_DIR)"
    displayName: Build documentation site

  - task: AzureStaticWebApp@0
    displayName: Deploy to Azure Static Web Apps
    inputs:
      app_location: '$(DOCS_OUTPUT_DIR)'
      output_location: ''
      skip_app_build: true
      skip_api_build: true
      azure_static_web_apps_api_token: $(AZURE_STATIC_WEB_APPS_API_TOKEN)
`;
}
