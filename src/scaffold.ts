import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { detectRepo } from './git.js';
import { defaultConfig } from './config.js';

/** Marker in generated YAML, so a later `init` can tell its own file from yours. */
const GENERATED_MARKER = '# docuservice:generated';

const DEFAULT_PIPELINE = 'azure-pipelines.yml';
const DOCS_PIPELINE = 'azure-pipelines-docs.yml';

export interface InitOptions {
  root: string;
  /** Overwrite files docuservice generated earlier. Never overwrites foreign files. */
  force: boolean;
  /** Explicit pipeline filename, bypassing the collision handling. */
  pipelineName?: string;
}

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface InitResult {
  written: string[];
  skipped: SkippedFile[];
  /** Filename the pipeline was written to, or null when nothing was written. */
  pipelineFile: string | null;
  /**
   * Set when azure-pipelines.yml already existed and was not ours, so the docs
   * pipeline went to a different filename.
   */
  divertedFrom: string | null;
}

/**
 * Drop the files a customer needs into their existing Azure repo.
 *
 * Most repositories already have an azure-pipelines.yml driving the application
 * build. That file is never touched: the docs pipeline is written alongside it
 * under its own name, and Azure DevOps runs it as a separate pipeline definition.
 */
export async function init(options: InitOptions): Promise<InitResult> {
  const root = path.resolve(options.root);
  const repo = await detectRepo(root, '');
  const written: string[] = [];
  const skipped: SkippedFile[] = [];

  const configName = 'docuservice.json';
  const configPath = path.join(root, configName);
  if (existsSync(configPath) && !options.force) {
    skipped.push({ file: configName, reason: 'already exists — rerun with --force to replace it' });
  } else {
    await writeFile(configPath, configTemplate(repo?.repository ?? path.basename(root)), 'utf8');
    written.push(configName);
  }

  const pipeline = await resolvePipelineTarget(root, options);
  if (pipeline.write) {
    await writeFile(path.join(root, pipeline.name), pipelineTemplate(pipeline.name), 'utf8');
    written.push(pipeline.name);
  } else if (pipeline.reason) {
    skipped.push({ file: pipeline.name, reason: pipeline.reason });
  }

  return {
    written,
    skipped,
    pipelineFile: pipeline.write ? pipeline.name : null,
    divertedFrom: pipeline.divertedFrom,
  };
}

interface PipelineTarget {
  name: string;
  write: boolean;
  reason: string | null;
  divertedFrom: string | null;
}

/**
 * Decide where the docs pipeline goes.
 *
 * - No azure-pipelines.yml → use it.
 * - One we generated earlier → replace it only with --force.
 * - Somebody else's → leave it alone and use azure-pipelines-docs.yml.
 */
async function resolvePipelineTarget(root: string, options: InitOptions): Promise<PipelineTarget> {
  if (options.pipelineName) {
    const explicit = options.pipelineName;
    const exists = existsSync(path.join(root, explicit));
    return {
      name: explicit,
      write: !exists || options.force,
      reason: exists && !options.force ? 'already exists — rerun with --force to replace it' : null,
      divertedFrom: null,
    };
  }

  const defaultPath = path.join(root, DEFAULT_PIPELINE);
  if (!existsSync(defaultPath)) {
    return { name: DEFAULT_PIPELINE, write: true, reason: null, divertedFrom: null };
  }

  if (await isGenerated(defaultPath)) {
    return {
      name: DEFAULT_PIPELINE,
      write: options.force,
      reason: options.force ? null : 'a docuservice pipeline is already there — rerun with --force to refresh it',
      divertedFrom: null,
    };
  }

  // Foreign pipeline. Never touch it, even with --force.
  const docsPath = path.join(root, DOCS_PIPELINE);
  const docsExists = existsSync(docsPath);
  const replaceable = !docsExists || options.force || (await isGenerated(docsPath));

  return {
    name: DOCS_PIPELINE,
    write: replaceable,
    reason: replaceable ? null : 'already exists — rerun with --force to replace it',
    divertedFrom: DEFAULT_PIPELINE,
  };
}

async function isGenerated(file: string): Promise<boolean> {
  try {
    return (await readFile(file, 'utf8')).includes(GENERATED_MARKER);
  } catch {
    return false;
  }
}

/**
 * A job customers can paste into a pipeline they already maintain, instead of
 * running the docs build as a separate pipeline definition.
 */
export function pipelineJobSnippet(): string {
  return `  - job: PublishDocs
    displayName: Publish documentation
    pool:
      vmImage: ubuntu-latest
    steps:
      - checkout: self
        fetchDepth: 0
      - task: NodeTool@0
        inputs:
          versionSpec: '20.x'
      - script: |
          npm install --no-save docuservice
          npx docuservice build . --out site
        displayName: Build documentation site
      - task: AzureStaticWebApp@0
        inputs:
          app_location: 'site'
          output_location: ''
          skip_app_build: true
          skip_api_build: true
          azure_static_web_apps_api_token: $(AZURE_STATIC_WEB_APPS_API_TOKEN)
`;
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
function pipelineTemplate(selfName: string): string {
  return `${GENERATED_MARKER}
# Publishes the Markdown in this repository as an Azure Static Web App.
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
      - ${selfName}

pr:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  DOCS_OUTPUT_DIR: site
  # Where the CLI is installed from. A registry name, a tarball committed to the
  # repo (e.g. tools/docuservice-0.1.0.tgz), or a git URL all work.
  DOCUSERVICE_PACKAGE: docuservice

steps:
  - checkout: self
    # Full history so "Last updated" dates come from real commits.
    fetchDepth: 0

  - task: NodeTool@0
    displayName: Use Node.js 20
    inputs:
      versionSpec: '20.x'

  - script: |
      npm install --no-save "$(DOCUSERVICE_PACKAGE)"
      npx docuservice build . --out "$(DOCS_OUTPUT_DIR)"
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
