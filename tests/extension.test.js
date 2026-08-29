import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const taskDir = path.join(repoRoot, 'extension', 'DocuServiceBuild');
const taskEntry = path.join(taskDir, 'index.js');
const bundledCli = path.join(taskDir, 'node_modules', 'docuservice', 'dist', 'cli.js');

// The task is built by `npm run ext:build`, not by `npm run build`, so a fresh
// clone has neither index.js nor node_modules. Skip rather than fail.
const built = existsSync(taskEntry) && existsSync(bundledCli);
const skip = built ? false : 'extension not built — run "npm run ext:build" first';

/**
 * Invoke the task the way an agent does: inputs as INPUT_* environment variables.
 *
 * A failing task still exits 0 — azure-pipelines-task-lib signals the result
 * through a `##vso[task.complete result=Failed]` log command that the agent
 * parses. So failure is read from the output, not from the exit code.
 */
async function invokeTask(inputs) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(inputs)) {
    env[`INPUT_${key.toUpperCase()}`] = String(value);
  }

  let output;
  try {
    const { stdout, stderr } = await run(process.execPath, [taskEntry], { env, cwd: repoRoot });
    output = `${stdout}${stderr}`;
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }

  return { stdout: output, failed: output.includes('##vso[task.complete result=Failed') };
}

async function markdownRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-task-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'README.md'), '# Handbook\n\n## Scope\n\nBody.\n');
  return root;
}

test('task builds a site and reports the output directory', { skip }, async () => {
  const root = await markdownRepo();
  const out = path.join(root, 'site');

  const { stdout, failed } = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: out,
  });

  assert.equal(failed, false, stdout);
  assert.match(stdout, /Built 1 page\(s\)/);
  assert.ok(existsSync(path.join(out, 'index.html')));
});

test('task publishes outputDirectory as an output variable', { skip }, async () => {
  const root = await markdownRepo();
  const out = path.join(root, 'site');

  const { stdout } = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: out,
  });

  // The next task consumes this as $(DocuServiceBuild.outputDirectory).
  assert.match(
    stdout,
    /##vso\[task\.setvariable variable=outputDirectory;isOutput=true;/,
    'must be marked isOutput so later steps can read it',
  );
  assert.ok(stdout.includes(out), 'the published value is the absolute output path');
});

test('task fails with a message naming the input when the source is missing', { skip }, async () => {
  const { stdout, failed } = await invokeTask({
    sourceDirectory: path.join(tmpdir(), 'docuservice-does-not-exist'),
    outputDirectory: path.join(tmpdir(), 'unused'),
  });

  assert.equal(failed, true);
  assert.match(stdout, /Source directory not found/);
  assert.match(stdout, /Source directory' input/, 'points the user at the input, not the CLI');
  assert.doesNotMatch(stdout, /SourceDirectoryNotFound/, 'resource strings must be resolved');
});

test('task surfaces a build failure rather than a generic process error', { skip }, async () => {
  const root = await markdownRepo();

  const { stdout, failed } = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: path.join(root, 'src'), // build refuses to overwrite its source
  });

  assert.equal(failed, true);
  assert.match(stdout, /docuservice build failed with exit code/);
  assert.match(stdout, /outDir must not be the same directory/, "the CLI's reason stays visible");
});

test('basePath is passed through only when it is not the default', { skip }, async () => {
  const root = await markdownRepo();

  const withDefault = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: path.join(root, 'a'),
    basePath: '/',
  });
  assert.doesNotMatch(withDefault.stdout, /--base/, 'no noise in the log for the default');

  const withSubPath = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: path.join(root, 'b'),
    basePath: '/docs/',
  });
  assert.match(withSubPath.stdout, /--base/);
});

test('the bundled CLI is what runs, so no install is needed at run time', { skip }, async () => {
  const root = await markdownRepo();

  const { stdout } = await invokeTask({
    sourceDirectory: path.join(root, 'src'),
    outputDirectory: path.join(root, 'site'),
  });

  assert.match(
    stdout,
    /node_modules[/\\]docuservice[/\\]dist[/\\]cli\.js/,
    'must invoke the CLI bundled in the task, never a fetched one',
  );
});
