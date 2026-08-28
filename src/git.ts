import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Page, RepoConfig } from './types.js';

const run = promisify(execFile);

/** Best-effort git call: any failure (no git, no repo, shallow clone) yields null. */
async function git(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', args, { cwd, maxBuffer: 8 * 1024 * 1024 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Stamp each page with the ISO date of the last commit that touched it.
 * Uses a single `git log` pass per file; skipped entirely outside a repo.
 */
export async function attachLastUpdated(pages: Page[], cwd: string): Promise<void> {
  if ((await git(['rev-parse', '--is-inside-work-tree'], cwd)) !== 'true') return;

  await Promise.all(
    pages.map(async (page) => {
      const iso = await git(['log', '-1', '--format=%cI', '--', page.sourcePath], cwd);
      if (iso) page.lastUpdated = iso;
    }),
  );
}

/** Infer Azure Repos coordinates from `origin` so edit links work with zero config. */
export async function detectRepo(cwd: string, pathPrefix: string): Promise<RepoConfig | null> {
  const remote = await git(['config', '--get', 'remote.origin.url'], cwd);
  if (!remote) return null;

  const parsed = parseAzureRemote(remote);
  if (!parsed) return null;

  const branch =
    process.env.BUILD_SOURCEBRANCHNAME ??
    (await git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)) ??
    'main';

  return { ...parsed, branch: branch === 'HEAD' ? 'main' : branch, pathPrefix };
}

/** Recognises dev.azure.com (HTTPS + SSH) and legacy visualstudio.com remotes. */
export function parseAzureRemote(remote: string): Omit<RepoConfig, 'branch' | 'pathPrefix'> | null {
  const url = remote.trim().replace(/\.git$/, '');

  const devAzure = url.match(/dev\.azure\.com[/:]v?3?\/?([^/]+)\/([^/]+)\/(?:_git\/)?([^/]+)$/i);
  if (devAzure?.[1] && devAzure[2] && devAzure[3]) {
    return {
      organization: decodeURIComponent(devAzure[1].replace(/^.*@/, '')),
      project: decodeURIComponent(devAzure[2]),
      repository: decodeURIComponent(devAzure[3]),
    };
  }

  const legacy = url.match(/https?:\/\/([^.]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/]+)\/_git\/([^/]+)$/i);
  if (legacy?.[1] && legacy[2] && legacy[3]) {
    return {
      organization: decodeURIComponent(legacy[1]),
      project: decodeURIComponent(legacy[2]),
      repository: decodeURIComponent(legacy[3]),
    };
  }

  return null;
}

/** Deep link to the file in the Azure Repos web editor. */
export function editUrl(repo: RepoConfig, relPath: string): string {
  const prefix = repo.pathPrefix ? `${repo.pathPrefix.replace(/^\/|\/$/g, '')}/` : '';
  const filePath = `/${prefix}${relPath}`;
  const params = new URLSearchParams({
    path: filePath,
    version: `GB${repo.branch}`,
    _a: 'contents',
  });
  const org = encodeURIComponent(repo.organization);
  const project = encodeURIComponent(repo.project);
  const repository = encodeURIComponent(repo.repository);
  return `https://dev.azure.com/${org}/${project}/_git/${repository}?${params.toString()}`;
}
