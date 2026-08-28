import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { init } from '../dist/scaffold.js';

const FOREIGN = '# Application build\ntrigger: [main]\nsteps:\n  - script: dotnet build\n';

async function repo() {
  const root = await mkdtemp(path.join(tmpdir(), 'docuservice-init-'));
  await writeFile(path.join(root, 'README.md'), '# Docs\n');
  return root;
}

test('init writes azure-pipelines.yml when the name is free', async () => {
  const root = await repo();
  const result = await init({ root, force: false });

  assert.deepEqual(result.written.sort(), ['azure-pipelines.yml', 'docuservice.json']);
  assert.equal(result.pipelineFile, 'azure-pipelines.yml');
  assert.equal(result.divertedFrom, null);
});

test('init never touches a pipeline it did not generate', async () => {
  const root = await repo();
  await writeFile(path.join(root, 'azure-pipelines.yml'), FOREIGN);

  const result = await init({ root, force: false });

  assert.equal(result.pipelineFile, 'azure-pipelines-docs.yml');
  assert.equal(result.divertedFrom, 'azure-pipelines.yml');
  assert.equal(await readFile(path.join(root, 'azure-pipelines.yml'), 'utf8'), FOREIGN);
  assert.ok(existsSync(path.join(root, 'azure-pipelines-docs.yml')));
});

test('--force does not override the foreign-pipeline protection', async () => {
  const root = await repo();
  await writeFile(path.join(root, 'azure-pipelines.yml'), FOREIGN);

  const result = await init({ root, force: true });

  assert.equal(result.pipelineFile, 'azure-pipelines-docs.yml');
  assert.equal(
    await readFile(path.join(root, 'azure-pipelines.yml'), 'utf8'),
    FOREIGN,
    'an application pipeline survives --force',
  );
});

test('init is idempotent and refreshes only its own pipeline with --force', async () => {
  const root = await repo();
  await init({ root, force: false });

  const second = await init({ root, force: false });
  assert.equal(second.pipelineFile, null);
  assert.equal(second.written.length, 0);
  assert.equal(second.skipped.length, 2);

  const forced = await init({ root, force: true });
  assert.equal(forced.pipelineFile, 'azure-pipelines.yml');
  assert.equal(forced.divertedFrom, null);
});

test('init honours an explicit pipeline filename', async () => {
  const root = await repo();
  await writeFile(path.join(root, 'azure-pipelines.yml'), FOREIGN);

  const result = await init({ root, force: false, pipelineName: 'docs-publish.yml' });

  assert.equal(result.pipelineFile, 'docs-publish.yml');
  assert.ok(existsSync(path.join(root, 'docs-publish.yml')));
  assert.equal(await readFile(path.join(root, 'azure-pipelines.yml'), 'utf8'), FOREIGN);
});

test('generated pipelines carry the marker that makes them recognisable', async () => {
  const root = await repo();
  await init({ root, force: false });

  const yaml = await readFile(path.join(root, 'azure-pipelines.yml'), 'utf8');
  assert.match(yaml, /^# docuservice:generated/);
});

test('the generated pipeline triggers on its own filename, not the default', async () => {
  const root = await repo();
  await writeFile(path.join(root, 'azure-pipelines.yml'), FOREIGN);

  const result = await init({ root, force: false });
  const yaml = await readFile(path.join(root, result.pipelineFile), 'utf8');

  const triggerPaths = yaml.slice(yaml.indexOf('trigger:'), yaml.indexOf('pr:'));
  assert.match(triggerPaths, /- azure-pipelines-docs\.yml/, 'watches the file it lives in');
  assert.doesNotMatch(
    triggerPaths,
    /- azure-pipelines\.yml$/m,
    'does not rebuild docs when the application pipeline changes',
  );
});
