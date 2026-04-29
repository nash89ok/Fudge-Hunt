/**
 * CJS `use-sync-external-store/shim/with-selector` → ESM default export for Zustand
 * (`import useSyncExternalStoreExports from '.../with-selector.js'`).
 */
import * as dev from 'use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js';
import * as prod from 'use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.min.js';

const m = import.meta.env.DEV ? dev : prod;

const useSyncExternalStoreExports = {
  useSyncExternalStoreWithSelector: m.useSyncExternalStoreWithSelector,
};

export default useSyncExternalStoreExports;
