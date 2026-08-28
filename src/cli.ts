#!/usr/bin/env node
import process from 'node:process';
import { build } from './build.js';
import { serve } from './serve.js';
import { init, pipelineJobSnippet } from './scaffold.js';

const USAGE = `docuservice — publish Markdown from Azure Repos as a static web app

Usage:
  docuservice build [dir] [--out <dir>] [--base <path>] [--quiet]
  docuservice serve [dir] [--out <dir>] [--port <n>]
  docuservice init  [dir] [--force] [--pipeline <file>]

Options:
  --out <dir>    Output directory (default: site, or outDir from docuservice.json)
  --base <path>  Site base path when hosted under a sub-path (default: /)
  --port <n>     Preview server port (default: 4321)
  --force        init: replace files docuservice generated earlier
  --pipeline <f> init: pipeline filename to write (default: azure-pipelines.yml,
                 or azure-pipelines-docs.yml when that name is already taken)
  -h, --help     Show this message
`;

interface Args {
  command: string;
  dir: string;
  out?: string;
  base?: string;
  port: number;
  force: boolean;
  quiet: boolean;
  pipeline?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { command: '', dir: '.', port: 4321, force: false, quiet: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--base':
        args.base = argv[++i];
        break;
      case '--port':
        args.port = Number(argv[++i]);
        break;
      case '--pipeline':
        args.pipeline = argv[++i];
        break;
      case '--force':
        args.force = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '-h':
      case '--help':
        args.command = 'help';
        break;
      default:
        if (token && !token.startsWith('-')) positional.push(token);
    }
  }

  if (args.command !== 'help') args.command = positional[0] ?? '';
  if (positional[1]) args.dir = positional[1];
  return args;
}

function printInitNextSteps(result: Awaited<ReturnType<typeof init>>): void {
  if (result.divertedFrom) {
    console.log(
      `\n${result.divertedFrom} already exists and was left untouched — it is not ours to change.`,
    );
    console.log(
      `The docs pipeline went to ${result.pipelineFile ?? 'a separate file'} instead. Azure DevOps runs it as its`,
    );
    console.log('own pipeline definition, independent of your application build.');
    console.log('\nTo fold the docs build into the pipeline you already have, add this job instead:\n');
    console.log(pipelineJobSnippet());
  }

  if (!result.pipelineFile) {
    console.log('\nNo pipeline was written. Nothing else to do.');
    return;
  }

  console.log('\nNext:');
  console.log('  1. Create a Static Web App in the Azure portal (Deployment source: Other).');
  console.log('  2. Add its deployment token as a secret variable AZURE_STATIC_WEB_APPS_API_TOKEN.');
  console.log(`  3. Commit these files and create a pipeline from ${result.pipelineFile}.`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  switch (args.command) {
    case 'build': {
      const result = await build({ root: args.dir, outDir: args.out, base: args.base, quiet: args.quiet });
      console.log(
        `\nBuilt ${result.pageCount} page(s) and ${result.assetCount} asset(s) in ${result.durationMs}ms → ${result.outDir}`,
      );
      return 0;
    }
    case 'serve':
      await serve({ root: args.dir, outDir: args.out, base: args.base, port: args.port });
      return 0;
    case 'init': {
      const result = await init({ root: args.dir, force: args.force, pipelineName: args.pipeline });
      for (const file of result.written) console.log(`created  ${file}`);
      for (const entry of result.skipped) console.log(`skipped  ${entry.file} — ${entry.reason}`);
      printInitNextSteps(result);
      return 0;
    }
    case 'help':
    case '':
      console.log(USAGE);
      return args.command === '' ? 1 : 0;
    default:
      console.error(`Unknown command: ${args.command}\n`);
      console.log(USAGE);
      return 1;
  }
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(`\nerror: ${(error as Error).message}`);
    process.exitCode = 1;
  });
