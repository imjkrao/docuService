import path = require('path');
import fs = require('fs');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');

/**
 * Thin wrapper around the bundled docuservice CLI.
 *
 * The CLI ships inside this task's node_modules rather than being installed at
 * run time, so the task works on agents with no access to npmjs.org.
 */
async function run(): Promise<void> {
  try {
    // Without this, tl.loc() emits the message key instead of the message.
    tl.setResourcePath(path.join(__dirname, 'task.json'));

    const sourceDirectory = tl.getPathInput('sourceDirectory', true, false) as string;
    const outputDirectory = tl.getInput('outputDirectory', true) as string;
    const basePath = tl.getInput('basePath', false);
    const quiet = tl.getBoolInput('quiet', false);

    if (!fs.existsSync(sourceDirectory)) {
      // Fail on the input rather than letting the CLI report a path the user
      // never typed — the source directory may have come from a variable.
      tl.setResult(tl.TaskResult.Failed, tl.loc('SourceDirectoryNotFound', sourceDirectory));
      return;
    }

    const cli = resolveCli();
    if (!cli) {
      tl.setResult(tl.TaskResult.Failed, tl.loc('CliNotFound', expectedCliPath()));
      return;
    }

    const args = [cli, 'build', sourceDirectory, '--out', outputDirectory];
    // "/" is the CLI's own default; passing it would be noise in the log.
    if (basePath && basePath !== '/') args.push('--base', basePath);
    if (quiet) args.push('--quiet');

    // ignoreReturnCode lets us report the failure ourselves; the CLI has already
    // printed the reason to stderr, so a generic "process failed" would bury it.
    const exitCode = await tl.tool(process.execPath).arg(args).exec({
      cwd: sourceDirectory,
      failOnStdErr: false,
      ignoreReturnCode: true,
    } as tr.IExecOptions);

    if (exitCode !== 0) {
      tl.setResult(tl.TaskResult.Failed, tl.loc('BuildFailed', exitCode));
      return;
    }

    // Absolute, so the next task can use it verbatim as app_location.
    const resolved = path.resolve(sourceDirectory, outputDirectory);
    tl.setVariable('outputDirectory', resolved, false, true);
    console.log(`Documentation site written to ${resolved}`);
  } catch (error) {
    tl.setResult(tl.TaskResult.Failed, (error as Error).message);
  }
}

/** Absolute path of the bundled CLI entry point, or null when it is missing. */
function resolveCli(): string | null {
  const candidate = expectedCliPath();
  return fs.existsSync(candidate) ? candidate : null;
}

function expectedCliPath(): string {
  return path.join(__dirname, 'node_modules', 'docuservice', 'dist', 'cli.js');
}

void run();
