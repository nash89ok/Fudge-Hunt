import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';

/** Served from `public/Model/SakuraStage.glb` (folder name is `Model`, case-sensitive on many hosts). */
const ROCK_STAGE_URL = `${import.meta.env.BASE_URL}Model/LeafStage.glb`;

/** Base fit (meters on longest axis) before {@link SIZE_MULTIPLIER}. */
const BASE_TARGET_MAX_EXTENT_M = 0.4;

/** Uniform size multiplier vs the base fit (4× larger on screen). */
const SIZE_MULTIPLIER = 4;

/** After scaling, the model's largest axis is clamped to this length (meters). */
const TARGET_MAX_EXTENT_M = BASE_TARGET_MAX_EXTENT_M * SIZE_MULTIPLIER;

/** Rotation around world Y (radians) applied before fitting — 90°. */
const MODEL_Y_ROTATION_RAD = Math.PI / 2;

/** Base albedo boost applied to loaded materials to keep the model readable on mobile camera feeds. */
const BRIGHTNESS_MULTIPLIER = 1;

/** Small emissive lift to avoid very dark shading when environment light is weak. */
const EMISSIVE_LIFT = 0;

/** Global ambient light intensity applied to the model scene. */
const AMBIENT_LIGHT_INTENSITY = 0;

/**
 * `SakuraStage.glb`: +90° about Y, scaled to {@link TARGET_MAX_EXTENT_M} on the longest axis (4× the prior base fit),
 * then shifted so its AABB minimum Z sits on the marker plane (+Z out of the print per Zappar image anchors).
 */
export function MarkerRockStageModel() {
  const gltf = useGLTF(ROCK_STAGE_URL);
  const root = useMemo(() => {
    const r = gltf.scene.clone(true);
    r.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (!mat) return;
          if ('color' in mat && mat.color instanceof THREE.Color) {
            mat.color.multiplyScalar(BRIGHTNESS_MULTIPLIER);
          }
          if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
            mat.emissive.addScalar(EMISSIVE_LIFT);
          }
          if ('emissiveIntensity' in mat && typeof mat.emissiveIntensity === 'number') {
            mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 1);
          }
          mat.needsUpdate = true;
        });
      }
    });
    return r;
  }, [gltf]);

  useLayoutEffect(() => {
    root.rotation.set(MODEL_Y_ROTATION_RAD, 0, 0);
    root.scale.set(1, 1, 1);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    const s = TARGET_MAX_EXTENT_M / maxDim;
    root.scale.setScalar(s);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.set(0, 0, -b2.min.z);
  }, [root]);

  return (
    <>
      <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
      <primitive object={root} dispose={null} />
    </>
  );
}

useGLTF.preload(ROCK_STAGE_URL);
