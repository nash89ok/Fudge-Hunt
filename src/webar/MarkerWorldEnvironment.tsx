import { WorldTracker } from '@zappar/zappar-threejs';
import { useEffect, useState } from 'react';
import { configureWorldTracker, WorldFeaturePoints } from './zapparWorldTracking';

type Props = {
  /** When false, world tracker is destroyed (e.g. camera off). */
  enabled: boolean;
};

/**
 * Runs {@link WorldTracker} + feature-point visualization independently of image-target lifecycle so unloading
 * {@link ImageTracker} after the hunt ends does not dispose {@link WorldFeaturePoints} in the same teardown path.
 */
export function MarkerWorldEnvironment({ enabled }: Props) {
  const [worldTracker, setWorldTracker] = useState<WorldTracker | null>(null);

  useEffect(() => {
    if (!enabled) {
      setWorldTracker(null);
      return;
    }

    const wt = new WorldTracker();
    configureWorldTracker(wt);
    wt.enabled = true;
    setWorldTracker(wt);

    return () => {
      try {
        wt.destroy();
      } catch {
        /* ignore */
      }
      setWorldTracker(null);
    };
  }, [enabled]);

  if (!enabled || !worldTracker) {
    return null;
  }

  return <WorldFeaturePoints worldTracker={worldTracker} />;
}
