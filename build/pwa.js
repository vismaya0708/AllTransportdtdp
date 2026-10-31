import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function pwa() {
  return {
    name: 'all-transport-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Vite may emit HTML after this hook; include the entry explicitly.
      const files = [...new Set([...Object.keys(bundle), 'index.html', 'icons/icon.svg', 'manifest.webmanifest'])];
      const hash = createHash('sha256');
      for (const entry of Object.values(bundle)) hash.update(entry.code || String(entry.source));
      for (const path of ['icons/icon.svg', 'manifest.webmanifest']) hash.update(readFileSync(new URL(`../public/${path}`, import.meta.url)));
      const template = readFileSync(new URL('./service-worker.template.js', import.meta.url), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source: template
        .replace('__APP_FILES__', JSON.stringify(files))
        .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 16)) });
    }
  };
}
