import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

/**
 * After the build is written:
 * 1. Replaces each served GLB with its optimized copy from .asset-cache/opt (see scripts/optimize-assets.mjs).
 * 2. Publishes a content hash per public file (asset-hashes.json); the service worker keys its cache on it.
 */
function worldAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'kerala-world-assets',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const optimized = join(process.cwd(), '.asset-cache', 'opt');
      let swapped = 0;
      if (existsSync(optimized)) {
        for (const source of files(optimized)) {
          const target = join(outDir, relative(optimized, source));
          if (existsSync(target)) { copyFileSync(source, target); swapped++; }
        }
      }
      const published: Record<string, { h: string; b: number }> = {};
      for (const path of files(outDir)) {
        const rel = relative(outDir, path).split(sep).join('/');
        if (!/^(assets|park)\//.test(rel)) continue;
        const bytes = readFileSync(path);
        published[`/${rel}`] = { h: createHash('sha256').update(bytes).digest('hex').slice(0, 16), b: bytes.length };
      }
      writeFileSync(join(outDir, 'asset-hashes.json'), JSON.stringify({ version: 1, files: published }));
      this.info(`${swapped} optimized models swapped in; ${Object.keys(published).length} world assets hashed`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src-sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Kodassery Diaries',
        short_name: 'Kodassery',
        description: 'An unhurried journey from the misty Western Ghats to the Kerala coast.',
        start_url: '/',
        scope: '/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#24382e',
        theme_color: '#24382e',
        categories: ['games'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // The shell only: world assets are cached on demand by the worker, keyed by content hash.
        globPatterns: ['index.html', 'app/**/*.{js,css,woff2}', 'icons/*.png', 'favicon.svg'],
        // DRACOLoader emits decoder variants we never use (asm.js fallback); the worker caches the one it fetches.
        globIgnores: ['app/draco_decoder-*.js'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
    worldAssets(),
  ],
  server: { port: 5173, strictPort: true },
  // Hashed bundles live apart from public/assets, so /app/* can be cached as immutable.
  build: { chunkSizeWarningLimit: 1800, assetsDir: 'app' },
});
