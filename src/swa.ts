import type { SiteConfig } from './types.js';

/**
 * Azure Static Web Apps runtime configuration.
 * Clean URLs are already directory-based, so this mainly covers the 404 page,
 * cache headers for fingerprint-free assets and a baseline security policy.
 */
export function staticWebAppConfig(config: SiteConfig): string {
  const body = {
    navigationFallback: {
      rewrite: `${config.base}404.html`,
      exclude: ['/assets/*', '/*.{png,jpg,jpeg,gif,svg,webp,ico,css,js,json,woff,woff2}'],
    },
    responseOverrides: {
      '404': { rewrite: `${config.base}404.html` },
    },
    routes: [
      {
        route: '/assets/*',
        headers: { 'cache-control': 'public, max-age=3600, must-revalidate' },
      },
    ],
    globalHeaders: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    mimeTypes: {
      '.json': 'application/json',
      '.md': 'text/plain',
    },
  };

  return `${JSON.stringify(body, null, 2)}\n`;
}
