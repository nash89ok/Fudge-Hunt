import {
  CameraMirrorMode,
  WorldTracker,
  WorldScaleMode,
  AnchorStatus,
  FeaturePointsMesh,
  type Camera as ZapparCamera,
} from '@zappar/zappar-threejs';
import { CustomAnchor } from '@zappar/zappar';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Edge length of the cube placed on the marker-derived surface (meters).
 */
export const MARKER_CUBE_SIZE_M = 0.3;

/**
 * In Zappar image-anchor space, the target spans Y from -1 (bottom) to +1 (top); plane height uses this span.
 *
 * @see https://docs.zap.works/universal-ar/threejs/tracking/image-tracking/
 */
export const MARKER_PLANE_HEIGHT_ANCHOR_UNITS = 2;

/**
 * R3F {@link useFrame} priority: must run **after** {@link ZapparCamera}'s {@code useFrame(..., -1)}.
 */
export const AFTER_ZAPPAR_CAMERA_PRIORITY = -2;

/**
 * Exponential smoothing rate for position (1/s). Higher = less lag, more jitter.
 */
const SMOOTH_POS_LAMBDA = 9;

/**
 * Exponential smoothing rate for orientation (1/s). Slightly higher than position — rotation noise is very visible.
 */
const SMOOTH_ROT_LAMBDA = 11;

/**
 * If the raw anchor jumps farther than this (meters), snap smoothed pose (relocalization / bad frame).
 */
const SNAP_JUMP_METERS = 0.35;

/**
 * Applies Zappar-recommended options so the world tracker can map the environment (planes + point tracks)
 * without {@link WorldTracker#reset} thrashing when quality is briefly limited.
 *
 * @param wt - Tracker bound to the default pipeline (same as {@link ImageTracker}).
 */
export function configureWorldTracker(wt: WorldTracker): void {
  wt.horizontalPlaneDetectionEnabled = true;
  if (wt.verticalPlaneDetectionSupported) {
    wt.verticalPlaneDetectionEnabled = true;
  }
  wt.resetIfLimitedForMS = 0;
  /** Median scale estimation tends to drift less than DEFAULT when walking the device. */
  wt.scaleMode = WorldScaleMode.MEDIAN;
  wt.tracksDataEnabled = true;
}

type WorldFeaturePointsProps = { worldTracker: WorldTracker };

/**
 * Sparse 3D feature points (additive overlay) — confirms the solver is mapping space.
 *
 * @param props.worldTracker - Active world tracker.
 */
export function WorldFeaturePoints({ worldTracker }: WorldFeaturePointsProps) {
  const { gl } = useThree();
  const mesh = useMemo(() => {
    const m = new FeaturePointsMesh(worldTracker);
    m.color = new THREE.Color(0x88ccff);
    m.opacity = 0.35;
    m.size = 4;
    return m;
  }, [worldTracker]);

  useEffect(
    () => () => {
      try {
        if (mesh && typeof mesh.dispose === 'function') {
          mesh.dispose();
        }
      } catch {
        /* ignore */
      }
    },
    [mesh],
  );

  useFrame(() => {
    mesh.update(gl);
  }, AFTER_ZAPPAR_CAMERA_PRIORITY);

  return <primitive object={mesh} dispose={null} />;
}

export type WorldTrackedCubeRootProps = {
  camera: ZapparCamera;
  worldTracker: WorldTracker;
  customAnchor: CustomAnchor;
  /**
   * Width ÷ height of the trained target image (anchor X spans `[-aspect, +aspect]` for Y in [-1, +1]).
   * Defaults to `1` if unknown.
   */
  markerPlaneAspect?: number;
};

/**
 * Same behavior as Zappar's world-tracking anchor groups, but bound to a {@link CustomAnchor} with rigid unit scale.
 * Applies temporal smoothing while {@link AnchorStatus.ANCHOR_STATUS_TRACKING} to reduce pose jitter; snaps on large jumps.
 *
 * @see https://docs.zap.works/universal-ar/web-libraries/threejs/world-tracking/
 */
export class CustomWorldAnchorGroup extends THREE.Group {
  readonly worldTracker: WorldTracker;

  anchor: CustomAnchor;

  private readonly zapparCamera: ZapparCamera;

  private status: AnchorStatus = AnchorStatus.ANCHOR_STATUS_INITIALIZING;

  private readonly _targetPos = new THREE.Vector3();

  private readonly _targetQuat = new THREE.Quaternion();

  private readonly _smoothPos = new THREE.Vector3();

  private readonly _smoothQuat = new THREE.Quaternion();

