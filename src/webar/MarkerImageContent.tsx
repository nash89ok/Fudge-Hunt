import {
  ImageAnchorGroup as ImageAnchorGroupImpl,
  ImageTracker,
  type Camera as ZapparCamera,
} from '@zappar/zappar-threejs';
import { extend, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  AFTER_ZAPPAR_CAMERA_PRIORITY,
  MARKER_CUBE_SIZE_M,
  MARKER_PLANE_HEIGHT_ANCHOR_UNITS,
} from './zapparWorldTracking';
import { MarkerRockStageModel } from './MarkerRockStageModel';

extend({ ImageAnchorGroupImpl });

export type TargetLoadState = 'idle' | 'loading' | 'ready' | 'error';

type Props = {
  enabled: boolean;
  targetZptUrl: string;
  /** When true, always show the collected yellow cube (no rock); does not drive the collect button. */
  persistentCollected?: boolean;
  /** When false, visibility changes are not reported (use for a secondary tracker layer). */
  reportTracking?: boolean;
  /** When false, load state is not reported (only the active hunt layer should update the banner). */
  reportTargetLoad?: boolean;
  /**
   * With {@link persistentCollected}: when false, the tracker still runs but the yellow cube is hidden
   * (preload the next handoff while the hunt layer shows the collect flash on the same print).
   */
  showPersistentCollectedMesh?: boolean;
  showCollectedCube?: boolean;
  onTrackedChange?: (tracked: boolean) => void;
  onTargetLoadState?: (state: TargetLoadState, message?: string) => void;
};

/**
 * Image-tracked marker flow: plane and {@link MarkerRockStageModel} stay parented to {@link ImageAnchorGroupImpl}
 * so they follow the printed target directly. (No handoff to a world-tracked {@link CustomAnchor} — that would
 * replace image pose with SLAM and feel like drift relative to the marker.)
 *
 * For sequential hunts, mount a second instance with {@link Props.persistentCollected} on the previous step’s
 * `.zpt` so the collected cube stays on that print until the next marker is collected.
 */
export function MarkerImageContent({
  enabled,
  targetZptUrl,
  persistentCollected = false,
  reportTracking = true,
  reportTargetLoad = true,
  showPersistentCollectedMesh = true,
  showCollectedCube = false,
  onTrackedChange,
  onTargetLoadState,
}: Props) {
  const { camera } = useThree();
  const zapparCamera = camera as unknown as ZapparCamera;

  const [tracker, setTracker] = useState<ImageTracker | null>(null);
  /** Width/height of the printed target image for a full-bleed marker plane in anchor units. */
  const [markerPlaneAspect, setMarkerPlaneAspect] = useState(1);

  const trackerRef = useRef<ImageTracker | null>(null);
  const markerContentRef = useRef<THREE.Group>(null);
  const lastVisibleRef = useRef(false);

  useEffect(() => {
    trackerRef.current = tracker;
  }, [tracker]);

  useEffect(() => {
    if (!enabled) {
      setTracker(null);
      setMarkerPlaneAspect(1);
      lastVisibleRef.current = false;
      if (reportTargetLoad) {
        onTargetLoadState?.('idle');
      }
      if (reportTracking) {
        onTrackedChange?.(false);
      }
      return;
    }
  }, [enabled, reportTargetLoad, reportTracking, onTargetLoadState, onTrackedChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (reportTargetLoad) {
      onTargetLoadState?.('loading');
    }
    const t = new ImageTracker();
    t.enabled = false;

    const url = new URL(targetZptUrl, window.location.href).href;
    let cancelled = false;

    void (async () => {
      try {
        await t.loadTarget(url);
        if (cancelled) {
          return;
        }
        t.enabled = true;
        setTracker(t);
        if (reportTargetLoad) {
          onTargetLoadState?.('ready');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load image target';
        console.error('[MarkerImageContent]', msg, e);
        if (!cancelled) {
          try {
            t.destroy();
          } catch {
            /* ignore */
          }
          if (reportTargetLoad) {
            onTargetLoadState?.('error', msg);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        t.destroy();
      } catch {
        /* ignore */
      }
      setTracker(null);
    };
  }, [enabled, targetZptUrl, onTargetLoadState, reportTargetLoad]);

  useEffect(() => {
    lastVisibleRef.current = false;
    if (reportTracking) {
      onTrackedChange?.(false);
    }
  }, [targetZptUrl, onTrackedChange, reportTracking]);

  useFrame(() => {
    const t = trackerRef.current;
    const group = markerContentRef.current;
    if (!group) {
      return;
    }
    if (!t) {
      group.visible = false;
      if (lastVisibleRef.current) {
        lastVisibleRef.current = false;
        if (reportTracking) {
          onTrackedChange?.(false);
        }
      }
      return;
    }
    const vis = t.visible.size > 0;
    group.visible = vis;
    if (vis !== lastVisibleRef.current) {
      lastVisibleRef.current = vis;
      if (reportTracking) {
        onTrackedChange?.(vis);
      }
    }
  }, AFTER_ZAPPAR_CAMERA_PRIORITY);

  useEffect(() => {
    if (!tracker) {
      return;
    }
    try {
      const n = tracker.targets.length;
      if (n === 0) {
        console.warn('[MarkerImageContent] .zpt loaded but reports 0 targets — check the file.');
      } else {
        console.info('[MarkerImageContent] Image target(s) in tracker:', n);
      }
    } catch {
      /* ignore */
    }
  }, [tracker]);

  /**
   * Reads embedded preview dimensions so the flat plane matches the trained image aspect.
   */
  useEffect(() => {
    if (!tracker) {
      return;
    }
    const img = tracker.targets[0]?.image;
    if (!img) {
      return;
    }
    const applyAspect = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMarkerPlaneAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    applyAspect();
    if (!img.complete) {
      img.addEventListener('load', applyAspect);
      return () => img.removeEventListener('load', applyAspect);
    }
  }, [tracker]);

  if (!enabled) {
    return null;
  }

  const persistCubeVisible = persistentCollected ? showPersistentCollectedMesh : true;
  const showYellowCollectedCube = showCollectedCube || (persistentCollected && persistCubeVisible);
  const showRockModel = !persistentCollected && !showCollectedCube;

  return (
    <>
      {tracker ? (
        <imageAnchorGroupImpl args={[zapparCamera, tracker]}>
          <group ref={markerContentRef} visible={false}>
            <mesh position={[0, 0, 0]}>
              <planeGeometry
                args={[MARKER_PLANE_HEIGHT_ANCHOR_UNITS * markerPlaneAspect, MARKER_PLANE_HEIGHT_ANCHOR_UNITS]}
              />
              <meshBasicMaterial
                color="#c8d4e0"
                transparent
                opacity={0.42}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
            {showYellowCollectedCube ? (
              <mesh position={[0, 0, MARKER_CUBE_SIZE_M * 0.5]}>
                <boxGeometry args={[MARKER_CUBE_SIZE_M, MARKER_CUBE_SIZE_M, MARKER_CUBE_SIZE_M]} />
                <meshBasicMaterial color="#ffcc33" />
              </mesh>
            ) : showRockModel ? (
              <MarkerRockStageModel />
            ) : null}
          </group>
        </imageAnchorGroupImpl>
      ) : null}
    </>
  );
}
