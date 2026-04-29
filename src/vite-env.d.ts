/// <reference types="vite/client" />

declare module 'ua-parser-js/src/ua-parser.js' {
  const UAParser: new (ua?: string) => unknown;
  export default UAParser;
}

declare module 'react-reconciler/cjs/react-reconciler.production.min.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Reconciler: any;
  export default Reconciler;
}

declare module 'prop-types/index.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PropTypes: any;
  export = PropTypes;
}

declare module 'stats.js/build/stats.min.js' {
  const Stats: new () => {
    dom: HTMLElement;
    begin: () => void;
    end: () => number;
    showPanel: (index: number) => void;
  };
  export = Stats;
}

declare module 'use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.min.js' {
  export const useSyncExternalStoreWithSelector: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot: undefined | (() => unknown),
    selector: (state: unknown) => unknown,
    isEqual?: (a: unknown, b: unknown) => boolean,
  ) => unknown;
}

declare module 'use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.development.js' {
  export const useSyncExternalStoreWithSelector: (
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot: undefined | (() => unknown),
    selector: (state: unknown) => unknown,
    isEqual?: (a: unknown, b: unknown) => boolean,
  ) => unknown;
}

declare module 'scheduler/cjs/scheduler.production.min.js' {
  export const unstable_IdlePriority: number;
  export const unstable_ImmediatePriority: number;
  export const unstable_LowPriority: number;
  export const unstable_NormalPriority: number;
  export const unstable_Profiling: unknown;
  export const unstable_UserBlockingPriority: number;
  export function unstable_now(): number;
  export function unstable_scheduleCallback(
    priorityLevel: number,
    callback: (didTimeout: boolean) => unknown,
    options?: { delay?: number },
  ): unknown;
  export function unstable_cancelCallback(callbackNode: unknown): void;
  export function unstable_shouldYield(): boolean;
  export function unstable_requestPaint(): void;
  export function unstable_runWithPriority<T>(priorityLevel: number, fn: () => T): T;
  export function unstable_getCurrentPriorityLevel(): number;
  export function unstable_continueExecution(): void;
  export function unstable_pauseExecution(): void;
  export function unstable_getFirstCallbackNode(): unknown;
  export function unstable_next<T>(fn: () => T): T;
  export function unstable_wrapCallback(callback: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown;
  export function unstable_forceFrameRate(fps: number): void;
}
