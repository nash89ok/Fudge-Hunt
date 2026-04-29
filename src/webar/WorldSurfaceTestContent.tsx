import {
  WorldTracker,
  WorldTrackerQuality,
  AnchorStatus,
  type Camera as ZapparCamera,
} from '@zappar/zappar-threejs';
import {
  CustomAnchor,
  TransformOrientation,
  PlaneOrientation,
  type PlaneAnchor,
} from '@zappar/zappar';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  AFTER_ZAPPAR_CAMERA_PRIORITY,
  configureWorldTracker,
  WorldFeaturePoints,
  WorldTrackedCubeRoot,
} from './zapparWorldTracking';

type Props = {
  enabled: boolean;
  /** Called once when the cube is anchored to the first tracked surface. */
  onSurfacePlaced?: () => void;
};

/**
 * Picks a horizontal plane if available, otherwise any tracking plane — used for automatic surface placement.
 *
 * @param wt - World tracker with plane detection enabled.
 */
function pickSurfacePlane(wt: WorldTracker): PlaneAnchor | undefined {
  const planes = [...wt.planes.values()];
  const horizontal = planes.find(
    (p) =>
      p.status === AnchorStatus.ANCHOR_STATUS_TRACKING &&
      p.orientation === PlaneOrientation.PLANE_ORIENTATION_HORIZONTAL,
  );
  if (horizontal) {
    return horizontal;
  }
  return planes.find((p) => p.status === AnchorStatus.ANCHOR_STATUS_TRACKING);
}

/** Require this many consecutive frames with the same tracking plane before anchoring (reduces flicker / bad picks). */
const PLANE_STABLE_FRAME_COUNT = 10;

/**
 * Temporary test mode: no image targets. When world quality is good and a surface is detected, places a cube on it
 * via {@link CustomAnchor#setPoseFromAnchorOffset}.
 */
export function WorldSurfaceTestContent({ enabled, onSurfacePlaced }: Props) {
  const { camera } = useThree();
  const zapparCamera = camera as unknown as ZapparCamera;

  const [worldTracker, setWorldTracker] = useState<WorldTracker | null>(null);
  const [customAnchor, setCustomAnchor] = useState<CustomAnchor | null>(null);
  const [placed, setPlaced] = useState(false);

  const worldTrackerRef = useRef<WorldTracker | null>(null);
  const customAnchorRef = useRef<CustomAnchor | null>(null);
  const placedRef = useRef(false);

  const planeStableRef = useRef<{ id: string | null; count: number }>({ id: null, count: 0 });

  useEffect(() => {
    if (!enabled) {
      placedRef.current = false;
      planeStableRef.current = { id: null, count: 0 };
      setPlaced(false);
      setWorldTracker(null);
      setCustomAnchor(null);
      worldTrackerRef.current = null;
      customAnchorRef.current = null;
      return;
    }

    const wt = new WorldTracker();
    configureWorldTracker(wt);
    wt.enabled = true;
    worldTrackerRef.current = wt;
    setWorldTracker(wt);

    const ca = new CustomAnchor(wt);
    customAnchorRef.current = ca;
    setCustomAnchor(ca);

    return () => {
      try {
        ca.destroy();
      } catch {
        /* ignore */
      }
      try {
        wt.destroy();
      } catch {
        /* ignore */
      }
      worldTrackerRef.current = null;
      customAnchorRef.current = null;
      setWorldTracker(null);
      setCustomAnchor(null);
    };
  }, [enabled]);

  useFrame(() => {
    if (placedRef.current) {
      return;
    }

    const wt = worldTrackerRef.current;
    const ca = customAnchorRef.current;
    if (!wt || !ca) {
      return;
    }

    if (wt.quality !== WorldTrackerQuality.WORLD_TRACKER_QUALITY_GOOD) {
      return;
    }

    const plane = pickSurfacePlane(wt);
    if (!plane) {
      planeStableRef.current = { id: null, count: 0 };
      return;
    }

    if (plane.id !== planeStableRef.current.id) {
      planeStableRef.current = { id: plane.id, count: 1 };
    } else {
      planeStableRef.current.count++;
    }

    if (planeStableRef.current.count < PLANE_STABLE_FRAME_COUNT) {
      return;
    }

    ca.setPoseFromAnchorOffset(plane, 0, 0, 0, TransformOrientation.Z_TOWARDS_CAMERA);

    placedRef.current = true;
    setPlaced(true);
    onSurfacePlaced?.();
    console.info('[WorldSurfaceTestContent] Cube placed on detected surface:', plane.id);
  }, AFTER_ZAPPAR_CAMERA_PRIORITY);

  if (!enabled) {
    return null;
  }

  const wt = worldTracker;
  const ca = customAnchor;

  return (
    <>
      {wt ? <WorldFeaturePoints worldTracker={wt} /> : null}
      {placed && wt && ca ? (
        <WorldTrackedCubeRoot camera={zapparCamera} worldTracker={wt} customAnchor={ca} />
      ) : null}
    </>
  );
}
