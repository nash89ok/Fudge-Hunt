/**
 * UMD/CJS `stats.js` → ESM default export for `@react-three/drei` (`import StatsImpl from 'stats.js'`).
 * Import `stats.js/build/stats.min.js` (not the `stats.js` package root) so Vite does not apply the `stats.js` alias here.
 */
import * as statsNamespace from 'stats.js/build/stats.min.js';

type StatsConstructor = new () => {
  dom: HTMLElement;
  begin: () => void;
  end: () => number;
  showPanel: (index: number) => void;
};

const Stats =
  (statsNamespace as { default?: StatsConstructor }).default ??
  (statsNamespace as unknown as StatsConstructor);

export default Stats;
