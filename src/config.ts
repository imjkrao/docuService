import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SiteConfig } from './types.js';

const CONFIG_FILENAMES = ['docuservice.json', '.docuservice.json'];

const DEFAULT_EXCLUDE = [
  'node_modules',
  '.git',
  '.github',
  '.azuredevops',
  'dist',
  'build',
  'out',
  'vendor',
  '.venv',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
];

export function defaultConfig(): SiteConfig {
  return {
    title: 'Documentation',
    description: '',
    base: '/',
    srcDir: '.',
    outDir: 'site',
    exclude: [...DEFAULT_EXCLUDE],
    theme: {
      accent: '#0078d4',
      logo: null,
      footer: null,
      defaultColorScheme: 'auto',
    },
    repo: null,
    emitSwaConfig: true,
    search: true,
    mermaid: true,
  };
}

/**
 * Load docuservice.json from `dir` if present and merge it over the defaults.
 * A missing file is not an error — zero config is the point of the product.
 */
export async function loadConfig(dir: string): Promise<SiteConfig> {
  const config = defaultConfig();

  for (const name of CONFIG_FILENAMES) {
    const file = path.join(dir, name);
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${name} is not valid JSON: ${(error as Error).message}`);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${name} must contain a JSON object.`);
    }
    merge(config, parsed as Record<string, unknown>);
    break;
  }

  config.base = normalizeBase(config.base);
  return config;
}

/** Shallow merge with one level of nesting for `theme` and `repo`. */
function merge(target: SiteConfig, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;
    if (key === 'theme' && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(target.theme, value);
      continue;
    }
    if (key === 'repo' && typeof value === 'object' && !Array.isArray(value)) {
      target.repo = {
        organization: '',
        project: '',
        repository: '',
        branch: 'main',
        pathPrefix: '',
        ...(target.repo ?? {}),
        ...(value as Record<string, unknown>),
      } as SiteConfig['repo'];
      continue;
    }
    if (key in target) {
      (target as unknown as Record<string, unknown>)[key] = value;
    }
  }
}

/** Force a base path into the `/…/` shape the templates assume. */
export function normalizeBase(base: string): string {
  let value = (base || '/').trim();
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value.replace(/\/{2,}/g, '/');
}