  private _smoothPrevTimeSec = 0;

  private _smoothBlendReady = false;

  constructor(camera: ZapparCamera, worldTracker: WorldTracker, customAnchor: CustomAnchor) {
    super();
    this.zapparCamera = camera;
    this.worldTracker = worldTracker;
    this.anchor = customAnchor;
    this.matrixAutoUpdate = false;
  }

  /**
   * Pulls the latest anchor pose, then low-pass filters position/rotation to damp SDK noise.
   */
  private updatePose() {
    if (!this.anchor) {
      return;
    }
    this.status = this.anchor.status;

    this.matrix.fromArray(
      this.anchor.pose(
        this.zapparCamera.rawPose,
        this.zapparCamera.currentMirrorMode === CameraMirrorMode.Poses,
      ),
    );
    this.matrix.decompose(this._targetPos, this._targetQuat, this.scale);
    this.scale.set(1, 1, 1);

    const tracking = this.status === AnchorStatus.ANCHOR_STATUS_TRACKING;

    if (!tracking) {
      this._smoothPos.copy(this._targetPos);
      this._smoothQuat.copy(this._targetQuat);
      this._smoothBlendReady = false;
      this._smoothPrevTimeSec = 0;
      this.position.copy(this._smoothPos);
      this.quaternion.copy(this._smoothQuat);
      this.matrix.compose(this.position, this.quaternion, this.scale);
      return;
    }

    if (this._smoothQuat.dot(this._targetQuat) < 0) {
      this._targetQuat.set(
        -this._targetQuat.x,
        -this._targetQuat.y,
        -this._targetQuat.z,
        -this._targetQuat.w,
      );
    }

    const nowSec = performance.now() * 0.001;
    const dt =
      this._smoothPrevTimeSec > 0 ? Math.min(nowSec - this._smoothPrevTimeSec, 0.05) : 1 / 60;
    this._smoothPrevTimeSec = nowSec;

    if (!this._smoothBlendReady) {
      this._smoothPos.copy(this._targetPos);
      this._smoothQuat.copy(this._targetQuat);
      this._smoothBlendReady = true;
    } else {
      const jump = this._smoothPos.distanceTo(this._targetPos);
      if (jump > SNAP_JUMP_METERS) {
        this._smoothPos.copy(this._targetPos);
        this._smoothQuat.copy(this._targetQuat);
      } else {
        const tp = 1 - Math.exp(-SMOOTH_POS_LAMBDA * dt);
        const tq = 1 - Math.exp(-SMOOTH_ROT_LAMBDA * dt);
        this._smoothPos.lerp(this._targetPos, tp);
        this._smoothQuat.slerp(this._targetQuat, tq);
        this._smoothQuat.normalize();
      }
    }

    this.position.copy(this._smoothPos);
    this.quaternion.copy(this._smoothQuat);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }

  updateMatrixWorld(force?: boolean) {
    this.updatePose();
    if (!this.anchor && this.status !== AnchorStatus.ANCHOR_STATUS_INITIALIZING) {
      this.status = AnchorStatus.ANCHOR_STATUS_STOPPED;
    }
    super.updateMatrixWorld(force);
  }

  dispose() {
    /** Tracker lifecycle is owned by the parent component. */
  }
}

/**
 * World-tracked cube root (pose updates in {@link CustomWorldAnchorGroup#updateMatrixWorld}).
 */
export function WorldTrackedCubeRoot({
  camera,
  worldTracker,
  customAnchor,
  markerPlaneAspect = 1,
}: WorldTrackedCubeRootProps) {
  const root = useMemo(
    () => new CustomWorldAnchorGroup(camera, worldTracker, customAnchor),
    [camera, worldTracker, customAnchor],
  );

  /** Image lies in X–Y; +Z is out of the plane. Plane width matches anchor horizontal extent for this aspect. */
  const planeWidth = MARKER_PLANE_HEIGHT_ANCHOR_UNITS * markerPlaneAspect;
  const planeHeight = MARKER_PLANE_HEIGHT_ANCHOR_UNITS;
  const halfCube = MARKER_CUBE_SIZE_M * 0.5;

  return (
    <primitive object={root} dispose={null}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial
          color="#c8d4e0"
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <mesh position={[0, 0, halfCube]}>
        <boxGeometry args={[MARKER_CUBE_SIZE_M, MARKER_CUBE_SIZE_M, MARKER_CUBE_SIZE_M]} />
        <meshBasicMaterial color="#ffcc33" />
      </mesh>
    </primitive>
  );
}
