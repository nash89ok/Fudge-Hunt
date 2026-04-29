import * as ZapparThree from '@zappar/zappar-threejs';

let inflight: Promise<void> | null = null;

/**
 * Starts fetching/compiling the Zappar CV WASM and workers immediately. The first call on a cold load is heavy
 * (especially on Android Chrome); calling this from the landing screen overlaps that work with reading the UI.
 *
 * Safe to call multiple times — returns the same promise.
 *
 * @returns Resolves when {@link ZapparThree.loadedPromise} completes.
 */
export function preloadZapparEngine(): Promise<void> {
  if (!inflight) {
    inflight = ZapparThree.loadedPromise().then(() => undefined);
  }
  return inflight;
}
