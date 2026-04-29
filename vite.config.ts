import path from 'node:path';
import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * ZapWorks `@zappar/zappar-cv` uses Web Workers; do not pre-bundle it or worker URLs break.
 * Several transitive deps are CJS-only; shims in `src/shims/` provide ESM named/default exports.
 */
export default defineConfig({
  /** GitHub Pages project-site base path: https://nash89ok.github.io/Fudge-Hunt/ */
  base: '/Fudge-Hunt/',
  /**
   * Self-signed HTTPS so phones on Wi‑Fi can open `https://<your-lan-ip>:5173` — camera APIs need a secure context.
   * Accept the browser “not secure” / certificate warning once on each device.
   */
  plugins: [react(), basicSsl()],
  resolve: {
    alias: [
      {
        /** Match only the package root `prop-types`, not `prop-types/...` subpaths. */
        find: /^prop-types$/,
        replacement: path.resolve(root, 'src/shims/prop-types.ts'),
      },
      {
        /** Match only the package root `stats.js`, not `stats.js/build/...`. */
        find: /^stats\.js$/,
        replacement: path.resolve(root, 'src/shims/stats-js.ts'),
      },
      {
        find: 'use-sync-external-store/shim/with-selector.js',
        replacement: path.resolve(root, 'src/shims/use-sync-external-store-shim-with-selector.ts'),
      },
      {
        find: 'use-sync-external-store/shim/with-selector',
        replacement: path.resolve(root, 'src/shims/use-sync-external-store-shim-with-selector.ts'),
      },
      {
        find: 'scheduler/cjs/scheduler.production.min.js',
        replacement: path.resolve(root, 'node_modules/scheduler/cjs/scheduler.production.min.js'),
      },
      { find: 'scheduler', replacement: path.resolve(root, 'src/shims/scheduler.ts') },
      {
        find: 'react-reconciler/constants',
        replacement: path.resolve(root, 'src/shims/react-reconciler-constants.ts'),
      },
      {
        find: 'react-reconciler/cjs/react-reconciler.production.min.js',
        replacement: path.resolve(root, 'node_modules/react-reconciler/cjs/react-reconciler.production.min.js'),
      },
      { find: 'react-reconciler', replacement: path.resolve(root, 'src/shims/react-reconciler.ts') },
      {
        find: 'ua-parser-js/src/ua-parser.js',
        replacement: path.resolve(root, 'node_modules/ua-parser-js/src/ua-parser.js'),
      },
      { find: 'ua-parser-js', replacement: path.resolve(root, 'src/shims/ua-parser-js.ts') },
    ],
  },
  server: {
    host: true,
    /** Allow opening the dev server by LAN IP (e.g. https://192.168.x.x:5173/). */
    allowedHosts: true,
  },
  optimizeDeps: {
    exclude: ['@zappar/zappar-cv', '@zappar/zappar', '@zappar/zappar-threejs', '@zappar/zappar-react-three-fiber'],
  },
});
