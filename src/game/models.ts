import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  createBuenosAiresTextures,
  getAwarenessIconTextures,
} from './textures';
import type { EnemyKind, LootKind, MapPresetId, WorldPropCategory } from './types';

let sharedGltfLoader: GLTFLoader | null = null;
let sharedDracoLoader: DRACOLoader | null = null;

function sniffImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  return 'image/png';
}

function createFallbackNeutralTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

class ResilientGltfTextureLoader extends THREE.Loader {
  public readonly isImageBitmapLoader = false;

  override load(
    url: string,
    onLoad: (tex: THREE.Texture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    _onError?: (err: unknown) => void,
  ): THREE.Texture {
    const tex = new THREE.Texture();
    const img = new Image();
    img.crossOrigin = this.crossOrigin || 'anonymous';

    const finishWithFallback = () => {
      onLoad(createFallbackNeutralTexture());
    };

    const tryMagicByteDecode = async () => {
      if (!url.startsWith('blob:') && !url.startsWith('data:')) {
        finishWithFallback();
        return;
      }
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const mime = sniffImageMime(bytes);
        const fixedBlob = new Blob([bytes], { type: mime });
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(fixedBlob);
          const bmpTex = new THREE.Texture(bitmap);
          bmpTex.needsUpdate = true;
          onLoad(bmpTex);
          return;
        }
        const fixedUrl = URL.createObjectURL(fixedBlob);
        const retryImg = new Image();
        retryImg.onload = () => {
          URL.revokeObjectURL(fixedUrl);
          const retryTex = new THREE.Texture(retryImg);
          retryTex.needsUpdate = true;
          onLoad(retryTex);
        };
        retryImg.onerror = () => {
          URL.revokeObjectURL(fixedUrl);
          finishWithFallback();
        };
        retryImg.src = fixedUrl;
      } catch {
        finishWithFallback();
      }
    };

    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
      onLoad(tex);
    };
    img.onerror = () => {
      void tryMagicByteDecode();
    };
    img.src = this.manager.resolveURL(url);
    return tex;
  }
}

function getSharedGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('/draco/');
    sharedGltfLoader.setDRACOLoader(sharedDracoLoader);
    sharedGltfLoader.setMeshoptDecoder(MeshoptDecoder);
    sharedGltfLoader.register((parser) => ({
      name: 'resilient_gltf_texture_loader',
      beforeRoot() {
        const p = parser as unknown as {
          textureLoader: THREE.Loader;
          options: { manager: THREE.LoadingManager; crossOrigin: string };
        };
        const safeLoader = new ResilientGltfTextureLoader(p.options.manager);
        safeLoader.setCrossOrigin(p.options.crossOrigin);
        p.textureLoader = safeLoader;
        return null;
      },
    }));
  }
  return sharedGltfLoader;
}

const MATERIAL_TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
  'aoMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'specularMap',
  'envMap',
] as const;

function downscaleTextureIfNeeded(
  tex: THREE.Texture,
  maxDim: number,
  cache: Map<THREE.Texture, THREE.Texture>,
  bitmapsToClose: Set<ImageBitmap>,
): THREE.Texture {
  const cached = cache.get(tex);
  if (cached) return cached;

  const img = tex.image as
    | (HTMLImageElement & { naturalWidth?: number; naturalHeight?: number })
    | ImageBitmap
    | HTMLCanvasElement
    | undefined;
  if (!img) {
    tex.anisotropy = Math.min(4, tex.anisotropy || 4);
    cache.set(tex, tex);
    return tex;
  }

  const w = (img as HTMLImageElement).naturalWidth || img.width || 0;
  const h = (img as HTMLImageElement).naturalHeight || img.height || 0;
  if (w <= maxDim && h <= maxDim) {
    tex.anisotropy = Math.min(4, tex.anisotropy || 4);
    cache.set(tex, tex);
    return tex;
  }

  const scale = maxDim / Math.max(w, h);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    cache.set(tex, tex);
    return tex;
  }
  ctx.drawImage(img as CanvasImageSource, 0, 0, tw, th);

  const resized = new THREE.CanvasTexture(canvas);
  resized.name = tex.name;
  resized.colorSpace = tex.colorSpace;
  resized.wrapS = tex.wrapS;
  resized.wrapT = tex.wrapT;
  resized.flipY = tex.flipY;
  resized.repeat.copy(tex.repeat);
  resized.offset.copy(tex.offset);
  resized.center.copy(tex.center);
  resized.rotation = tex.rotation;
  resized.magFilter = tex.magFilter;
  resized.minFilter = tex.minFilter;
  resized.generateMipmaps = tex.generateMipmaps;
  resized.anisotropy = Math.min(4, tex.anisotropy || 4);
  resized.needsUpdate = true;

  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
    bitmapsToClose.add(img);
  }
  tex.dispose();
  cache.set(tex, resized);
  return resized;
}

function optimizeGltfSceneResources(
  root: THREE.Object3D,
  options: { maxTextureSize?: number; freezeStaticChildren?: boolean } = {},
) {
  const maxTexSize = options.maxTextureSize ?? 1024;
  const texCache = new Map<THREE.Texture, THREE.Texture>();
  const visitedMats = new Set<THREE.Material>();
  const bitmapsToClose = new Set<ImageBitmap>();

  root.traverse((child) => {
    if (options.freezeStaticChildren && child !== root) {
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    }
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat || visitedMats.has(mat)) return;
        visitedMats.add(mat);
        const rec = mat as unknown as Record<string, unknown>;
        for (let i = 0; i < MATERIAL_TEXTURE_SLOTS.length; i++) {
          const slot = MATERIAL_TEXTURE_SLOTS[i];
          const val = rec[slot];
          if (val && (val as THREE.Texture).isTexture) {
            rec[slot] = downscaleTextureIfNeeded(
              val as THREE.Texture,
              maxTexSize,
              texCache,
              bitmapsToClose,
            );
          }
        }
        mat.needsUpdate = true;
      });
    }
  });

  bitmapsToClose.forEach((bmp) => {
    try {
      bmp.close();
    } catch {
      // Ignore already-closed ImageBitmap
    }
  });
}

export function disposeObject3DResources(root: THREE.Object3D, disposeTextures = true) {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) geos.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((mat) => {
        if (!mat) return;
        mats.add(mat);
        if (disposeTextures) {
          const rec = mat as unknown as Record<string, unknown>;
          for (let i = 0; i < MATERIAL_TEXTURE_SLOTS.length; i++) {
            const val = rec[MATERIAL_TEXTURE_SLOTS[i]];
            if (val && (val as THREE.Texture).isTexture) {
              textures.add(val as THREE.Texture);
            }
          }
        }
      });
    }
  });

  textures.forEach((t) => t.dispose());
  mats.forEach((m) => m.dispose());
  geos.forEach((g) => g.dispose());
}

export const ARENA_PLAYABLE_RADIUS = 42;
export const WORLD_TERRAIN_SIZE = 240;
export const CAMPFIRE_X = 5.6;
export const CAMPFIRE_Z = 8.4;
export const CAMPFIRE_SAFE_RADIUS = 7.4;
export const PLAYER_SPAWN_X = 0;
export const PLAYER_SPAWN_Z = 11.4;

let terrainReliefScale = 1.0;
let activeMapPreset: MapPresetId = 'buenos_aires';

export function setTerrainReliefScale(scale: number) {
  terrainReliefScale = THREE.MathUtils.clamp(scale, 0, 2.2);
}

export function setActiveMapPreset(preset: MapPresetId) {
  activeMapPreset = preset;
}

export function getActiveMapPreset(): MapPresetId {
  return activeMapPreset;
}

export function getCampfireCoords(preset: MapPresetId = activeMapPreset): { x: number; z: number } {
  if (preset === 'custom_sandbox') {
    return { x: 0, z: 0 };
  }
  return { x: CAMPFIRE_X, z: CAMPFIRE_Z };
}

export function getPlayerSpawnCoords(preset: MapPresetId = activeMapPreset): { x: number; z: number } {
  if (preset === 'custom_sandbox') {
    return { x: 0, z: 4.8 };
  }
  return { x: PLAYER_SPAWN_X, z: PLAYER_SPAWN_Z };
}

export function groundHeightAt(x: number, z: number): number {
  if (activeMapPreset === 'custom_sandbox') {
    const dist = Math.hypot(x, z);
    if (dist <= ARENA_PLAYABLE_RADIUS + 4) {
      return 0;
    }
    return THREE.MathUtils.smoothstep(dist, 46, 88) * 3.4 * terrainReliefScale;
  }

  // Plaza de la República central esplanade (subtle raised granite curb)
  const plazaDx = Math.max(0, Math.abs(x) - 8.4);
  const plazaDz = Math.max(0, Math.abs(z) - 10.6);
  const plazaDist = Math.hypot(plazaDx, plazaDz);
  const plazaStep = (1 - THREE.MathUtils.smoothstep(plazaDist, 0.0, 0.7)) * 0.1;

  // Metrobus boarding island platforms (west & east corridors north/south of Corrientes)
  const mbWest =
    Math.abs(x + 12.7) < 1.65 && Math.abs(Math.abs(z) - 18.5) < 5.0
      ? 0.14
      : 0;
  const mbEast =
    Math.abs(x - 12.7) < 1.65 && Math.abs(Math.abs(z) - 18.5) < 5.0
      ? 0.14
      : 0;

  // Outer Cerrito & Carlos Pellegrini sidewalks
  const sidewalkStep = THREE.MathUtils.smoothstep(Math.abs(x), 26.8, 27.5) * 0.12;

  return (
    Math.max(plazaStep, mbWest, mbEast, sidewalkStep) *
    THREE.MathUtils.clamp(terrainReliefScale, 0.5, 1.8)
  );
}

export interface BoneRest {
  node: THREE.Object3D;
  restRot: THREE.Euler;
  restPos: THREE.Vector3;
}

export interface HumanoidBoneMap {
  hips: BoneRest | null;
  spine: BoneRest | null;
  neck: BoneRest | null;
  head: BoneRest | null;
  leftUpLeg: BoneRest | null;
  leftLeg: BoneRest | null;
  leftFoot: BoneRest | null;
  rightUpLeg: BoneRest | null;
  rightLeg: BoneRest | null;
  rightFoot: BoneRest | null;
  leftArm: BoneRest | null;
  leftForeArm: BoneRest | null;
  leftHandRest: BoneRest | null;
  rightArm: BoneRest | null;
  rightForeArm: BoneRest | null;
  rightHandRest: BoneRest | null;
  rightHand: THREE.Object3D | null;
  leftHand: THREE.Object3D | null;
  armDropAngle: number;
}

function captureBoneRest(node: THREE.Object3D | null): BoneRest | null {
  if (!node) return null;
  return {
    node,
    restRot: node.rotation.clone(),
    restPos: node.position.clone(),
  };
}

export function extractHumanoidBones(root: THREE.Object3D): HumanoidBoneMap {
  const bones: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone || obj.type === 'Bone') {
      bones.push(obj);
    }
  });

  const findBone = (patterns: RegExp[], exclude?: RegExp): THREE.Object3D | null => {
    for (const pat of patterns) {
      const hit = bones.find(
        (b) => pat.test(b.name) && (!exclude || !exclude.test(b.name)),
      );
      if (hit) return hit;
    }
    return null;
  };

  const hips = findBone([/hips/i, /pelvis/i, /root_bone/i]);
  const spine = findBone([/spine2/i, /spine_02/i, /chest/i, /spine1/i, /spine/i, /torso/i]);
  const neck = findBone([/neck/i, /cuello/i]);
  const head = findBone([/head/i, /cabeza/i, /craneo/i], /headtop|head_end/i);

  const leftUpLeg = findBone([
    /leftupleg/i,
    /thigh_l/i,
    /upperleg_l/i,
    /upleg.*l/i,
    /left.*thigh/i,
    /l_thigh/i,
  ]);
  const rightUpLeg = findBone([
    /rightupleg/i,
    /thigh_r/i,
    /upperleg_r/i,
    /upleg.*r/i,
    /right.*thigh/i,
    /r_thigh/i,
  ]);

  const leftLeg = findBone(
    [/leftleg/i, /calf_l/i, /shin_l/i, /lowerleg_l/i, /knee_l/i, /l_calf/i],
    /upleg/i,
  );
  const rightLeg = findBone(
    [/rightleg/i, /calf_r/i, /shin_r/i, /lowerleg_r/i, /knee_r/i, /r_calf/i],
    /upleg/i,
  );

  const leftFoot = findBone(
    [/leftfoot/i, /foot_l/i, /ankle_l/i, /l_foot/i, /left_foot/i],
    /toe|ball|end/i,
  );
  const rightFoot = findBone(
    [/rightfoot/i, /foot_r/i, /ankle_r/i, /r_foot/i, /right_foot/i],
    /toe|ball|end/i,
  );

  const leftArm = findBone(
    [/leftarm/i, /upperarm_l/i, /shoulder_l/i, /arm_l/i, /l_upperarm/i],
    /forearm|lowerarm|hand/i,
  );
  const rightArm = findBone(
    [/rightarm/i, /upperarm_r/i, /shoulder_r/i, /arm_r/i, /r_upperarm/i],
    /forearm|lowerarm|hand/i,
  );

  const leftForeArm = findBone([
    /leftforearm/i,
    /forearm_l/i,
    /lowerarm_l/i,
    /elbow_l/i,
    /l_forearm/i,
  ]);
  const rightForeArm = findBone([
    /rightforearm/i,
    /forearm_r/i,
    /lowerarm_r/i,
    /elbow_r/i,
    /r_forearm/i,
  ]);

  const rightHand = findBone([/righthand/i, /hand_r/i, /r_hand/i, /wrist_r/i], /thumb|index|middle|ring|pinky/i);
  const leftHand = findBone([/lefthand/i, /hand_l/i, /l_hand/i, /wrist_l/i], /thumb|index|middle|ring|pinky/i);

  // Detect how far the rest pose arms extend outward from vertical (-Y) (T-pose ~1.4, A-pose ~0.65, down ~0.1)
  let armDropAngle = 0.55;
  root.updateMatrixWorld(true);
  if (rightArm && rightForeArm) {
    const pS = new THREE.Vector3();
    const pE = new THREE.Vector3();
    rightArm.getWorldPosition(pS);
    rightForeArm.getWorldPosition(pE);
    const dir = pE.sub(pS);
    const len = dir.length();
    if (len > 0.02) {
      const horiz = Math.hypot(dir.x, dir.z);
      const angleFromDown = Math.atan2(horiz, -dir.y);
      armDropAngle = THREE.MathUtils.clamp(angleFromDown - 0.14, 0, 1.38);
    }
  }

  return {
    hips: captureBoneRest(hips),
    spine: captureBoneRest(spine),
    neck: captureBoneRest(neck),
    head: captureBoneRest(head),
    leftUpLeg: captureBoneRest(leftUpLeg),
    leftLeg: captureBoneRest(leftLeg),
    leftFoot: captureBoneRest(leftFoot),
    rightUpLeg: captureBoneRest(rightUpLeg),
    rightLeg: captureBoneRest(rightLeg),
    rightFoot: captureBoneRest(rightFoot),
    leftArm: captureBoneRest(leftArm),
    leftForeArm: captureBoneRest(leftForeArm),
    leftHandRest: captureBoneRest(leftHand),
    rightArm: captureBoneRest(rightArm),
    rightForeArm: captureBoneRest(rightForeArm),
    rightHandRest: captureBoneRest(rightHand),
    rightHand,
    leftHand,
    armDropAngle,
  };
}

export interface RifleInstance {
  group: THREE.Group;
  foregripTarget: THREE.Object3D;
  muzzleNode: THREE.Object3D;
  dispose: () => void;
}

export interface CustomRifleTemplate {
  scene: THREE.Group;
  foregripPos: THREE.Vector3;
  muzzlePos: THREE.Vector3;
  dispose: () => void;
}

function buildDefaultRifleInstance(): RifleInstance {
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f25,
    roughness: 0.26,
    metalness: 0.88,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.08,
  });
  const handguardMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    roughness: 0.65,
    metalness: 0.35,
  });
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.7,
    roughness: 0.2,
  });

  const group = new THREE.Group();
  // Origin (0,0,0) = pistol grip & trigger held squarely inside Right Hand palm; +Z = barrel forward, +Y = up
  const stockGeo = new THREE.BoxGeometry(0.062, 0.114, 0.215);
  const stock = new THREE.Mesh(stockGeo, gripMat);
  stock.position.set(0, 0.03, -0.155);
  stock.castShadow = true;

  const buttPadGeo = new THREE.BoxGeometry(0.066, 0.128, 0.03);
  const buttPad = new THREE.Mesh(buttPadGeo, handguardMat);
  buttPad.position.set(0, 0.026, -0.265);
  buttPad.castShadow = true;

  const pistolGripGeo = new THREE.BoxGeometry(0.046, 0.128, 0.064);
  const pistolGrip = new THREE.Mesh(pistolGripGeo, gripMat);
  pistolGrip.position.set(0, -0.026, -0.008);
  pistolGrip.rotation.x = 0.3;
  pistolGrip.castShadow = true;

  const triggerGuardGeo = new THREE.BoxGeometry(0.026, 0.036, 0.054);
  const triggerGuard = new THREE.Mesh(triggerGuardGeo, gunMetalMat);
  triggerGuard.position.set(0, 0.002, 0.042);

  const receiverGeo = new THREE.BoxGeometry(0.074, 0.106, 0.285);
  const receiver = new THREE.Mesh(receiverGeo, gunMetalMat);
  receiver.position.set(0, 0.056, 0.075);
  receiver.castShadow = true;

  const handguardGeo = new THREE.BoxGeometry(0.066, 0.086, 0.23);
  const handguard = new THREE.Mesh(handguardGeo, handguardMat);
  handguard.position.set(0, 0.056, 0.275);
  handguard.castShadow = true;

  const angledForegripGeo = new THREE.BoxGeometry(0.044, 0.066, 0.072);
  const angledForegrip = new THREE.Mesh(angledForegripGeo, gripMat);
  angledForegrip.position.set(0, -0.004, 0.245);
  angledForegrip.rotation.x = -0.22;
  angledForegrip.castShadow = true;

  const barrelGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.33, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, gunMetalMat);
  barrel.position.set(0, 0.066, 0.52);
  barrel.castShadow = true;

  const muzzleBrakeGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.055, 8);
  muzzleBrakeGeo.rotateX(Math.PI / 2);
  const muzzleBrake = new THREE.Mesh(muzzleBrakeGeo, handguardMat);
  muzzleBrake.position.set(0, 0.066, 0.69);

  const magGeo = new THREE.BoxGeometry(0.05, 0.178, 0.078);
  const magazine = new THREE.Mesh(magGeo, gripMat);
  magazine.position.set(0, -0.072, 0.135);
  magazine.rotation.x = -0.08;

  const opticGeo = new THREE.BoxGeometry(0.042, 0.046, 0.105);
  const optic = new THREE.Mesh(opticGeo, sightMat);
  optic.position.set(0, 0.132, 0.065);

  // Left-hand foregrip target sits cleanly ahead of magazine on the angled foregrip/handguard
  const foregripTarget = new THREE.Object3D();
  foregripTarget.position.set(0, -0.008, 0.245);

  const muzzleNode = new THREE.Object3D();
  muzzleNode.position.set(0, 0.066, 0.725);

  group.add(
    stock,
    buttPad,
    pistolGrip,
    triggerGuard,
    receiver,
    handguard,
    angledForegrip,
    barrel,
    muzzleBrake,
    magazine,
    optic,
    foregripTarget,
    muzzleNode,
  );
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.frustumCulled = false;
    }
  });

  return {
    group,
    foregripTarget,
    muzzleNode,
    dispose: () => {
      [
        stockGeo,
        buttPadGeo,
        pistolGripGeo,
        triggerGuardGeo,
        receiverGeo,
        handguardGeo,
        angledForegripGeo,
        barrelGeo,
        muzzleBrakeGeo,
        magGeo,
        opticGeo,
      ].forEach((g) => g.dispose());
      [gunMetalMat, gripMat, handguardMat, sightMat].forEach((m) => m.dispose());
    },
  };
}

function buildCustomRifleInstance(template: CustomRifleTemplate): RifleInstance {
  const group = new THREE.Group();
  const cloned = template.scene.clone(true);
  group.add(cloned);

  const foregripTarget = new THREE.Object3D();
  foregripTarget.position.copy(template.foregripPos);

  const muzzleNode = new THREE.Object3D();
  muzzleNode.position.copy(template.muzzlePos);

  group.add(foregripTarget, muzzleNode);

  return {
    group,
    foregripTarget,
    muzzleNode,
    dispose: () => {
      cloned.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material?.dispose();
        }
      });
    },
  };
}

export async function parseGlbRifleTemplate(buffer: ArrayBuffer): Promise<CustomRifleTemplate> {
  const loader = getSharedGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  const wrapper = new THREE.Group();
  const model = gltf.scene;
  wrapper.add(model);

  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  // Orient longest horizontal axis along +Z (barrel forward)
  if (rawSize.x > rawSize.z * 1.15) {
    model.rotation.y = Math.PI / 2;
  } else if (rawSize.y > rawSize.z * 1.35 && rawSize.y > rawSize.x * 1.35) {
    model.rotation.x = Math.PI / 2;
  }
  wrapper.updateMatrixWorld(true);

  const orientedBox = new THREE.Box3().setFromObject(wrapper);
  const orientedSize = orientedBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(orientedSize.z, orientedSize.x, orientedSize.y, 0.05);
  const scaleFactor = THREE.MathUtils.clamp(0.98 / maxDim, 0.005, 50);
  model.scale.multiplyScalar(scaleFactor);
  wrapper.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const scaledSize = scaledBox.getSize(new THREE.Vector3());

  // Center X, place grip/trigger region (~26% forward from buttstock) at origin (0, 0, 0)
  model.position.x -= scaledCenter.x;
  model.position.y -= scaledBox.min.y + scaledSize.y * 0.34;
  model.position.z -= scaledBox.min.z + scaledSize.z * 0.26;
  wrapper.updateMatrixWorld(true);

  const finalBox = new THREE.Box3().setFromObject(wrapper);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const foregripPos = new THREE.Vector3(
    0,
    THREE.MathUtils.clamp(finalBox.min.y + finalSize.y * 0.3, -0.04, 0.04),
    THREE.MathUtils.clamp(finalBox.max.z * 0.36, 0.16, 0.36),
  );
  const muzzlePos = new THREE.Vector3(
    0,
    THREE.MathUtils.clamp(finalBox.min.y + finalSize.y * 0.62, 0.02, 0.12),
    Math.max(0.42, finalBox.max.z),
  );

  optimizeGltfSceneResources(model, { maxTextureSize: 1024 });
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 1.0;
        }
      });
    }
  });

  return {
    scene: wrapper,
    foregripPos,
    muzzlePos,
    dispose: () => {
      disposeObject3DResources(wrapper, true);
    },
  };
}

function createPistolMesh(): {
  pistolMesh: THREE.Group;
  muzzleNode: THREE.Object3D;
  dispose: () => void;
} {
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f25,
    roughness: 0.26,
    metalness: 0.88,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.08,
  });
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.7,
    roughness: 0.2,
  });

  const pistolMesh = new THREE.Group();
  const pistolSlideGeo = new THREE.BoxGeometry(0.065, 0.085, 0.32);
  const pistolSlide = new THREE.Mesh(pistolSlideGeo, gunMetalMat);
  pistolSlide.position.set(0, 0.06, 0.1);
  pistolSlide.castShadow = true;
  const pistolGripGeo = new THREE.BoxGeometry(0.055, 0.14, 0.08);
  const pistolGrip = new THREE.Mesh(pistolGripGeo, gripMat);
  pistolGrip.position.set(0, -0.02, 0);
  pistolGrip.rotation.x = 0.22;
  const pistolSightGeo = new THREE.BoxGeometry(0.022, 0.022, 0.035);
  const pistolSight = new THREE.Mesh(pistolSightGeo, sightMat);
  pistolSight.position.set(0, 0.11, 0.22);
  const muzzleNode = new THREE.Object3D();
  muzzleNode.position.set(0, 0.07, 0.28);

  pistolMesh.add(pistolSlide, pistolGrip, pistolSight, muzzleNode);
  pistolMesh.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.frustumCulled = false;
    }
  });
  pistolMesh.visible = false;

  return {
    pistolMesh,
    muzzleNode,
    dispose: () => {
      [pistolSlideGeo, pistolGripGeo, pistolSightGeo].forEach((g) => g.dispose());
      [gunMetalMat, gripMat, sightMat].forEach((m) => m.dispose());
    },
  };
}

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  isCustomGlb: boolean;
  bones: HumanoidBoneMap;
  pistolMesh: THREE.Group;
  pistolMuzzle: THREE.Object3D;
  rifleMount: THREE.Group;
  rifleMesh: THREE.Group;
  rifleForegrip: THREE.Object3D;
  rifleMuzzle: THREE.Object3D;
  disposeRifleInstance: () => void;
  visorMat?: THREE.MeshStandardMaterial;
  mixer?: THREE.AnimationMixer | null;
  clips?: Record<string, THREE.AnimationAction>;
  playClip?: (name: string, fadeSec?: number, timeScale?: number) => boolean;
  resetClips?: () => void;
  dispose: () => void;
}

export function applyRifleToRig(
  rig: CharacterRig,
  customTemplate: CustomRifleTemplate | null,
) {
  rig.rifleMount.remove(rig.rifleMesh);
  rig.disposeRifleInstance();

  const next = customTemplate
    ? buildCustomRifleInstance(customTemplate)
    : buildDefaultRifleInstance();
  rig.rifleMesh = next.group;
  rig.rifleForegrip = next.foregripTarget;
  rig.rifleMuzzle = next.muzzleNode;
  rig.disposeRifleInstance = next.dispose;
  rig.rifleMount.add(next.group);
}

export function buildDefaultSurvivor(
  customRifleTemplate: CustomRifleTemplate | null = null,
): CharacterRig {
  const root = new THREE.Group();
  root.name = 'ApocalypseSurvivor';
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1b1917,
    roughness: 0.88,
    metalness: 0.06,
  });
  const cargoMat = new THREE.MeshStandardMaterial({
    color: 0x3f433a,
    roughness: 0.85,
    metalness: 0.04,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x242b33,
    roughness: 0.62,
    metalness: 0.25,
  });
  const packMat = new THREE.MeshStandardMaterial({
    color: 0x5c4732,
    roughness: 0.78,
    metalness: 0.06,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: 0x2c333c,
    roughness: 0.42,
    metalness: 0.48,
  });
  const gunMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f25,
    roughness: 0.26,
    metalness: 0.88,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x1c1e22,
    roughness: 0.8,
    metalness: 0.12,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.7,
    roughness: 0.18,
    metalness: 0.15,
  });

  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.86, 0);
  bodyPivot.add(hipsGroup);

  const kneeJointGeo = new THREE.SphereGeometry(0.096, 8, 8);
  const ankleJointGeo = new THREE.SphereGeometry(0.076, 8, 8);
  const shoulderJointGeo = new THREE.SphereGeometry(0.082, 8, 8);
  const elbowJointGeo = new THREE.SphereGeometry(0.066, 8, 8);
  const wristJointGeo = new THREE.SphereGeometry(0.054, 8, 8);

  const thighGeo = new THREE.CylinderGeometry(0.115, 0.098, 0.42, 10);
  thighGeo.translate(0, -0.21, 0);
  const shinGeo = new THREE.CylinderGeometry(0.094, 0.078, 0.36, 10);
  shinGeo.translate(0, -0.18, 0);
  const bootGeo = new THREE.BoxGeometry(0.165, 0.13, 0.27);

  const makeLeg = (xOffset: number) => {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(xOffset, 0, 0);

    const thigh = new THREE.Mesh(thighGeo, cargoMat);
    thigh.castShadow = true;
    hipPivot.add(thigh);

    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.42, 0);
    hipPivot.add(kneePivot);

    const kneeCap = new THREE.Mesh(kneeJointGeo, vestMat);
    kneeCap.castShadow = true;
    kneePivot.add(kneeCap);

    const shin = new THREE.Mesh(shinGeo, cargoMat);
    shin.castShadow = true;
    kneePivot.add(shin);

    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.36, 0);
    kneePivot.add(anklePivot);

    const ankleBall = new THREE.Mesh(ankleJointGeo, bootMat);
    anklePivot.add(ankleBall);

    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, -0.02, 0.055);
    boot.castShadow = true;
    anklePivot.add(boot);

    return { hipPivot, kneePivot, anklePivot };
  };

  // Character faces +Z with +Y up: +X is anatomical LEFT, -X is anatomical RIGHT
  const legL = makeLeg(0.145);
  const legR = makeLeg(-0.145);
  hipsGroup.add(legL.hipPivot, legR.hipPivot);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.04, 0);
  hipsGroup.add(torsoGroup);

  const torsoGeo = new THREE.BoxGeometry(0.48, 0.62, 0.29);
  const torso = new THREE.Mesh(torsoGeo, vestMat);
  torso.position.y = 0.31;
  torso.castShadow = true;
  torso.receiveShadow = true;
  torsoGroup.add(torso);

  const packGeo = new THREE.BoxGeometry(0.35, 0.42, 0.19);
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.33, -0.23);
  pack.castShadow = true;
  torsoGroup.add(pack);

  const antennaGeo = new THREE.CylinderGeometry(0.014, 0.018, 0.48, 6);
  const antenna = new THREE.Mesh(antennaGeo, gunMetalMat);
  antenna.position.set(0.14, 0.74, -0.27);
  torsoGroup.add(antenna);

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.66, 0);
  torsoGroup.add(headPivot);

  const helmetGeo = new THREE.SphereGeometry(0.205, 14, 12);
  const helmet = new THREE.Mesh(helmetGeo, helmetMat);
  helmet.position.set(0, 0.19, 0);
  helmet.scale.set(1, 1.05, 1.08);
  helmet.castShadow = true;
  headPivot.add(helmet);

  const visorGeo = new THREE.BoxGeometry(0.26, 0.085, 0.14);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.19, 0.18);
  headPivot.add(visor);

  const maskGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.12, 8);
  const maskFilter = new THREE.Mesh(maskGeo, gunMetalMat);
  maskFilter.rotation.x = Math.PI / 2;
  maskFilter.position.set(0, 0.08, 0.21);
  headPivot.add(maskFilter);

  // Articulated 3-segment Human Arms (Shoulder -> Elbow/ForeArm -> Wrist/Hand)
  const upperArmGeo = new THREE.CylinderGeometry(0.076, 0.066, 0.31, 8);
  upperArmGeo.translate(0, -0.155, 0);
  const foreArmGeo = new THREE.CylinderGeometry(0.064, 0.052, 0.29, 8);
  foreArmGeo.translate(0, -0.145, 0);
  const handGeo = new THREE.BoxGeometry(0.088, 0.105, 0.088);

  const makeArm = (xOffset: number) => {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(xOffset, 0.54, 0.02);

    const shoulderBall = new THREE.Mesh(shoulderJointGeo, vestMat);
    shoulderPivot.add(shoulderBall);

    const upperMesh = new THREE.Mesh(upperArmGeo, cargoMat);
    upperMesh.castShadow = true;
    shoulderPivot.add(upperMesh);

    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.31, 0);
    shoulderPivot.add(elbowPivot);

    const elbowBall = new THREE.Mesh(elbowJointGeo, vestMat);
    elbowPivot.add(elbowBall);

    const foreMesh = new THREE.Mesh(foreArmGeo, cargoMat);
    foreMesh.castShadow = true;
    elbowPivot.add(foreMesh);

    const handPivot = new THREE.Group();
    handPivot.position.set(0, -0.29, 0);
    elbowPivot.add(handPivot);

    const wristBall = new THREE.Mesh(wristJointGeo, gloveMat);
    handPivot.add(wristBall);

    const glove = new THREE.Mesh(handGeo, gloveMat);
    glove.position.set(0, -0.045, 0.012);
    glove.castShadow = true;
    handPivot.add(glove);

    return { shoulderPivot, elbowPivot, handPivot };
  };

  // +X is anatomical LEFT arm, -X is anatomical RIGHT arm
  const armL = makeArm(0.305);
  const armR = makeArm(-0.305);
  torsoGroup.add(armL.shoulderPivot, armR.shoulderPivot);

  // Mount weapons squarely inside Right Hand palm (centered on glove at y = -0.045)
  const pistol = createPistolMesh();
  pistol.pistolMesh.position.set(0, -0.045, 0.015);
  pistol.pistolMesh.rotation.x = Math.PI / 2;
  armR.handPivot.add(pistol.pistolMesh);

  const rifleMount = new THREE.Group();
  rifleMount.position.set(0, -0.045, 0.015);
  rifleMount.rotation.x = Math.PI / 2;
  armR.handPivot.add(rifleMount);

  const rifle = customRifleTemplate
    ? buildCustomRifleInstance(customRifleTemplate)
    : buildDefaultRifleInstance();
  rifleMount.add(rifle.group);

  const bones: HumanoidBoneMap = {
    hips: captureBoneRest(hipsGroup),
    spine: captureBoneRest(torsoGroup),
    neck: null,
    head: captureBoneRest(headPivot),
    leftUpLeg: captureBoneRest(legL.hipPivot),
    leftLeg: captureBoneRest(legL.kneePivot),
    leftFoot: captureBoneRest(legL.anklePivot),
    rightUpLeg: captureBoneRest(legR.hipPivot),
    rightLeg: captureBoneRest(legR.kneePivot),
    rightFoot: captureBoneRest(legR.anklePivot),
    leftArm: captureBoneRest(armL.shoulderPivot),
    leftForeArm: captureBoneRest(armL.elbowPivot),
    leftHandRest: captureBoneRest(armL.handPivot),
    rightArm: captureBoneRest(armR.shoulderPivot),
    rightForeArm: captureBoneRest(armR.elbowPivot),
    rightHandRest: captureBoneRest(armR.handPivot),
    rightHand: armR.handPivot,
    leftHand: armL.handPivot,
    armDropAngle: 0,
  };

  const geometries = [
    kneeJointGeo,
    ankleJointGeo,
    shoulderJointGeo,
    elbowJointGeo,
    wristJointGeo,
    thighGeo,
    shinGeo,
    bootGeo,
    torsoGeo,
    packGeo,
    antennaGeo,
    helmetGeo,
    visorGeo,
    maskGeo,
    upperArmGeo,
    foreArmGeo,
    handGeo,
  ];
  const materials = [
    bootMat,
    cargoMat,
    vestMat,
    packMat,
    helmetMat,
    gunMetalMat,
    gloveMat,
    visorMat,
  ];

  const rig: CharacterRig = {
    root,
    bodyPivot,
    isCustomGlb: false,
    bones,
    pistolMesh: pistol.pistolMesh,
    pistolMuzzle: pistol.muzzleNode,
    rifleMount,
    rifleMesh: rifle.group,
    rifleForegrip: rifle.foregripTarget,
    rifleMuzzle: rifle.muzzleNode,
    disposeRifleInstance: rifle.dispose,
    visorMat,
    dispose: () => {
      pistol.dispose();
      rig.disposeRifleInstance();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };

  prepareActorHierarchy(root, false);

  return rig;
}

function prepareActorHierarchy(root: THREE.Object3D, sanitizeOpaqueBlend = false) {
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      // SkinnedMesh and bone-driven limbs deform outside their static bind-pose bounding sphere;
      // disabling frustum culling avoids sub-meshes popping out in parts while walking.
      mesh.frustumCulled = false;

      if (!sanitizeOpaqueBlend) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        const stdMat = m as THREE.MeshStandardMaterial;
        const hasAlphaMap = 'alphaMap' in stdMat && Boolean(stdMat.alphaMap);
        if (m.transparent && m.opacity >= 0.98 && !hasAlphaMap) {
          m.transparent = false;
          m.depthWrite = true;
          m.depthTest = true;
          if ('map' in stdMat && stdMat.map) {
            m.alphaTest = Math.max(m.alphaTest || 0, 0.35);
          }
          m.needsUpdate = true;
        } else if (!m.transparent) {
          m.depthWrite = true;
          m.depthTest = true;
        }
      });
    }
  });
}

function normalizeModelToHeight(
  model: THREE.Object3D,
  targetHeight: number,
  isCharacter = false,
) {
  model.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(model);
  const size = rawBox.getSize(new THREE.Vector3());
  const center = rawBox.getCenter(new THREE.Vector3());

  const maxHeight = Math.max(size.y, 0.01);
  const scaleFactor = THREE.MathUtils.clamp(targetHeight / maxHeight, 0.01, 100);
  model.scale.multiplyScalar(scaleFactor);
  model.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= scaledCenter.x;
  model.position.z -= scaledCenter.z;
  model.position.y -= scaledBox.min.y;

  if (!Number.isFinite(model.position.y)) {
    model.position.set(-center.x, 0, -center.z);
  }

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 0.9;
        }
      });
    }
  });
  prepareActorHierarchy(model, isCharacter);
}

function createClipController(
  targetRoot: THREE.Object3D,
  animations: THREE.AnimationClip[],
  role: 'player' | 'zombie',
) {
  const clips: Record<string, THREE.AnimationAction> = {};
  if (animations.length === 0) {
    return {
      mixer: null as THREE.AnimationMixer | null,
      clips,
      playClip: (_name: string, _fadeSec?: number, _timeScale?: number) => false,
      resetClips: () => {},
      disposeMixer: () => {},
    };
  }

  const mixer = new THREE.AnimationMixer(targetRoot);
  let current: THREE.AnimationAction | null = null;
  let currentName: string | null = null;

  animations.forEach((clip) => {
    const n = clip.name.toLowerCase();
    const clean = n.replace(/[_-]+/g, ' ').trim();
    const act = mixer.clipAction(clip);
    if (role === 'player') {
      if (clean.includes('paseo') || clean.includes('casual') || clean.includes('idle')) {
        clips['idle'] = act;
      } else if (clean.includes('caminando') || clean.includes('caminado') || clean.includes('walk')) {
        clips['walk'] = act;
      } else if (clean.includes('rapido') || clean.includes('rápido') || clean.includes('sprint')) {
        clips['sprint'] = act;
      } else if (clean.includes('corriendo') || clean.includes('run')) {
        clips['run'] = act;
      } else if (clean.includes('muerto') || clean.includes('death') || clean.includes('dead')) {
        clips['death'] = act;
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      }
    } else {
      if (
        clean.includes('errant') ||
        /\berante\b/.test(clean) ||
        clean.includes('wander') ||
        clean.includes('roam') ||
        clean.includes('deambular') ||
        clean.includes('vagabund')
      ) {
        clips['errante'] = act;
      } else if (
        clean.includes('inestable') ||
        clean.includes('unstable') ||
        clean.includes('unsteady') ||
        clean.includes('stagger') ||
        clean.includes('shamble') ||
        clean.includes('limp')
      ) {
        clips['inestable'] = act;
      } else if (
        clean.includes('orco') ||
        clean.includes('orc') ||
        clean.includes('lento') ||
        clean.includes('slow')
      ) {
        clips['orco'] = act;
      } else if (
        clean.includes('caminando') ||
        clean.includes('caminado') ||
        clean.includes('caminar') ||
        clean.includes('walk')
      ) {
        clips['walk'] = act;
      } else if (clean.includes('corriendo') || clean.includes('run')) {
        clips['run'] = act;
      } else if (/(?:habilidad|skill|ability)\s*0*1\b/.test(clean)) {
        clips['habilidad1'] = act;
      } else if (/(?:habilidad|skill|ability)\s*0*3\b/.test(clean)) {
        clips['habilidad3'] = act;
      } else if (
        clean.includes('muerto') ||
        clean.includes('death') ||
        clean.includes('dead') ||
        /\bdie\b/.test(clean)
      ) {
        clips['death'] = act;
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      }
    }
  });

  const hasRecognized = Object.keys(clips).length > 0;
  if (!hasRecognized) {
    return {
      mixer: null as THREE.AnimationMixer | null,
      clips,
      playClip: (_name: string, _fadeSec?: number, _timeScale?: number) => false,
      resetClips: () => {},
      disposeMixer: () => {},
    };
  }

  const playClip = (name: string, fadeSec = 0.18, timeScale = 1): boolean => {
    const next = clips[name];
    if (!next) return false;
    next.timeScale = timeScale;
    if (next === current && currentName === name) return true;
    next.reset().setEffectiveWeight(1).play();
    if (current && current !== next) {
      current.crossFadeTo(next, fadeSec, true);
    }
    current = next;
    currentName = name;
    return true;
  };

  const resetClips = () => {
    mixer.stopAllAction();
    current = null;
    currentName = null;
  };

  const disposeMixer = () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(targetRoot);
    current = null;
    currentName = null;
  };

  return { mixer, clips, playClip, resetClips, disposeMixer };
}

// Loads custom Player .glb, matches recognized Meshy animation clips if present (idle/walk/run/sprint/death),
// and extracts skeleton bones for weapon IK, head tracking, crouch, and procedural fallback poses!
export async function parseGlbCharacter(
  buffer: ArrayBuffer,
  customRifleTemplate: CustomRifleTemplate | null = null,
): Promise<CharacterRig> {
  const loader = getSharedGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  const model = gltf.scene;
  optimizeGltfSceneResources(model, { maxTextureSize: 1024 });
  const root = new THREE.Group();
  root.name = 'CustomGlbSurvivor';
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  normalizeModelToHeight(model, 1.9, true);
  bodyPivot.add(model);

  const bones = extractHumanoidBones(model);
  const clipCtrl = createClipController(model, gltf.animations, 'player');
  const pistol = createPistolMesh();
  const rifleMount = new THREE.Group();
  const rifle = customRifleTemplate
    ? buildCustomRifleInstance(customRifleTemplate)
    : buildDefaultRifleInstance();
  rifleMount.add(rifle.group);

  // Attach Pistol & Rifle Mount to RightHand palm center (slightly forward from wrist toward fingers)
  if (bones.rightHand) {
    const worldScale = new THREE.Vector3();
    bones.rightHand.getWorldScale(worldScale);
    const invScale = 1 / Math.max(0.01, worldScale.x);
    pistol.pistolMesh.scale.setScalar(invScale);
    rifleMount.scale.setScalar(invScale);

    const fingerChild = bones.rightHand.children.find((c) => c !== pistol.pistolMesh && c !== rifleMount);
    if (fingerChild && fingerChild.position.lengthSq() > 1e-6) {
      const palmDir = fingerChild.position.clone().normalize();
      const palmDistLocal = Math.min(fingerChild.position.length() * 0.55, 0.042 * invScale);
      const palmOffset = palmDir.multiplyScalar(palmDistLocal);
      pistol.pistolMesh.position.copy(palmOffset);
      rifleMount.position.copy(palmOffset);
    }

    bones.rightHand.add(pistol.pistolMesh, rifleMount);
  } else {
    pistol.pistolMesh.position.set(0.28, 1.15, 0.35);
    rifleMount.position.set(0.24, 1.15, 0.35);
    bodyPivot.add(pistol.pistolMesh, rifleMount);
  }

  const rig: CharacterRig = {
    root,
    bodyPivot,
    isCustomGlb: true,
    bones,
    pistolMesh: pistol.pistolMesh,
    pistolMuzzle: pistol.muzzleNode,
    rifleMount,
    rifleMesh: rifle.group,
    rifleForegrip: rifle.foregripTarget,
    rifleMuzzle: rifle.muzzleNode,
    disposeRifleInstance: rifle.dispose,
    mixer: clipCtrl.mixer,
    clips: clipCtrl.clips,
    playClip: clipCtrl.playClip,
    resetClips: clipCtrl.resetClips,
    dispose: () => {
      clipCtrl.disposeMixer();
      pistol.dispose();
      rig.disposeRifleInstance();
      disposeObject3DResources(model, true);
    },
  };

  return rig;
}

// Custom Zombie GLB template (preserves Meshy animations for instanced playback + skeleton bones for procedural fallback)
export interface CustomZombieTemplate {
  name: string;
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  height: number;
  dispose: () => void;
}

export async function parseGlbZombieTemplate(
  buffer: ArrayBuffer,
  fileName = 'custom_zombie.glb',
): Promise<CustomZombieTemplate> {
  const loader = getSharedGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  const model = gltf.scene;
  optimizeGltfSceneResources(model, { maxTextureSize: 1024 });
  normalizeModelToHeight(model, 1.95, true);
  const box = new THREE.Box3().setFromObject(model);
  const height = Math.max(1.5, box.getSize(new THREE.Vector3()).y);

  return {
    name: fileName,
    scene: model,
    animations: gltf.animations,
    height,
    dispose: () => {
      disposeObject3DResources(model, true);
    },
  };
}

export interface CampfireVisuals {
  group: THREE.Group;
  flameOuter: THREE.Mesh;
  flameInner: THREE.Mesh;
  warmthRing: THREE.Mesh;
  dispose: () => void;
}

export function buildCampfireGroup(
  stoneTex: THREE.CanvasTexture,
  barkTex?: THREE.CanvasTexture,
): CampfireVisuals {
  const group = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x693424,
    roughness: 0.72,
    metalness: 0.55,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  const logMat = new THREE.MeshStandardMaterial({
    map: barkTex ?? null,
    color: 0x2a1d14,
    roughness: 0.92,
    metalness: 0.04,
  });
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff6b1a,
    emissive: new THREE.Color(0xff5500),
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  const flameOuterMat = new THREE.MeshStandardMaterial({
    color: 0xff8a1f,
    emissive: new THREE.Color(0xff5e00),
    emissiveIntensity: 2.35,
    roughness: 0.3,
    transparent: true,
    opacity: 0.88,
  });
  const flameInnerMat = new THREE.MeshStandardMaterial({
    color: 0xffe27a,
    emissive: new THREE.Color(0xffcc33),
    emissiveIntensity: 2.9,
    roughness: 0.2,
  });

  const barrelGeo = new THREE.CylinderGeometry(0.62, 0.65, 1.15, 14);
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.y = 0.58;
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  group.add(barrel);

  const rimGeo = new THREE.TorusGeometry(0.62, 0.042, 8, 18);
  rimGeo.rotateX(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, barrelMat);
  rim.position.y = 1.14;
  group.add(rim);

  const blockGeo = new THREE.BoxGeometry(0.68, 0.32, 0.42);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const block = new THREE.Mesh(blockGeo, concreteMat);
    block.position.set(Math.cos(a) * 1.18, 0.16, Math.sin(a) * 1.18);
    block.rotation.y = -a + Math.PI / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    group.add(block);
  }

  const logGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.92, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.35;
    const log = new THREE.Mesh(logGeo, logMat);
    log.position.set(Math.cos(a) * 0.16, 1.24, Math.sin(a) * 0.16);
    log.rotation.set(Math.sin(a) * 0.72, a, Math.cos(a) * 0.72);
    log.castShadow = true;
    group.add(log);
  }

  const ashBed = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12), emberMat);
  ashBed.position.y = 1.12;
  group.add(ashBed);

  const flameOuterGeo = new THREE.ConeGeometry(0.5, 1.4, 7);
  const flameOuter = new THREE.Mesh(flameOuterGeo, flameOuterMat);
  flameOuter.position.y = 1.68;
  group.add(flameOuter);

  const flameInnerGeo = new THREE.ConeGeometry(0.28, 0.95, 6);
  const flameInner = new THREE.Mesh(flameInnerGeo, flameInnerMat);
  flameInner.position.y = 1.52;
  group.add(flameInner);

  const ringGeo = new THREE.RingGeometry(
    CAMPFIRE_SAFE_RADIUS - 0.16,
    CAMPFIRE_SAFE_RADIUS + 0.1,
    64,
  );
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const warmthRing = new THREE.Mesh(ringGeo, ringMat);
  warmthRing.position.y = 0.03;
  group.add(warmthRing);
  group.position.set(CAMPFIRE_X, groundHeightAt(CAMPFIRE_X, CAMPFIRE_Z), CAMPFIRE_Z);

  return {
    group,
    flameOuter,
    flameInner,
    warmthRing,
    dispose: () => {
      barrelGeo.dispose();
      rimGeo.dispose();
      blockGeo.dispose();
      logGeo.dispose();
      ashBed.geometry.dispose();
      flameOuterGeo.dispose();
      flameInnerGeo.dispose();
      ringGeo.dispose();
      barrelMat.dispose();
      concreteMat.dispose();
      logMat.dispose();
      emberMat.dispose();
      flameOuterMat.dispose();
      flameInnerMat.dispose();
      ringMat.dispose();
    },
  };
}

export interface EnemyMeshBundle {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  bodyMaterials: THREE.MeshStandardMaterial[];
  telegraphRing: THREE.Mesh;
  hpBarGroup: THREE.Group;
  hpFillMesh: THREE.Mesh;
  hpFillMat: THREE.MeshBasicMaterial;
  awarenessIcon: THREE.Sprite;
  awarenessBaseY: number;
  bones: HumanoidBoneMap;
  isCustomGlb: boolean;
  preferWalkClip?: string;
  mixer?: THREE.AnimationMixer | null;
  clips?: Record<string, THREE.AnimationAction>;
  playClip?: (name: string, fadeSec?: number, timeScale?: number) => boolean;
  resetClips?: () => void;
  dispose: () => void;
}

function attachWorldHealthBar(
  parent: THREE.Group,
  heightOffset: number,
  width = 1.1,
): {
  hpBarGroup: THREE.Group;
  hpFillMesh: THREE.Mesh;
  hpFillMat: THREE.MeshBasicMaterial;
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
} {
  const hpBarGroup = new THREE.Group();
  hpBarGroup.position.set(0, heightOffset, 0);
  hpBarGroup.visible = false;

  const bgGeo = new THREE.PlaneGeometry(width + 0.08, 0.14);
  const bgMat = new THREE.MeshBasicMaterial({
    color: 0x090d14,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: true,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  hpBarGroup.add(bgMesh);

  const fillGeo = new THREE.PlaneGeometry(width, 0.085);
  fillGeo.translate(width / 2, 0, 0);
  const hpFillMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
  });
  const hpFillMesh = new THREE.Mesh(fillGeo, hpFillMat);
  hpFillMesh.position.set(-width / 2, 0, 0.01);
  hpBarGroup.add(hpFillMesh);

  parent.add(hpBarGroup);
  return { hpBarGroup, hpFillMesh, hpFillMat, geos: [bgGeo, fillGeo], mats: [bgMat, hpFillMat] };
}

export function buildEnemyMesh(
  kind: EnemyKind,
  customTemplate: CustomZombieTemplate | null = null,
): EnemyMeshBundle {
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const bodyMaterials: THREE.MeshStandardMaterial[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const extraMats: THREE.Material[] = [];

  let isCustomGlb = false;
  let zombieClipCtrl: ReturnType<typeof createClipController> | null = null;
  let bones: HumanoidBoneMap = {
    hips: null,
    spine: null,
    neck: null,
    head: null,
    leftUpLeg: null,
    leftLeg: null,
    leftFoot: null,
    rightUpLeg: null,
    rightLeg: null,
    rightFoot: null,
    leftArm: null,
    leftForeArm: null,
    leftHandRest: null,
    rightArm: null,
    rightForeArm: null,
    rightHandRest: null,
    rightHand: null,
    leftHand: null,
    armDropAngle: 0,
  };

  let barHeight = kind === 'brute' ? 2.65 : 2.15;

  if (customTemplate) {
    isCustomGlb = true;
    const cloned = SkeletonUtils.clone(customTemplate.scene) as THREE.Group;
    const scaleMult = kind === 'brute' ? 1.32 : kind === 'spitter' ? 1.05 : 0.96;
    cloned.scale.multiplyScalar(scaleMult);
    bodyPivot.add(cloned);
    barHeight = customTemplate.height * scaleMult + 0.35;

    const clonedMatMap = new Map<THREE.Material, THREE.Material>();
    const cloneMatOnce = (mat: THREE.Material): THREE.Material => {
      const hit = clonedMatMap.get(mat);
      if (hit) return hit;
      const clonedMat = mat.clone();
      clonedMatMap.set(mat, clonedMat);
      if ((clonedMat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
        bodyMaterials.push(clonedMat as THREE.MeshStandardMaterial);
      }
      extraMats.push(clonedMat);
      return clonedMat;
    };

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (Array.isArray(m.material)) {
          m.material = m.material.map(cloneMatOnce);
        } else if (m.material) {
          m.material = cloneMatOnce(m.material);
        }
      }
    });

    zombieClipCtrl = createClipController(cloned, customTemplate.animations, 'zombie');
    bones = extractHumanoidBones(cloned);
  } else {
    const zombieSkin = new THREE.MeshStandardMaterial({
      color: kind === 'spitter' ? 0x4d6b47 : kind === 'brute' ? 0x4b5349 : 0x5c6b58,
      roughness: 0.84,
      metalness: 0.04,
    });
    const tatteredCloth = new THREE.MeshStandardMaterial({
      color: kind === 'brute' ? 0x252a34 : kind === 'spitter' ? 0x2e3b2f : 0x38322e,
      roughness: 0.9,
      metalness: 0.08,
    });
    const infectedGlow = new THREE.MeshStandardMaterial({
      color: kind === 'spitter' ? 0xa3e635 : 0xf43f5e,
      emissive: new THREE.Color(kind === 'spitter' ? 0x84cc16 : 0xe11d48),
      emissiveIntensity: 1.9,
      roughness: 0.25,
    });
    bodyMaterials.push(zombieSkin, tatteredCloth, infectedGlow);
    extraMats.push(zombieSkin, tatteredCloth, infectedGlow);

    let leftArm: THREE.Object3D | null = null;
    let rightArm: THREE.Object3D | null = null;
    let leftForeArm: THREE.Object3D | null = null;
    let rightForeArm: THREE.Object3D | null = null;
    let leftUpLeg: THREE.Object3D | null = null;
    let rightUpLeg: THREE.Object3D | null = null;
    let leftKnee: THREE.Object3D | null = null;
    let rightKnee: THREE.Object3D | null = null;
    let leftFoot: THREE.Object3D | null = null;
    let rightFoot: THREE.Object3D | null = null;
    let torsoNode: THREE.Object3D | null = null;
    let headNode: THREE.Object3D | null = null;

    if (kind === 'stalker') {
      const thighGeo = new THREE.CylinderGeometry(0.095, 0.082, 0.36, 7);
      thighGeo.translate(0, -0.18, 0);
      const shinGeo = new THREE.CylinderGeometry(0.08, 0.068, 0.34, 7);
      shinGeo.translate(0, -0.17, 0);
      const footGeo = new THREE.BoxGeometry(0.14, 0.1, 0.22);
      geos.push(thighGeo, shinGeo, footGeo);

      const makeZLeg = (lx: number) => {
        const up = new THREE.Group();
        up.position.set(lx, 0.72, 0);
        const tMesh = new THREE.Mesh(thighGeo, tatteredCloth);
        tMesh.castShadow = true;
        up.add(tMesh);

        const knee = new THREE.Group();
        knee.position.set(0, -0.36, 0);
        const sMesh = new THREE.Mesh(shinGeo, tatteredCloth);
        sMesh.castShadow = true;
        knee.add(sMesh);

        const foot = new THREE.Group();
        foot.position.set(0, -0.34, 0);
        const fMesh = new THREE.Mesh(footGeo, tatteredCloth);
        fMesh.position.set(0, 0.01, 0.045);
        fMesh.castShadow = true;
        foot.add(fMesh);
        knee.add(foot);

        up.add(knee);
        bodyPivot.add(up);
        return { up, knee, foot };
      };
      const zLegL = makeZLeg(0.14);
      const zLegR = makeZLeg(-0.14);
      leftUpLeg = zLegL.up;
      leftKnee = zLegL.knee;
      leftFoot = zLegL.foot;
      rightUpLeg = zLegR.up;
      rightKnee = zLegR.knee;
      rightFoot = zLegR.foot;

      torsoNode = new THREE.Group();
      torsoNode.position.set(0, 0.72, 0);
      bodyPivot.add(torsoNode);

      const torsoGeo = new THREE.BoxGeometry(0.46, 0.62, 0.28);
      const torsoMesh = new THREE.Mesh(torsoGeo, tatteredCloth);
      torsoMesh.position.set(0, 0.31, 0.02);
      torsoMesh.castShadow = true;
      torsoNode.add(torsoMesh);
      geos.push(torsoGeo);

      headNode = new THREE.Group();
      headNode.position.set(0, 0.66, 0.06);
      torsoNode.add(headNode);

      const headGeo = new THREE.SphereGeometry(0.2, 10, 8);
      const headMesh = new THREE.Mesh(headGeo, zombieSkin);
      headMesh.position.set(0, 0.14, 0.02);
      headMesh.castShadow = true;
      headNode.add(headMesh);
      geos.push(headGeo);

      const eyeGeo = new THREE.BoxGeometry(0.22, 0.06, 0.08);
      const eyes = new THREE.Mesh(eyeGeo, infectedGlow);
      eyes.position.set(0, 0.16, 0.18);
      headNode.add(eyes);
      geos.push(eyeGeo);

      const shGeo = new THREE.SphereGeometry(0.078, 7, 7);
      const upArmGeo = new THREE.CylinderGeometry(0.072, 0.06, 0.3, 7);
      upArmGeo.translate(0, -0.15, 0);
      const elGeo = new THREE.SphereGeometry(0.062, 7, 7);
      const foreGeo = new THREE.CylinderGeometry(0.058, 0.044, 0.28, 7);
      foreGeo.translate(0, -0.14, 0);
      geos.push(shGeo, upArmGeo, elGeo, foreGeo);

      const makeZArm = (ax: number) => {
        const sh = new THREE.Group();
        sh.position.set(ax, 0.56, 0.03);
        const shBall = new THREE.Mesh(shGeo, tatteredCloth);
        sh.add(shBall);
        const uMesh = new THREE.Mesh(upArmGeo, zombieSkin);
        uMesh.castShadow = true;
        sh.add(uMesh);

        const el = new THREE.Group();
        el.position.set(0, -0.29, 0);
        const elBall = new THREE.Mesh(elGeo, zombieSkin);
        el.add(elBall);
        const fMesh = new THREE.Mesh(foreGeo, zombieSkin);
        fMesh.castShadow = true;
        el.add(fMesh);
        sh.add(el);
        torsoNode!.add(sh);
        return { sh, el };
      };
      const zArmL = makeZArm(0.29);
      const zArmR = makeZArm(-0.29);
      leftArm = zArmL.sh;
      leftForeArm = zArmL.el;
      rightArm = zArmR.sh;
      rightForeArm = zArmR.el;
    } else if (kind === 'spitter') {
      const thighGeo = new THREE.CylinderGeometry(0.11, 0.095, 0.32, 7);
      thighGeo.translate(0, -0.16, 0);
      const shinGeo = new THREE.CylinderGeometry(0.092, 0.075, 0.3, 7);
      shinGeo.translate(0, -0.15, 0);
      geos.push(thighGeo, shinGeo);
      const makeSpitterLeg = (lx: number) => {
        const up = new THREE.Group();
        up.position.set(lx, 0.62, 0);
        const tMesh = new THREE.Mesh(thighGeo, tatteredCloth);
        tMesh.castShadow = true;
        up.add(tMesh);
        const knee = new THREE.Group();
        knee.position.set(0, -0.32, 0);
        const sMesh = new THREE.Mesh(shinGeo, tatteredCloth);
        sMesh.castShadow = true;
        knee.add(sMesh);
        up.add(knee);
        bodyPivot.add(up);
        return { up, knee };
      };
      const spLegL = makeSpitterLeg(0.18);
      const spLegR = makeSpitterLeg(-0.18);
      leftUpLeg = spLegL.up;
      leftKnee = spLegL.knee;
      rightUpLeg = spLegR.up;
      rightKnee = spLegR.knee;

      torsoNode = new THREE.Group();
      torsoNode.position.set(0, 0.62, 0);
      bodyPivot.add(torsoNode);

      const torsoGeo = new THREE.DodecahedronGeometry(0.42, 0);
      const torsoMesh = new THREE.Mesh(torsoGeo, zombieSkin);
      torsoMesh.position.set(0, 0.4, 0);
      torsoMesh.scale.set(1.05, 1.15, 0.95);
      torsoMesh.castShadow = true;
      torsoNode.add(torsoMesh);
      geos.push(torsoGeo);

      const sacGeo = new THREE.SphereGeometry(0.22, 8, 8);
      geos.push(sacGeo);
      const sac1 = new THREE.Mesh(sacGeo, infectedGlow);
      sac1.position.set(-0.26, 0.53, -0.15);
      const sac2 = new THREE.Mesh(sacGeo, infectedGlow);
      sac2.scale.setScalar(0.8);
      sac2.position.set(0.28, 0.36, 0.14);
      torsoNode.add(sac1, sac2);

      headNode = new THREE.Group();
      headNode.position.set(0, 0.82, 0.1);
      torsoNode.add(headNode);

      const headGeo = new THREE.SphereGeometry(0.22, 10, 8);
      const headMesh = new THREE.Mesh(headGeo, zombieSkin);
      headMesh.position.set(0, 0.1, 0.02);
      headMesh.castShadow = true;
      headNode.add(headMesh);
      geos.push(headGeo);

      const jawGeo = new THREE.BoxGeometry(0.22, 0.1, 0.14);
      const jaw = new THREE.Mesh(jawGeo, infectedGlow);
      jaw.position.set(0, 0.04, 0.18);
      headNode.add(jaw);
      geos.push(jawGeo);

      const sArmGeo = new THREE.CylinderGeometry(0.068, 0.056, 0.28, 7);
      sArmGeo.translate(0, -0.14, 0);
      const sForeGeo = new THREE.CylinderGeometry(0.054, 0.04, 0.26, 7);
      sForeGeo.translate(0, -0.13, 0);
      geos.push(sArmGeo, sForeGeo);

      const makeSpitterArm = (ax: number) => {
        const sh = new THREE.Group();
        sh.position.set(ax, 0.62, 0.06);
        const uMesh = new THREE.Mesh(sArmGeo, zombieSkin);
        uMesh.castShadow = true;
        sh.add(uMesh);
        const el = new THREE.Group();
        el.position.set(0, -0.27, 0);
        const fMesh = new THREE.Mesh(sForeGeo, zombieSkin);
        fMesh.castShadow = true;
        el.add(fMesh);
        sh.add(el);
        torsoNode!.add(sh);
        return { sh, el };
      };
      const spArmL = makeSpitterArm(0.41);
      const spArmR = makeSpitterArm(-0.41);
      leftArm = spArmL.sh;
      leftForeArm = spArmL.el;
      rightArm = spArmR.sh;
      rightForeArm = spArmR.el;
    } else {
      const thighGeo = new THREE.BoxGeometry(0.36, 0.42, 0.36);
      thighGeo.translate(0, -0.21, 0);
      const shinGeo = new THREE.BoxGeometry(0.33, 0.38, 0.34);
      shinGeo.translate(0, -0.19, 0);
      geos.push(thighGeo, shinGeo);
      const makeBruteLeg = (lx: number) => {
        const up = new THREE.Group();
        up.position.set(lx, 0.8, 0);
        const tMesh = new THREE.Mesh(thighGeo, tatteredCloth);
        tMesh.castShadow = true;
        up.add(tMesh);
        const knee = new THREE.Group();
        knee.position.set(0, -0.42, 0);
        const sMesh = new THREE.Mesh(shinGeo, tatteredCloth);
        sMesh.castShadow = true;
        knee.add(sMesh);
        up.add(knee);
        bodyPivot.add(up);
        return { up, knee };
      };
      const brLegL = makeBruteLeg(0.34);
      const brLegR = makeBruteLeg(-0.34);
      leftUpLeg = brLegL.up;
      leftKnee = brLegL.knee;
      rightUpLeg = brLegR.up;
      rightKnee = brLegR.knee;

      torsoNode = new THREE.Group();
      torsoNode.position.set(0, 0.8, 0);
      bodyPivot.add(torsoNode);

      const chestGeo = new THREE.BoxGeometry(1.18, 1.05, 0.78);
      const chestMesh = new THREE.Mesh(chestGeo, tatteredCloth);
      chestMesh.position.y = 0.52;
      chestMesh.castShadow = true;
      torsoNode.add(chestMesh);
      geos.push(chestGeo);

      const pauldronGeo = new THREE.DodecahedronGeometry(0.4, 0);
      geos.push(pauldronGeo);
      [-0.68, 0.68].forEach((px) => {
        const p = new THREE.Mesh(pauldronGeo, zombieSkin);
        p.position.set(px, 0.88, 0);
        p.castShadow = true;
        torsoNode!.add(p);
      });

      const bUpArmGeo = new THREE.BoxGeometry(0.32, 0.46, 0.32);
      bUpArmGeo.translate(0, -0.22, 0);
      const bForeGeo = new THREE.BoxGeometry(0.28, 0.44, 0.28);
      bForeGeo.translate(0, -0.22, 0);
      geos.push(bUpArmGeo, bForeGeo);

      const makeBruteArm = (ax: number) => {
        const sh = new THREE.Group();
        sh.position.set(ax, 0.82, 0.06);
        const uMesh = new THREE.Mesh(bUpArmGeo, zombieSkin);
        uMesh.castShadow = true;
        sh.add(uMesh);
        const el = new THREE.Group();
        el.position.set(0, -0.44, 0);
        const fMesh = new THREE.Mesh(bForeGeo, zombieSkin);
        fMesh.castShadow = true;
        el.add(fMesh);
        sh.add(el);
        torsoNode!.add(sh);
        return { sh, el };
      };
      const bArmL = makeBruteArm(0.74);
      const bArmR = makeBruteArm(-0.74);
      leftArm = bArmL.sh;
      leftForeArm = bArmL.el;
      rightArm = bArmR.sh;
      rightForeArm = bArmR.el;

      headNode = new THREE.Group();
      headNode.position.set(0, 1.08, 0.06);
      torsoNode.add(headNode);

      const headGeo = new THREE.BoxGeometry(0.46, 0.44, 0.46);
      const headMesh = new THREE.Mesh(headGeo, tatteredCloth);
      headMesh.position.set(0, 0.18, 0);
      headMesh.castShadow = true;
      headNode.add(headMesh);
      geos.push(headGeo);

      const visorGeo = new THREE.BoxGeometry(0.38, 0.12, 0.12);
      const visor = new THREE.Mesh(visorGeo, infectedGlow);
      visor.position.set(0, 0.2, 0.22);
      headNode.add(visor);
      geos.push(visorGeo);
    }

    bones = {
      hips: null,
      spine: captureBoneRest(torsoNode),
      neck: null,
      head: captureBoneRest(headNode),
      leftUpLeg: captureBoneRest(leftUpLeg),
      leftLeg: captureBoneRest(leftKnee),
      leftFoot: captureBoneRest(leftFoot),
      rightUpLeg: captureBoneRest(rightUpLeg),
      rightLeg: captureBoneRest(rightKnee),
      rightFoot: captureBoneRest(rightFoot),
      leftArm: captureBoneRest(leftArm),
      leftForeArm: captureBoneRest(leftForeArm),
      leftHandRest: null,
      rightArm: captureBoneRest(rightArm),
      rightForeArm: captureBoneRest(rightForeArm),
      rightHandRest: null,
      rightHand: null,
      leftHand: null,
      armDropAngle: 0,
    };
  }

  prepareActorHierarchy(bodyPivot, false);

  const bar = attachWorldHealthBar(group, barHeight, kind === 'brute' ? 1.45 : 1.05);
  geos.push(...bar.geos);
  extraMats.push(...bar.mats);

  const telGeo = new THREE.RingGeometry(0.75, 0.96, 32);
  telGeo.rotateX(-Math.PI / 2);
  const telMat = new THREE.MeshBasicMaterial({
    color: kind === 'spitter' ? 0x84cc16 : 0xef4444,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const telegraphRing = new THREE.Mesh(telGeo, telMat);
  telegraphRing.position.y = 0.04;
  group.add(telegraphRing);

  const iconTextures = getAwarenessIconTextures();
  const awarenessBaseY = barHeight - 0.04;
  const iconMat = new THREE.SpriteMaterial({
    map: iconTextures.question,
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
    depthWrite: false,
  });
  const awarenessIcon = new THREE.Sprite(iconMat);
  awarenessIcon.position.set(0, awarenessBaseY, 0);
  awarenessIcon.scale.set(0.36, 0.36, 1);
  awarenessIcon.visible = false;
  group.add(awarenessIcon);

  return {
    group,
    bodyPivot,
    bodyMaterials,
    telegraphRing,
    hpBarGroup: bar.hpBarGroup,
    hpFillMesh: bar.hpFillMesh,
    hpFillMat: bar.hpFillMat,
    awarenessIcon,
    awarenessBaseY,
    bones,
    isCustomGlb,
    preferWalkClip: customTemplate && /riber/i.test(customTemplate.name) ? 'errante' : undefined,
    mixer: zombieClipCtrl?.mixer ?? null,
    clips: zombieClipCtrl?.clips,
    playClip: zombieClipCtrl?.playClip,
    resetClips: zombieClipCtrl?.resetClips,
    dispose: () => {
      zombieClipCtrl?.disposeMixer();
      geos.forEach((g) => g.dispose());
      telGeo.dispose();
      telMat.dispose();
      iconMat.dispose();
      extraMats.forEach((m) => m.dispose());
    },
  };
}

export type LimbId =
  | 'head'
  | 'leftShoulder'
  | 'leftElbow'
  | 'rightShoulder'
  | 'rightElbow'
  | 'leftHip'
  | 'leftKnee'
  | 'rightHip'
  | 'rightKnee';

export function buildBloodStumpMesh(radius = 0.045): {
  mesh: THREE.Mesh;
  dispose: () => void;
} {
  const geo = new THREE.CylinderGeometry(radius * 0.92, radius * 0.65, radius * 0.44, 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x5c070b,
    roughness: 0.2,
    metalness: 0.05,
    emissive: new THREE.Color(0x200204),
    emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.frustumCulled = false;

  const boneGeo = new THREE.CylinderGeometry(radius * 0.22, radius * 0.28, radius * 0.48, 6);
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xe2dac4,
    roughness: 0.58,
    metalness: 0.02,
  });
  const boneNub = new THREE.Mesh(boneGeo, boneMat);
  boneNub.position.y = -radius * 0.18;
  boneNub.frustumCulled = false;
  mesh.add(boneNub);

  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      boneGeo.dispose();
      boneMat.dispose();
    },
  };
}

export function buildGoreChunkMesh(scale = 1.0): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const meatGeo = new THREE.DodecahedronGeometry(0.055 * scale, 0);
  const meatMat = new THREE.MeshStandardMaterial({
    color: 0x6a090e,
    roughness: 0.22,
    metalness: 0.06,
    emissive: new THREE.Color(0x220204),
    emissiveIntensity: 0.4,
  });
  const meat = new THREE.Mesh(meatGeo, meatMat);
  meat.scale.set(1.2, 0.8, 0.9);
  meat.castShadow = false;

  const boneGeo = new THREE.CylinderGeometry(0.014 * scale, 0.018 * scale, 0.075 * scale, 5);
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xe6dec8,
    roughness: 0.55,
  });
  const bone = new THREE.Mesh(boneGeo, boneMat);
  bone.position.set(0.03 * scale, 0.02 * scale, 0);
  bone.rotation.z = 0.8;
  group.add(meat, bone);

  return {
    group,
    dispose: () => {
      meatGeo.dispose();
      meatMat.dispose();
      boneGeo.dispose();
      boneMat.dispose();
    },
  };
}

export function buildSeveredLimbMesh(
  limb: LimbId,
  kind: EnemyKind,
  distalAlreadyGone = false,
): { group: THREE.Group; dispose: () => void } {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const skinMat = new THREE.MeshStandardMaterial({
    color: kind === 'spitter' ? 0x4d6b47 : kind === 'brute' ? 0x4b5349 : 0x5c6b58,
    roughness: 0.82,
    metalness: 0.04,
  });
  const clothMat = new THREE.MeshStandardMaterial({
    color: kind === 'brute' ? 0x252a34 : kind === 'spitter' ? 0x2e3b2f : 0x38322e,
    roughness: 0.9,
    metalness: 0.08,
  });
  const fleshMat = new THREE.MeshStandardMaterial({
    color: 0x7a0b10,
    roughness: 0.16,
    metalness: 0.08,
    emissive: new THREE.Color(0x2c0305),
    emissiveIntensity: 0.5,
  });
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xe5dec9,
    roughness: 0.55,
    metalness: 0.02,
  });
  mats.push(skinMat, clothMat, fleshMat, boneMat);

  const scaleMult = kind === 'brute' ? 1.38 : kind === 'spitter' ? 1.04 : 1.0;

  if (limb === 'head') {
    const headGeo = new THREE.SphereGeometry(0.19 * scaleMult, 10, 8);
    const head = new THREE.Mesh(headGeo, skinMat);
    const stumpGeo = new THREE.CylinderGeometry(0.095 * scaleMult, 0.11 * scaleMult, 0.09 * scaleMult, 8);
    const stump = new THREE.Mesh(stumpGeo, fleshMat);
    stump.position.y = -0.15 * scaleMult;
    const boneTipGeo = new THREE.CylinderGeometry(0.03 * scaleMult, 0.035 * scaleMult, 0.07 * scaleMult, 6);
    const boneTip = new THREE.Mesh(boneTipGeo, boneMat);
    boneTip.position.y = -0.19 * scaleMult;
    geos.push(headGeo, stumpGeo, boneTipGeo);
    group.add(head, stump, boneTip);
  } else if (limb === 'leftShoulder' || limb === 'rightShoulder') {
    const upperGeo = new THREE.CylinderGeometry(0.072 * scaleMult, 0.06 * scaleMult, 0.28 * scaleMult, 7);
    const upper = new THREE.Mesh(upperGeo, skinMat);
    const stumpTopGeo = new THREE.SphereGeometry(0.075 * scaleMult, 7, 6);
    const stumpTop = new THREE.Mesh(stumpTopGeo, fleshMat);
    stumpTop.position.y = 0.14 * scaleMult;
    const boneTopGeo = new THREE.CylinderGeometry(0.022 * scaleMult, 0.025 * scaleMult, 0.065 * scaleMult, 6);
    const boneTop = new THREE.Mesh(boneTopGeo, boneMat);
    boneTop.position.y = 0.18 * scaleMult;
    geos.push(upperGeo, stumpTopGeo, boneTopGeo);
    group.add(upper, stumpTop, boneTop);

    if (distalAlreadyGone) {
      const stumpBot = new THREE.Mesh(stumpTopGeo, fleshMat);
      stumpBot.scale.setScalar(0.84);
      stumpBot.position.y = -0.14 * scaleMult;
      group.add(stumpBot);
    } else {
      const foreGeo = new THREE.CylinderGeometry(0.056 * scaleMult, 0.044 * scaleMult, 0.26 * scaleMult, 7);
      const fore = new THREE.Mesh(foreGeo, skinMat);
      fore.position.set(0, -0.25 * scaleMult, 0.05 * scaleMult);
      fore.rotation.x = 0.28;
      const handGeo = new THREE.BoxGeometry(0.078 * scaleMult, 0.095 * scaleMult, 0.072 * scaleMult);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(0, -0.39 * scaleMult, 0.09 * scaleMult);
      geos.push(foreGeo, handGeo);
      group.add(fore, hand);
    }
  } else if (limb === 'leftElbow' || limb === 'rightElbow') {
    const foreGeo = new THREE.CylinderGeometry(0.058 * scaleMult, 0.044 * scaleMult, 0.28 * scaleMult, 7);
    const fore = new THREE.Mesh(foreGeo, skinMat);
    const handGeo = new THREE.BoxGeometry(0.078 * scaleMult, 0.095 * scaleMult, 0.072 * scaleMult);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.17 * scaleMult;
    const stumpGeo = new THREE.SphereGeometry(0.062 * scaleMult, 7, 6);
    const stump = new THREE.Mesh(stumpGeo, fleshMat);
    stump.position.y = 0.14 * scaleMult;
    const boneTipGeo = new THREE.CylinderGeometry(0.02 * scaleMult, 0.024 * scaleMult, 0.065 * scaleMult, 6);
    const boneTip = new THREE.Mesh(boneTipGeo, boneMat);
    boneTip.position.y = 0.18 * scaleMult;
    geos.push(foreGeo, handGeo, stumpGeo, boneTipGeo);
    group.add(fore, hand, stump, boneTip);
  } else if (limb === 'leftHip' || limb === 'rightHip') {
    const thighGeo = new THREE.CylinderGeometry(0.095 * scaleMult, 0.08 * scaleMult, 0.34 * scaleMult, 7);
    const thigh = new THREE.Mesh(thighGeo, clothMat);
    const stumpTopGeo = new THREE.SphereGeometry(0.096 * scaleMult, 7, 6);
    const stumpTop = new THREE.Mesh(stumpTopGeo, fleshMat);
    stumpTop.position.y = 0.17 * scaleMult;
    const boneTopGeo = new THREE.CylinderGeometry(0.028 * scaleMult, 0.032 * scaleMult, 0.07 * scaleMult, 6);
    const boneTop = new THREE.Mesh(boneTopGeo, boneMat);
    boneTop.position.y = 0.21 * scaleMult;
    geos.push(thighGeo, stumpTopGeo, boneTopGeo);
    group.add(thigh, stumpTop, boneTop);

    if (distalAlreadyGone) {
      const stumpBot = new THREE.Mesh(stumpTopGeo, fleshMat);
      stumpBot.scale.setScalar(0.84);
      stumpBot.position.y = -0.17 * scaleMult;
      group.add(stumpBot);
    } else {
      const shinGeo = new THREE.CylinderGeometry(0.078 * scaleMult, 0.064 * scaleMult, 0.34 * scaleMult, 7);
      const shin = new THREE.Mesh(shinGeo, clothMat);
      shin.position.set(0, -0.32 * scaleMult, -0.04 * scaleMult);
      shin.rotation.x = -0.18;
      const footGeo = new THREE.BoxGeometry(0.13 * scaleMult, 0.092 * scaleMult, 0.21 * scaleMult);
      const foot = new THREE.Mesh(footGeo, clothMat);
      foot.position.set(0, -0.49 * scaleMult, -0.02 * scaleMult);
      geos.push(shinGeo, footGeo);
      group.add(shin, foot);
    }
  } else {
    // leftKnee / rightKnee
    const shinGeo = new THREE.CylinderGeometry(0.08 * scaleMult, 0.064 * scaleMult, 0.34 * scaleMult, 7);
    const shin = new THREE.Mesh(shinGeo, clothMat);
    const footGeo = new THREE.BoxGeometry(0.13 * scaleMult, 0.092 * scaleMult, 0.21 * scaleMult);
    const foot = new THREE.Mesh(footGeo, clothMat);
    foot.position.set(0, -0.18 * scaleMult, 0.045 * scaleMult);
    const stumpGeo = new THREE.SphereGeometry(0.084 * scaleMult, 7, 6);
    const stump = new THREE.Mesh(stumpGeo, fleshMat);
    stump.position.y = 0.17 * scaleMult;
    const boneTipGeo = new THREE.CylinderGeometry(0.026 * scaleMult, 0.028 * scaleMult, 0.068 * scaleMult, 6);
    const boneTip = new THREE.Mesh(boneTipGeo, boneMat);
    boneTip.position.y = 0.21 * scaleMult;
    geos.push(shinGeo, footGeo, stumpGeo, boneTipGeo);
    group.add(shin, foot, stump, boneTip);
  }

  return {
    group,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

export interface HarvestNode {
  id: number;
  kind: 'timber' | 'sunstone';
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  respawnTimer: number;
  group: THREE.Group;
  hitFlash: number;
}

export interface WorldCollider {
  x: number;
  z: number;
  radius: number;
  height: number;
  source?: 'ruin' | 'tree' | 'lamp' | 'prop';
}

export interface WorldEnvironment {
  harvestNodes: HarvestNode[];
  baseColliders: WorldCollider[];
  colliders: WorldCollider[];
  terrain: THREE.Mesh;
  terrainMat: THREE.MeshStandardMaterial;
  plazaMat: THREE.MeshStandardMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  barrierMat: THREE.MeshStandardMaterial;
  rockMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  crateMat: THREE.MeshStandardMaterial;
  skyMat: THREE.MeshBasicMaterial;
  sunDisc: THREE.Mesh;
  sunHalo: THREE.Mesh;
  moonMesh: THREE.Mesh;
  moonHalo: THREE.Mesh;
  stars: THREE.Points;
  starMat: THREE.PointsMaterial;
  lampGlowMat: THREE.MeshStandardMaterial;
  lampPoints: THREE.PointLight[];
  nightGlowMats: { mat: THREE.MeshStandardMaterial; dayIntensity: number; nightIntensity: number }[];
  ruinObjects: THREE.Object3D[];
  forestObjects: THREE.Object3D[];
  citySurfaceObjects: THREE.Object3D[];
  editorGrid: THREE.GridHelper;
  rebuildTerrainHeights: (newScale: number, preset?: MapPresetId) => void;
  dispose: () => void;
}

export interface CustomPropTemplate {
  scene: THREE.Group;
  baseRadius: number;
  baseHeight: number;
  category: WorldPropCategory;
  dispose: () => void;
}

export async function parseGlbPropTemplate(
  buffer: ArrayBuffer,
  category: WorldPropCategory,
): Promise<CustomPropTemplate> {
  const loader = getSharedGltfLoader();
  const gltf = await new Promise<GLTF>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  const wrapper = new THREE.Group();
  const model = gltf.scene;
  wrapper.add(model);
  wrapper.updateMatrixWorld(true);

  const rawBox = new THREE.Box3().setFromObject(model);
  const rawSize = rawBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.05);

  const targetSize =
    category === 'building'
      ? 7.2
      : category === 'vehicle'
        ? 4.4
        : category === 'tank'
          ? 3.2
          : category === 'tree'
            ? 5.6
            : category === 'foliage'
              ? 1.8
              : 2.2;

  const scaleFactor = THREE.MathUtils.clamp(targetSize / maxDim, 0.01, 80);
  model.scale.multiplyScalar(scaleFactor);
  wrapper.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const scaledSize = scaledBox.getSize(new THREE.Vector3());

  // Pivot squarely at bottom-center (0, 0, 0) so the prop sits flush on terrain
  model.position.x -= scaledCenter.x;
  model.position.y -= scaledBox.min.y;
  model.position.z -= scaledCenter.z;

  optimizeGltfSceneResources(model, {
    maxTextureSize: 1024,
    freezeStaticChildren: true,
  });

  const shouldCastShadow = category !== 'foliage';
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = shouldCastShadow;
      mesh.receiveShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && 'envMapIntensity' in m) {
          (m as THREE.MeshStandardMaterial).envMapIntensity = 1.05;
        }
      });
    }
  });

  const baseRadius = Math.max(0.45, Math.min(scaledSize.x, scaledSize.z) * 0.45);
  const baseHeight = Math.max(0.6, scaledSize.y);

  return {
    scene: wrapper,
    baseRadius,
    baseHeight,
    category,
    dispose: () => {
      disposeObject3DResources(wrapper, true);
    },
  };
}

export function instantiatePropFromTemplate(template: CustomPropTemplate): THREE.Group {
  return template.scene.clone(true);
}

export function buildLootMeshGroup(kind: Exclude<LootKind, 'ember' | 'wood'>): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  if (kind === 'bandage') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: new THREE.Color(0x94a3b8),
      emissiveIntensity: 0.25,
      roughness: 0.65,
    });
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: new THREE.Color(0xdc2626),
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
    const rollGeo = new THREE.BoxGeometry(0.42, 0.2, 0.32);
    const barAGeo = new THREE.BoxGeometry(0.2, 0.22, 0.07);
    const barBGeo = new THREE.BoxGeometry(0.07, 0.22, 0.2);
    const roll = new THREE.Mesh(rollGeo, bodyMat);
    const barA = new THREE.Mesh(barAGeo, crossMat);
    const barB = new THREE.Mesh(barBGeo, crossMat);
    group.add(roll, barA, barB);
    geos.push(rollGeo, barAGeo, barBGeo);
    mats.push(bodyMat, crossMat);
  } else if (kind === 'food') {
    const tinMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: new THREE.Color(0xb45309),
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.55,
    });
    const labelMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.6,
    });
    const tinGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.28, 12);
    const bandGeo = new THREE.CylinderGeometry(0.186, 0.186, 0.15, 12);
    const tin = new THREE.Mesh(tinGeo, tinMat);
    const band = new THREE.Mesh(bandGeo, labelMat);
    group.add(tin, band);
    geos.push(tinGeo, bandGeo);
    mats.push(tinMat, labelMat);
  } else if (kind === 'fal_ammo') {
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x365314,
      emissive: new THREE.Color(0x4d7c0f),
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.45,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.9,
      roughness: 0.28,
      metalness: 0.85,
    });
    const caseGeo = new THREE.BoxGeometry(0.46, 0.24, 0.28);
    const stripGeo = new THREE.BoxGeometry(0.32, 0.08, 0.12);
    const box = new THREE.Mesh(caseGeo, boxMat);
    const strip = new THREE.Mesh(stripGeo, brassMat);
    strip.position.y = 0.14;
    group.add(box, strip);
    geos.push(caseGeo, stripGeo);
    mats.push(boxMat, brassMat);
  } else {
    // pistol_ammo
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      emissive: new THREE.Color(0x2563eb),
      emissiveIntensity: 0.45,
      roughness: 0.45,
      metalness: 0.4,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: new THREE.Color(0xeab308),
      emissiveIntensity: 0.85,
      roughness: 0.28,
      metalness: 0.85,
    });
    const caseGeo = new THREE.BoxGeometry(0.34, 0.18, 0.24);
    const trimGeo = new THREE.BoxGeometry(0.24, 0.06, 0.14);
    const box = new THREE.Mesh(caseGeo, boxMat);
    const trim = new THREE.Mesh(trimGeo, brassMat);
    trim.position.y = 0.11;
    group.add(box, trim);
    geos.push(caseGeo, trimGeo);
    mats.push(boxMat, brassMat);
  }

  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
    }
  });

  return {
    group,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

function buildGiantBaMonument(
  verticalGardenTex: THREE.CanvasTexture,
  stoneTex: THREE.CanvasTexture,
  disposables: { dispose: () => void }[],
): THREE.Group {
  const group = new THREE.Group();

  // Raised concrete/granite planter pedestal on south Plaza de la República lawn
  const plinthMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0xd0d4dc,
    roughness: 0.8,
    metalness: 0.08,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x263b21,
    roughness: 0.94,
    metalness: 0.02,
  });
  const steelFrameMat = new THREE.MeshStandardMaterial({
    color: 0x252b33,
    roughness: 0.42,
    metalness: 0.72,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    map: verticalGardenTex,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.02,
  });
  const bushMat = new THREE.MeshStandardMaterial({
    color: 0x357a2e,
    roughness: 0.88,
    metalness: 0.02,
  });
  disposables.push(plinthMat, soilMat, steelFrameMat, mossMat, bushMat);

  const plinthGeo = new THREE.BoxGeometry(6.8, 0.42, 2.05);
  plinthGeo.translate(0, 0.21, 0);
  const plinth = new THREE.Mesh(plinthGeo, plinthMat);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);
  disposables.push(plinthGeo);

  const bedGeo = new THREE.BoxGeometry(6.3, 0.14, 1.6);
  bedGeo.translate(0, 0.44, 0);
  const bed = new THREE.Mesh(bedGeo, soilMat);
  bed.receiveShadow = true;
  group.add(bed);
  disposables.push(bedGeo);

  // Ornamental shrubs along base of "BA" letters
  const shrubGeo = new THREE.DodecahedronGeometry(0.28, 1);
  disposables.push(shrubGeo);
  for (let i = 0; i < 14; i++) {
    const sx = -2.85 + (i / 13) * 5.7;
    const sz = i % 2 === 0 ? 0.56 : -0.56;
    const shrub = new THREE.Mesh(shrubGeo, bushMat);
    shrub.position.set(sx, 0.54, sz);
    shrub.scale.set(1.1 + (i % 3) * 0.18, 0.75 + (i % 2) * 0.2, 0.95);
    shrub.castShadow = true;
    shrub.receiveShadow = true;
    group.add(shrub);
  }

  // Sculpted "B" Shape (height 3.1m, width ~2.1m)
  const shapeB = new THREE.Shape();
  shapeB.moveTo(-1.05, 0);
  shapeB.lineTo(0.2, 0);
  shapeB.quadraticCurveTo(1.08, 0.05, 1.08, 0.78);
  shapeB.quadraticCurveTo(1.08, 1.38, 0.45, 1.54);
  shapeB.quadraticCurveTo(0.98, 1.72, 0.98, 2.34);
  shapeB.quadraticCurveTo(0.98, 3.05, 0.15, 3.1);
  shapeB.lineTo(-1.05, 3.1);
  shapeB.closePath();

  const bHoleTop = new THREE.Path();
  bHoleTop.moveTo(-0.42, 1.82);
  bHoleTop.lineTo(0.08, 1.82);
  bHoleTop.quadraticCurveTo(0.42, 1.86, 0.42, 2.24);
  bHoleTop.quadraticCurveTo(0.42, 2.58, 0.08, 2.62);
  bHoleTop.lineTo(-0.42, 2.62);
  bHoleTop.closePath();
  shapeB.holes.push(bHoleTop);

  const bHoleBot = new THREE.Path();
  bHoleBot.moveTo(-0.42, 0.48);
  bHoleBot.lineTo(0.14, 0.48);
  bHoleBot.quadraticCurveTo(0.5, 0.52, 0.5, 0.88);
  bHoleBot.quadraticCurveTo(0.5, 1.24, 0.14, 1.28);
  bHoleBot.lineTo(-0.42, 1.28);
  bHoleBot.closePath();
  shapeB.holes.push(bHoleBot);

  // Sculpted "A" Shape (height 3.1m, width ~2.35m)
  const shapeA = new THREE.Shape();
  shapeA.moveTo(-1.18, 0);
  shapeA.lineTo(-0.56, 0);
  shapeA.lineTo(-0.36, 0.72);
  shapeA.lineTo(0.36, 0.72);
  shapeA.lineTo(0.56, 0);
  shapeA.lineTo(1.18, 0);
  shapeA.lineTo(0.36, 3.1);
  shapeA.lineTo(-0.36, 3.1);
  shapeA.closePath();

  const aHole = new THREE.Path();
  aHole.moveTo(-0.22, 1.24);
  aHole.lineTo(0.22, 1.24);
  aHole.lineTo(0, 2.28);
  aHole.closePath();
  shapeA.holes.push(aHole);

  const buildLetterPair = (shape: THREE.Shape, offsetX: number) => {
    const outerGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.64,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 14,
    });
    outerGeo.translate(0, 0, -0.32);
    const outerMesh = new THREE.Mesh(outerGeo, steelFrameMat);
    outerMesh.position.set(offsetX, 0.48, 0);
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;

    // Vertical garden lush green front/back panels slightly proud of the steel border
    const innerGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.7,
      bevelEnabled: false,
      curveSegments: 14,
    });
    innerGeo.translate(0, 0, -0.35);
    const innerMesh = new THREE.Mesh(innerGeo, mossMat);
    innerMesh.scale.set(0.95, 0.96, 1);
    innerMesh.position.set(offsetX, 0.54, 0);
    innerMesh.castShadow = true;
    innerMesh.receiveShadow = true;

    disposables.push(outerGeo, innerGeo);
    group.add(outerMesh, innerMesh);
  };

  buildLetterPair(shapeB, -1.42);
  buildLetterPair(shapeA, 1.44);

  return group;
}

function buildObeliscoMonument(
  stoneTex: THREE.CanvasTexture,
  disposables: { dispose: () => void }[],
): { group: THREE.Group; plaqueGlowMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const whiteStoneMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0xf1eee6,
    roughness: 0.74,
    metalness: 0.05,
  });
  const plinthGraniteMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x9aa1aa,
    roughness: 0.84,
    metalness: 0.08,
  });
  const bronzePlaqueMat = new THREE.MeshStandardMaterial({
    color: 0x3b3328,
    roughness: 0.48,
    metalness: 0.78,
  });
  const darkWindowMat = new THREE.MeshStandardMaterial({
    color: 0x161b22,
    roughness: 0.35,
    metalness: 0.5,
  });
  const metalSpireMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.88,
  });
  const plaqueGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff7ed,
    emissive: new THREE.Color(0xfde68a),
    emissiveIntensity: 0.35,
    roughness: 0.3,
  });
  disposables.push(
    whiteStoneMat,
    plinthGraniteMat,
    bronzePlaqueMat,
    darkWindowMat,
    metalSpireMat,
    plaqueGlowMat,
  );

  // Stepped base plinth
  const step1Geo = new THREE.BoxGeometry(4.4, 0.55, 4.4);
  step1Geo.translate(0, 0.275, 0);
  const step2Geo = new THREE.BoxGeometry(3.6, 0.65, 3.6);
  step2Geo.translate(0, 0.875, 0);
  const step3Geo = new THREE.BoxGeometry(2.95, 1.25, 2.95);
  step3Geo.translate(0, 1.825, 0);
  const s1 = new THREE.Mesh(step1Geo, plinthGraniteMat);
  const s2 = new THREE.Mesh(step2Geo, plinthGraniteMat);
  const s3 = new THREE.Mesh(step3Geo, whiteStoneMat);
  [s1, s2, s3].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  disposables.push(step1Geo, step2Geo, step3Geo);

  // 4 commemorative dark bronze relief plaques + subtle upward floodlight strips on plinth sides
  const plaqueGeo = new THREE.BoxGeometry(1.55, 0.82, 0.08);
  const floodStripGeo = new THREE.BoxGeometry(1.4, 0.08, 0.14);
  disposables.push(plaqueGeo, floodStripGeo);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const p = new THREE.Mesh(plaqueGeo, bronzePlaqueMat);
    p.position.set(Math.sin(a) * 1.49, 1.82, Math.cos(a) * 1.49);
    p.rotation.y = a;
    group.add(p);

    const fl = new THREE.Mesh(floodStripGeo, plaqueGlowMat);
    fl.position.set(Math.sin(a) * 1.65, 1.22, Math.cos(a) * 1.65);
    fl.rotation.y = a;
    group.add(fl);
  }

  // Iconic tapered square stone shaft (CylinderGeometry with 4 radial segments rotated PI/4)
  // Radius * sqrt(2) = side width => base ~2.55m -> top ~1.48m, height 27.5m
  const shaftGeo = new THREE.CylinderGeometry(1.05, 1.82, 27.5, 4);
  shaftGeo.rotateY(Math.PI / 4);
  shaftGeo.translate(0, 2.45 + 13.75, 0);
  const shaft = new THREE.Mesh(shaftGeo, whiteStoneMat);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);
  disposables.push(shaftGeo);

  // Horizontal stone masonry seam rings along shaft
  const seamGeo = new THREE.BoxGeometry(2.55, 0.07, 2.55);
  disposables.push(seamGeo);
  for (let h = 6; h <= 27; h += 4.2) {
    const t = (h - 2.45) / 27.5;
    const wScale = THREE.MathUtils.lerp(1.01, 0.59, t);
    const seam = new THREE.Mesh(seamGeo, plinthGraniteMat);
    seam.position.y = h;
    seam.scale.set(wScale, 1, wScale);
    group.add(seam);
  }

  // Pyramidal apex
  const apexGeo = new THREE.CylinderGeometry(0.03, 1.05, 3.1, 4);
  apexGeo.rotateY(Math.PI / 4);
  apexGeo.translate(0, 29.95 + 1.55, 0);
  const apex = new THREE.Mesh(apexGeo, whiteStoneMat);
  apex.castShadow = true;
  group.add(apex);
  disposables.push(apexGeo);

  // 4 signature observation windows near the base of the pyramidal apex
  const winGeo = new THREE.BoxGeometry(0.32, 0.46, 0.14);
  disposables.push(winGeo);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const win = new THREE.Mesh(winGeo, darkWindowMat);
    win.position.set(Math.sin(a) * 0.62, 30.55, Math.cos(a) * 0.62);
    win.rotation.y = a;
    win.rotation.x = Math.sin(a) * 0.0 + (i === 0 ? -0.22 : i === 2 ? 0.22 : 0);
    group.add(win);
  }

  // Lightning rod spire at the very peak
  const spireGeo = new THREE.CylinderGeometry(0.02, 0.055, 2.6, 6);
  spireGeo.translate(0, 33.0 + 1.3, 0);
  const spire = new THREE.Mesh(spireGeo, metalSpireMat);
  group.add(spire);
  disposables.push(spireGeo);

  // Perimeter granite bollards around the monument
  const bollardGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.72, 8);
  bollardGeo.translate(0, 0.36, 0);
  disposables.push(bollardGeo);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bx = Math.cos(a) * 3.15;
    const bz = Math.sin(a) * 3.15;
    const bollard = new THREE.Mesh(bollardGeo, plinthGraniteMat);
    bollard.position.set(bx, 0, bz);
    bollard.castShadow = false;
    bollard.receiveShadow = true;
    group.add(bollard);
  }

  return { group, plaqueGlowMat };
}

function buildMetrobusStation(
  x: number,
  z: number,
  facingEast: boolean,
  stoneTex: THREE.CanvasTexture,
  metrobusSignTex: THREE.CanvasTexture,
  signGlowMat: THREE.MeshStandardMaterial,
  disposables: { dispose: () => void }[],
): { group: THREE.Group; colliders: WorldCollider[] } {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z);
  group.position.set(x, 0, z);
  const colliders: WorldCollider[] = [];

  const platformMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x6c737d,
    roughness: 0.85,
    metalness: 0.08,
  });
  const tactileYellowMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.62,
    metalness: 0.1,
  });
  const frameSteelMat = new THREE.MeshStandardMaterial({
    color: 0x262d37,
    roughness: 0.42,
    metalness: 0.75,
  });
  const glassCanopyMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a4c,
    roughness: 0.18,
    metalness: 0.45,
    transparent: true,
    opacity: 0.62,
  });
  const signPanelMat = new THREE.MeshStandardMaterial({
    map: metrobusSignTex,
    emissive: new THREE.Color(0xfef08a),
    emissiveMap: metrobusSignTex,
    emissiveIntensity: 0.35,
    roughness: 0.35,
  });
  const benchMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.38,
    metalness: 0.7,
  });
  disposables.push(
    platformMat,
    tactileYellowMat,
    frameSteelMat,
    glassCanopyMat,
    signPanelMat,
    benchMat,
  );

  // Raised concrete boarding platform (3.1m x 9.6m)
  const platGeo = new THREE.BoxGeometry(3.1, 0.24, 9.6);
  platGeo.translate(0, 0.12, 0);
  const plat = new THREE.Mesh(platGeo, platformMat);
  plat.receiveShadow = true;
  plat.castShadow = true;
  group.add(plat);
  disposables.push(platGeo);

  // Yellow tactile boarding edge stripe facing the bus lane
  const edgeOffsetX = facingEast ? 1.42 : -1.42;
  const edgeGeo = new THREE.BoxGeometry(0.24, 0.25, 9.5);
  edgeGeo.translate(edgeOffsetX, 0.125, 0);
  const edge = new THREE.Mesh(edgeGeo, tactileYellowMat);
  edge.receiveShadow = true;
  group.add(edge);
  disposables.push(edgeGeo);

  // 4 steel support columns + glass canopy roof
  const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.95, 8);
  postGeo.translate(0, 1.48, 0);
  disposables.push(postGeo);
  const postOffsetX = facingEast ? -0.95 : 0.95;
  [-3.2, -1.05, 1.05, 3.2].forEach((pz) => {
    const post = new THREE.Mesh(postGeo, frameSteelMat);
    post.position.set(postOffsetX, 0.2, pz);
    post.castShadow = true;
    group.add(post);
  });

  const roofGeo = new THREE.BoxGeometry(2.85, 0.12, 8.2);
  const roof = new THREE.Mesh(roofGeo, glassCanopyMat);
  roof.position.set(facingEast ? 0.15 : -0.15, 3.12, 0);
  roof.rotation.z = facingEast ? -0.08 : 0.08;
  roof.castShadow = true;
  group.add(roof);
  disposables.push(roofGeo);

  const roofTrimGeo = new THREE.BoxGeometry(2.94, 0.16, 0.22);
  const trimA = new THREE.Mesh(roofTrimGeo, frameSteelMat);
  trimA.position.set(facingEast ? 0.15 : -0.15, 3.12, -4.05);
  const trimB = trimA.clone();
  trimB.position.z = 4.05;
  group.add(trimA, trimB);
  disposables.push(roofTrimGeo);

  // Illuminated LED strip under canopy
  const stripGeo = new THREE.BoxGeometry(0.18, 0.06, 7.6);
  const strip = new THREE.Mesh(stripGeo, signGlowMat);
  strip.position.set(0, 3.02, 0);
  group.add(strip);
  disposables.push(stripGeo);

  // Tall Metrobus Totem Sign on north end of platform
  const totemGeo = new THREE.BoxGeometry(0.68, 3.35, 0.22);
  const totem = new THREE.Mesh(totemGeo, signPanelMat);
  totem.position.set(0, 1.85, -4.25);
  totem.castShadow = true;
  group.add(totem);
  disposables.push(totemGeo);

  // Stainless steel passenger bench
  const benchGeo = new THREE.BoxGeometry(0.55, 0.48, 2.4);
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.set(facingEast ? -0.45 : 0.45, 0.44, 0.8);
  bench.castShadow = true;
  bench.receiveShadow = true;
  group.add(bench);
  disposables.push(benchGeo);

  // Compact colliders for totem + canopy pillars + bench
  colliders.push(
    { x, z: z - 4.25, radius: 0.65, height: 3.4, source: 'ruin' },
    { x: x + (facingEast ? -0.45 : 0.45), z: z + 0.8, radius: 0.72, height: 1.0, source: 'ruin' },
    { x: x + postOffsetX, z: z - 2.6, radius: 0.42, height: 3.2, source: 'ruin' },
    { x: x + postOffsetX, z: z + 2.6, radius: 0.42, height: 3.2, source: 'ruin' },
  );

  void y;
  return { group, colliders };
}

function buildPortenoBus(
  x: number,
  z: number,
  facingSouth: boolean,
  busLiveryTex: THREE.CanvasTexture,
  disposables: { dispose: () => void }[],
): { group: THREE.Group; colliders: WorldCollider[] } {
  const group = new THREE.Group();
  const y = groundHeightAt(x, z);
  group.position.set(x, y, z);
  group.rotation.y = facingSouth ? 0 : Math.PI;

  const bodyMat = new THREE.MeshStandardMaterial({
    map: busLiveryTex,
    roughness: 0.42,
    metalness: 0.28,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.55,
    metalness: 0.2,
  });
  const darkGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f1b28,
    roughness: 0.16,
    metalness: 0.65,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x16191e,
    roughness: 0.9,
    metalness: 0.08,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.85,
  });
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 1.1,
    roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: new THREE.Color(0xdc2626),
    emissiveIntensity: 0.95,
    roughness: 0.3,
  });
  disposables.push(bodyMat, roofMat, darkGlassMat, tireMat, hubMat, ledMat, tailMat);

  // Main bus chassis + livery shell
  const hullGeo = new THREE.BoxGeometry(2.38, 2.35, 8.2);
  const hull = new THREE.Mesh(hullGeo, bodyMat);
  hull.position.y = 1.56;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  disposables.push(hullGeo);

  // Roof + AC units
  const capGeo = new THREE.BoxGeometry(2.34, 0.18, 8.1);
  const cap = new THREE.Mesh(capGeo, roofMat);
  cap.position.y = 2.82;
  group.add(cap);
  const acGeo = new THREE.BoxGeometry(1.5, 0.26, 2.1);
  const ac1 = new THREE.Mesh(acGeo, roofMat);
  ac1.position.set(0, 3.0, -1.1);
  const ac2 = ac1.clone();
  ac2.position.z = 1.8;
  group.add(ac1, ac2);
  disposables.push(capGeo, acGeo);

  // Front panoramic windshield + destination LED display
  const windshieldGeo = new THREE.BoxGeometry(2.14, 1.12, 0.08);
  const windshield = new THREE.Mesh(windshieldGeo, darkGlassMat);
  windshield.position.set(0, 1.9, 4.11);
  const destGeo = new THREE.BoxGeometry(1.55, 0.24, 0.09);
  const dest = new THREE.Mesh(destGeo, ledMat);
  dest.position.set(0, 2.58, 4.11);
  group.add(windshield, dest);
  disposables.push(windshieldGeo, destGeo);

  // Headlights & taillights
  const lampGeo = new THREE.BoxGeometry(0.32, 0.18, 0.08);
  [-0.82, 0.82].forEach((lx) => {
    const hl = new THREE.Mesh(lampGeo, ledMat);
    hl.position.set(lx, 0.74, 4.11);
    const tl = new THREE.Mesh(lampGeo, tailMat);
    tl.position.set(lx, 0.82, -4.11);
    group.add(hl, tl);
  });
  disposables.push(lampGeo);

  // 4 rubber wheels with metallic hubs
  const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.34, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.36, 10);
  hubGeo.rotateZ(Math.PI / 2);
  disposables.push(tireGeo, hubGeo);
  [
    [-1.12, 2.35],
    [1.12, 2.35],
    [-1.12, -2.35],
    [1.12, -2.35],
  ].forEach(([wx, wz]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, 0.46, wz);
    tire.castShadow = true;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(wx, 0.46, wz);
    group.add(tire, hub);
  });

  // 3 overlapping circular colliders covering bus length so bullets & actors collide cleanly
  const dirZ = facingSouth ? 1 : -1;
  const colliders: WorldCollider[] = [-2.5, 0, 2.5].map((oz) => ({
    x,
    z: z + oz * dirZ,
    radius: 1.38,
    height: 3.1,
    source: 'ruin',
  }));

  return { group, colliders };
}

export function buildWorldEnvironment(
  scene: THREE.Scene,
  groundTex: THREE.CanvasTexture,
  groundBumpTex: THREE.CanvasTexture,
  barkTex: THREE.CanvasTexture,
  stoneTex: THREE.CanvasTexture,
  skyTex: THREE.CanvasTexture,
): WorldEnvironment {
  const disposables: { dispose: () => void }[] = [];
  const sceneObjects: THREE.Object3D[] = [];
  const ruinObjects: THREE.Object3D[] = [];
  const forestObjects: THREE.Object3D[] = [];
  const citySurfaceObjects: THREE.Object3D[] = [];
  const nightGlowMats: {
    mat: THREE.MeshStandardMaterial;
    dayIntensity: number;
    nightIntensity: number;
  }[] = [];

  const baTex = createBuenosAiresTextures(8);
  disposables.push(baTex);

  // Atmospheric dynamic sky dome, sun, moon & starfield
  const skyGeo = new THREE.SphereGeometry(176, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    color: 0xffffff,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyDome);
  sceneObjects.push(skyDome);
  disposables.push(skyGeo, skyMat);

  const sunGeo = new THREE.CircleGeometry(6.8, 24);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false });
  const sunDisc = new THREE.Mesh(sunGeo, sunMat);
  sunDisc.position.set(66, 78, 52);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);
  sceneObjects.push(sunDisc);
  disposables.push(sunGeo, sunMat);

  const sunHaloGeo = new THREE.CircleGeometry(20, 24);
  const sunHaloMat = new THREE.MeshBasicMaterial({
    color: 0xfdba74,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
  sunHalo.position.set(65.5, 77.5, 51.6);
  sunHalo.lookAt(0, 0, 0);
  scene.add(sunHalo);
  sceneObjects.push(sunHalo);
  disposables.push(sunHaloGeo, sunHaloMat);

  const moonGeo = new THREE.CircleGeometry(5.6, 24);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.position.set(-66, 78, -52);
  moonMesh.lookAt(0, 0, 0);
  scene.add(moonMesh);
  sceneObjects.push(moonMesh);
  disposables.push(moonGeo, moonMat);

  const moonHaloGeo = new THREE.CircleGeometry(15, 24);
  const moonHaloMat = new THREE.MeshBasicMaterial({
    color: 0x60a5fa,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const moonHalo = new THREE.Mesh(moonHaloGeo, moonHaloMat);
  moonHalo.position.set(-65.5, 77.5, -51.6);
  moonHalo.lookAt(0, 0, 0);
  scene.add(moonHalo);
  sceneObjects.push(moonHalo);
  disposables.push(moonHaloGeo, moonHaloMat);

  const starCount = 340;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = (i * 2.399963) % (Math.PI * 2);
    const phi = 0.14 + Math.abs((Math.sin(i * 19.73) * 43758.5) % 1) * 1.12;
    const rad = 162;
    starPositions[i * 3] = Math.cos(theta) * Math.cos(phi) * rad;
    starPositions[i * 3 + 1] = Math.sin(phi) * rad;
    starPositions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * rad;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xcbd5e1,
    size: 0.78,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.65,
    fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  sceneObjects.push(stars);
  disposables.push(starGeo, starMat);

  // Terrain mesh: flat Avenida 9 de Julio asphalt, Metrobus lanes, Plaza de la República & sidewalks
  const segs = 112;
  const terrainGeo = new THREE.PlaneGeometry(WORLD_TERRAIN_SIZE, WORLD_TERRAIN_SIZE, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const cAsphalt = new THREE.Color(0x272c34);
  const cMetrobus = new THREE.Color(0x323741);
  const cPlazaStone = new THREE.Color(0x525864);
  const cSidewalk = new THREE.Color(0x474e59);
  const cGrass = new THREE.Color(0x294b28);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, groundHeightAt(vx, vz));

    const ax = Math.abs(vx);
    const az = Math.abs(vz);
    const onPlaza = ax < 9.0 && az < 11.4;
    const onPlazaLawn = ax < 7.2 && ((vz > -9.8 && vz < -5.8) || (vz > 4.2 && vz < 8.4));
    const onMetrobus = ax >= 10.2 && ax <= 15.2 && az >= 8.0;
    const onSidewalk = ax >= 27.0;

    if (onPlazaLawn) {
      tmpColor.copy(cGrass);
    } else if (onPlaza) {
      tmpColor.copy(cPlazaStone);
    } else if (onMetrobus) {
      tmpColor.copy(cMetrobus);
    } else if (onSidewalk) {
      tmpColor.copy(cSidewalk);
    } else {
      tmpColor.copy(cAsphalt);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const colorAttr = terrainGeo.attributes.color as THREE.BufferAttribute;
  const cSandboxInner = new THREE.Color(0xeef2f5);
  const cSandboxOuter = new THREE.Color(0xd2dae2);
  const applyTerrainAttributes = (preset: MapPresetId) => {
    setActiveMapPreset(preset);
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, groundHeightAt(vx, vz));

      if (preset === 'custom_sandbox') {
        const edgeFade = THREE.MathUtils.smoothstep(Math.hypot(vx, vz), 36, 86);
        tmpColor.copy(cSandboxInner).lerp(cSandboxOuter, edgeFade);
      } else {
        const ax = Math.abs(vx);
        const az = Math.abs(vz);
        const onPlaza = ax < 9.0 && az < 11.4;
        const onPlazaLawn = ax < 7.2 && ((vz > -9.8 && vz < -5.8) || (vz > 4.2 && vz < 8.4));
        const onMetrobus = ax >= 10.2 && ax <= 15.2 && az >= 8.0;
        const onSidewalk = ax >= 27.0;

        if (onPlazaLawn) {
          tmpColor.copy(cGrass);
        } else if (onPlaza) {
          tmpColor.copy(cPlazaStone);
        } else if (onMetrobus) {
          tmpColor.copy(cMetrobus);
        } else if (onSidewalk) {
          tmpColor.copy(cSidewalk);
        } else {
          tmpColor.copy(cAsphalt);
        }
      }
      colorAttr.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
    }
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    terrainGeo.computeVertexNormals();
  };
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    bumpMap: groundBumpTex,
    bumpScale: 0.05,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);
  sceneObjects.push(terrain);
  disposables.push(terrainGeo, terrainMat);

  // Subtle alignment grid shown while building in 3D Editor mode
  const editorGrid = new THREE.GridHelper(84, 42, 0x38bdf8, 0x475569);
  editorGrid.position.set(0, 0.035, 0);
  if (Array.isArray(editorGrid.material)) {
    editorGrid.material.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.28;
      disposables.push(m);
    });
  } else {
    editorGrid.material.transparent = true;
    editorGrid.material.opacity = 0.28;
    disposables.push(editorGrid.material);
  }
  editorGrid.visible = false;
  scene.add(editorGrid);
  sceneObjects.push(editorGrid);
  disposables.push(editorGrid.geometry);

  // Plaza de la República paved esplanade slab (textured granite pavers)
  const plazaGeo = new THREE.BoxGeometry(17.4, 0.14, 21.8);
  const plazaMat = new THREE.MeshStandardMaterial({
    map: baTex.plazaPaver,
    bumpMap: groundBumpTex,
    bumpScale: 0.025,
    color: 0x9aa3af,
    roughness: 0.82,
    metalness: 0.06,
  });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.position.set(0, 0.05, 0);
  plaza.receiveShadow = true;
  scene.add(plaza);
  sceneObjects.push(plaza);
  citySurfaceObjects.push(plaza);
  disposables.push(plazaGeo, plazaMat);

  // Green landscaped lawn beds on north & south ends of Plaza de la República
  const lawnGeo = new THREE.BoxGeometry(11.8, 0.05, 5.2);
  const lawnMat = new THREE.MeshStandardMaterial({
    map: baTex.verticalGarden,
    color: 0x8db880,
    roughness: 0.92,
    metalness: 0.02,
  });
  const northLawn = new THREE.Mesh(lawnGeo, lawnMat);
  northLawn.position.set(0, 0.125, -7.2);
  northLawn.receiveShadow = true;
  const southLawn = new THREE.Mesh(lawnGeo, lawnMat);
  southLawn.position.set(0, 0.125, 5.6);
  southLawn.receiveShadow = true;
  scene.add(northLawn, southLawn);
  sceneObjects.push(northLawn, southLawn);
  citySurfaceObjects.push(northLawn, southLawn);
  disposables.push(lawnGeo, lawnMat);

  // Instanced road lane markings: white dashes, yellow Metrobus lines & zebra crosswalks
  const dummy = new THREE.Object3D();
  const whitePaintGeo = new THREE.PlaneGeometry(0.24, 3.0);
  whitePaintGeo.rotateX(-Math.PI / 2);
  const whitePaintMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const whiteStripePositions: { x: number; z: number; rotY: number; sx: number; sz: number }[] = [];
  // Av. 9 de Julio North-South traffic lane dividers
  [-23.2, -19.2, 19.2, 23.2].forEach((lx) => {
    for (let z = -72; z <= 72; z += 7.5) {
      if (Math.abs(z) < 8.5) continue;
      whiteStripePositions.push({ x: lx, z, rotY: 0, sx: 1, sz: 1 });
    }
  });
  // Av. Corrientes East-West lane dividers
  [-2.6, 2.6].forEach((lz) => {
    for (let x = -68; x <= 68; x += 7.5) {
      if (Math.abs(x) < 16.8) continue;
      whiteStripePositions.push({ x, z: lz, rotY: Math.PI / 2, sx: 1, sz: 1 });
    }
  });
  // Sendas peatonales (zebra crosswalk bars across Corrientes & 9 de Julio)
  for (let x = -25.5; x <= 25.5; x += 1.45) {
    if (Math.abs(x) < 9.5) continue;
    whiteStripePositions.push({ x, z: -10.8, rotY: 0, sx: 2.3, sz: 0.75 });
    whiteStripePositions.push({ x, z: 10.8, rotY: 0, sx: 2.3, sz: 0.75 });
  }
  for (let z = -6.0; z <= 6.0; z += 1.45) {
    whiteStripePositions.push({ x: -16.8, z, rotY: Math.PI / 2, sx: 2.3, sz: 0.75 });
    whiteStripePositions.push({ x: 16.8, z, rotY: Math.PI / 2, sx: 2.3, sz: 0.75 });
  }
  const whiteStripeInst = new THREE.InstancedMesh(
    whitePaintGeo,
    whitePaintMat,
    whiteStripePositions.length,
  );
  whiteStripePositions.forEach((st, idx) => {
    dummy.position.set(st.x, groundHeightAt(st.x, st.z) + 0.025, st.z);
    dummy.rotation.set(0, st.rotY, 0);
    dummy.scale.set(st.sx, 1, st.sz);
    dummy.updateMatrix();
    whiteStripeInst.setMatrixAt(idx, dummy.matrix);
  });
  whiteStripeInst.computeBoundingSphere();
  scene.add(whiteStripeInst);
  sceneObjects.push(whiteStripeInst);
  citySurfaceObjects.push(whiteStripeInst);
  disposables.push(whitePaintGeo, whitePaintMat);

  // Yellow Metrobus corridor lane borders
  const yellowLineGeo = new THREE.PlaneGeometry(0.24, 62);
  yellowLineGeo.rotateX(-Math.PI / 2);
  const yellowLineMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const yellowInst = new THREE.InstancedMesh(yellowLineGeo, yellowLineMat, 16);
  let yIdx = 0;
  [-15.2, -10.2, 10.2, 15.2].forEach((lx) => {
    [-42, 42].forEach((lz) => {
      dummy.position.set(lx, 0.028, lz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      yellowInst.setMatrixAt(yIdx++, dummy.matrix);
    });
  });
  yellowInst.count = yIdx;
  yellowInst.computeBoundingSphere();
  scene.add(yellowInst);
  sceneObjects.push(yellowInst);
  citySurfaceObjects.push(yellowInst);
  disposables.push(yellowLineGeo, yellowLineMat);

  const baseColliders: WorldCollider[] = [];

  // 1. EL OBELISCO DE BUENOS AIRES (center of Plaza de la República)
  const obelisco = buildObeliscoMonument(stoneTex, disposables);
  obelisco.group.position.set(0, groundHeightAt(0, -2.2), -2.2);
  scene.add(obelisco.group);
  sceneObjects.push(obelisco.group);
  ruinObjects.push(obelisco.group);
  nightGlowMats.push({ mat: obelisco.plaqueGlowMat, dayIntensity: 0.12, nightIntensity: 1.45 });
  baseColliders.push({ x: 0, z: -2.2, radius: 2.35, height: 35, source: 'ruin' });

  // 2. LA GRAN "BA" VERDE (vertical garden sculpture on south lawn facing +Z)
  const baMonument = buildGiantBaMonument(baTex.verticalGarden, stoneTex, disposables);
  baMonument.position.set(0, groundHeightAt(0, 5.4), 5.4);
  scene.add(baMonument);
  sceneObjects.push(baMonument);
  ruinObjects.push(baMonument);
  baseColliders.push(
    { x: -1.6, z: 5.4, radius: 1.45, height: 3.8, source: 'ruin' },
    { x: 1.6, z: 5.4, radius: 1.45, height: 3.8, source: 'ruin' },
  );

  // 3. METROBUS 9 DE JULIO (4 Paradas + 2 Porteño Colectivos)
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: new THREE.Color(0xf59e0b),
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  disposables.push(lampGlowMat);

  const stationSpecs = [
    { x: -12.7, z: -18.5, facingEast: true },
    { x: -12.7, z: 18.5, facingEast: true },
    { x: 12.7, z: -18.5, facingEast: false },
    { x: 12.7, z: 18.5, facingEast: false },
  ];
  stationSpecs.forEach((st) => {
    const built = buildMetrobusStation(
      st.x,
      st.z,
      st.facingEast,
      stoneTex,
      baTex.metrobusSign,
      lampGlowMat,
      disposables,
    );
    scene.add(built.group);
    sceneObjects.push(built.group);
    ruinObjects.push(built.group);
    baseColliders.push(...built.colliders);
  });

  // 2 Buenos Aires Colectivos stopped in the Metrobus corridors
  const busA = buildPortenoBus(-12.7, 2.2, true, baTex.busLivery, disposables);
  const busB = buildPortenoBus(12.7, -3.4, false, baTex.busLivery, disposables);
  [busA, busB].forEach((b) => {
    scene.add(b.group);
    sceneObjects.push(b.group);
    ruinObjects.push(b.group);
    baseColliders.push(...b.colliders);
  });

  // Concrete Metrobus median dividers / safety barriers along x = ±10.0
  const barrierMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    bumpMap: groundBumpTex,
    bumpScale: 0.03,
    color: 0x7c838d,
    roughness: 0.84,
    metalness: 0.1,
  });
  const barrierGeo = new THREE.BoxGeometry(0.45, 0.56, 3.6);
  const barrierMeta: { x: number; z: number; rotY: number }[] = [];
  [-10.0, 10.0].forEach((bx) => {
    [-31, -25, 25, 31].forEach((bz) => {
      barrierMeta.push({ x: bx, z: bz, rotY: 0 });
    });
  });
  const barrierInst = new THREE.InstancedMesh(barrierGeo, barrierMat, barrierMeta.length);
  barrierInst.castShadow = true;
  barrierInst.receiveShadow = true;
  barrierMeta.forEach((bm, idx) => {
    dummy.position.set(bm.x, groundHeightAt(bm.x, bm.z) + 0.28, bm.z);
    dummy.rotation.set(0, bm.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    barrierInst.setMatrixAt(idx, dummy.matrix);
    baseColliders.push({ x: bm.x, z: bm.z, radius: 0.9, height: 0.65, source: 'ruin' });
  });
  barrierInst.computeBoundingSphere();
  scene.add(barrierInst);
  sceneObjects.push(barrierInst);
  ruinObjects.push(barrierInst);
  disposables.push(barrierGeo, barrierMat);

  // 4. EDIFICIOS ALEDAÑOS (Surrounding Carlos Pellegrini, Cerrito, Corrientes & 9 de Julio skyline)
  const pillarMat = new THREE.MeshStandardMaterial({
    map: baTex.classicFacade,
    emissive: new THREE.Color(0xffe4b5),
    emissiveMap: baTex.classicEmissive,
    emissiveIntensity: 0.65,
    roughness: 0.78,
    metalness: 0.08,
  });
  const glassTowerMat = new THREE.MeshStandardMaterial({
    map: baTex.modernGlass,
    emissive: new THREE.Color(0xbae6fd),
    emissiveMap: baTex.modernEmissive,
    emissiveIntensity: 0.75,
    roughness: 0.28,
    metalness: 0.68,
  });
  const mansardRoofMat = new THREE.MeshStandardMaterial({
    color: 0x262d38,
    roughness: 0.58,
    metalness: 0.35,
  });
  const copperDomeMat = new THREE.MeshStandardMaterial({
    color: 0x45806f,
    roughness: 0.45,
    metalness: 0.45,
  });
  const billboardMatA = new THREE.MeshStandardMaterial({
    map: baTex.billboardA,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: baTex.billboardA,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const billboardMatB = new THREE.MeshStandardMaterial({
    map: baTex.billboardB,
    emissive: new THREE.Color(0xffffff),
    emissiveMap: baTex.billboardB,
    emissiveIntensity: 0.85,
    roughness: 0.3,
  });
  const rockMat = new THREE.MeshStandardMaterial({
    map: stoneTex,
    color: 0x8f96a2,
    roughness: 0.86,
    metalness: 0.08,
  });
  disposables.push(
    pillarMat,
    glassTowerMat,
    mansardRoofMat,
    copperDomeMat,
    billboardMatA,
    billboardMatB,
    rockMat,
  );
  nightGlowMats.push(
    { mat: pillarMat, dayIntensity: 0.05, nightIntensity: 0.95 },
    { mat: glassTowerMat, dayIntensity: 0.08, nightIntensity: 1.05 },
    { mat: billboardMatA, dayIntensity: 0.35, nightIntensity: 1.3 },
    { mat: billboardMatB, dayIntensity: 0.35, nightIntensity: 1.3 },
  );

  const cityGroup = new THREE.Group();
  interface BuildingSpec {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    style: 'classic' | 'modern' | 'mid';
    hasDome?: boolean;
    billboard?: 'A' | 'B';
  }
  const buildings: BuildingSpec[] = [
    // West side (Cerrito) flanking Av. 9 de Julio — gap at z in [-7..7] for Av. Corrientes
    { x: -39, z: -17, w: 15, d: 14, h: 24, style: 'classic', hasDome: true },
    { x: -40, z: -34, w: 16, d: 15, h: 31, style: 'modern', billboard: 'A' },
    { x: -39, z: -52, w: 15, d: 16, h: 22, style: 'mid' },
    { x: -41, z: -72, w: 18, d: 18, h: 36, style: 'modern' },
    { x: -39, z: 17, w: 15, d: 14, h: 25, style: 'classic', hasDome: true, billboard: 'B' },
    { x: -40, z: 34, w: 16, d: 15, h: 29, style: 'mid' },
    { x: -40, z: 53, w: 17, d: 17, h: 35, style: 'modern' },
    { x: -41, z: 73, w: 18, d: 18, h: 26, style: 'classic' },

    // East side (Carlos Pellegrini) flanking Av. 9 de Julio
    { x: 39, z: -17, w: 15, d: 14, h: 26, style: 'classic', hasDome: true, billboard: 'B' },
    { x: 40, z: -34, w: 16, d: 15, h: 34, style: 'modern' },
    { x: 39, z: -52, w: 15, d: 16, h: 24, style: 'classic' },
    { x: 41, z: -72, w: 18, d: 18, h: 32, style: 'mid' },
    { x: 39, z: 17, w: 15, d: 14, h: 24, style: 'classic', hasDome: true },
    { x: 40, z: 34, w: 16, d: 15, h: 33, style: 'modern', billboard: 'A' },
    { x: 39, z: 53, w: 16, d: 17, h: 23, style: 'mid' },
    { x: 41, z: 73, w: 18, d: 18, h: 37, style: 'modern' },

    // Deeper Corrientes blocks further east/west
    { x: -58, z: -18, w: 16, d: 14, h: 28, style: 'mid' },
    { x: -58, z: 18, w: 16, d: 14, h: 31, style: 'modern' },
    { x: 58, z: -18, w: 16, d: 14, h: 30, style: 'modern' },
    { x: 58, z: 18, w: 16, d: 14, h: 27, style: 'classic' },

    // Distant horizon silhouette buildings along North & South Av. 9 de Julio corridor
    { x: -24, z: -84, w: 14, d: 14, h: 32, style: 'modern' },
    { x: 24, z: -84, w: 14, d: 14, h: 28, style: 'classic' },
    { x: -24, z: 84, w: 14, d: 14, h: 29, style: 'classic' },
    { x: 24, z: 84, w: 14, d: 14, h: 34, style: 'modern' },
  ];

  buildings.forEach((b, idx) => {
    const bGroup = new THREE.Group();
    const gy = groundHeightAt(b.x, b.z);
    bGroup.position.set(b.x, gy, b.z);

    // Ground-floor Porteño colonnade / commercial podium
    const baseGeo = new THREE.BoxGeometry(b.w + 0.5, 4.2, b.d + 0.5);
    baseGeo.translate(0, 2.1, 0);
    const baseMesh = new THREE.Mesh(baseGeo, rockMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    bGroup.add(baseMesh);
    disposables.push(baseGeo);

    // Main tower facade
    const bodyH = b.h - 4.2;
    const bodyGeo = new THREE.BoxGeometry(b.w, bodyH, b.d);
    bodyGeo.translate(0, 4.2 + bodyH * 0.5, 0);
    const bodyMat = b.style === 'modern' ? glassTowerMat : pillarMat;
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bGroup.add(bodyMesh);
    disposables.push(bodyGeo);

    // Top cornice ledge
    const corniceGeo = new THREE.BoxGeometry(b.w + 0.65, 0.6, b.d + 0.65);
    const cornice = new THREE.Mesh(corniceGeo, rockMat);
    cornice.position.y = b.h + 0.3;
    bGroup.add(cornice);
    disposables.push(corniceGeo);

    if (b.style === 'classic') {
      // Dark French mansard roof + optional corner copper dome cupola
      const mansardGeo = new THREE.CylinderGeometry(
        Math.min(b.w, b.d) * 0.52,
        Math.min(b.w, b.d) * 0.68,
        3.2,
        4,
      );
      mansardGeo.rotateY(Math.PI / 4);
      const mansard = new THREE.Mesh(mansardGeo, mansardRoofMat);
      mansard.position.y = b.h + 2.1;
      mansard.scale.set(b.w / Math.min(b.w, b.d), 1, b.d / Math.min(b.w, b.d));
      bGroup.add(mansard);
      disposables.push(mansardGeo);

      if (b.hasDome) {
        const domeX = b.x < 0 ? b.w * 0.34 : -b.w * 0.34;
        const domeZ = b.z < 0 ? b.d * 0.34 : -b.d * 0.34;
        const drumGeo = new THREE.CylinderGeometry(1.75, 1.9, 2.2, 12);
        const drum = new THREE.Mesh(drumGeo, rockMat);
        drum.position.set(domeX, b.h + 1.5, domeZ);
        const cupolaGeo = new THREE.SphereGeometry(1.85, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
        const cupola = new THREE.Mesh(cupolaGeo, copperDomeMat);
        cupola.position.set(domeX, b.h + 2.5, domeZ);
        const spireGeo = new THREE.CylinderGeometry(0.04, 0.09, 2.0, 6);
        const spire = new THREE.Mesh(spireGeo, copperDomeMat);
        spire.position.set(domeX, b.h + 5.1, domeZ);
        bGroup.add(drum, cupola, spire);
        disposables.push(drumGeo, cupolaGeo, spireGeo);
      }
    } else {
      // Penthouse / mechanical crown
      const pentGeo = new THREE.BoxGeometry(b.w * 0.58, 2.4, b.d * 0.58);
      const pent = new THREE.Mesh(pentGeo, mansardRoofMat);
      pent.position.y = b.h + 1.5;
      bGroup.add(pent);
      disposables.push(pentGeo);
    }

    if (b.billboard) {
      const bbGeo = new THREE.BoxGeometry(0.35, 3.8, 10.2);
      const bbMat = b.billboard === 'A' ? billboardMatA : billboardMatB;
      const bb = new THREE.Mesh(bbGeo, bbMat);
      const faceInX = b.x < 0 ? b.w * 0.44 : -b.w * 0.44;
      bb.position.set(faceInX, b.h + 2.5, 0);
      bGroup.add(bb);
      disposables.push(bbGeo);
    }

    cityGroup.add(bGroup);

    // Add perimeter building colliders for closer avenue blocks
    if (Math.abs(b.x) < 46 && Math.abs(b.z) < 60) {
      baseColliders.push({
        x: b.x,
        z: b.z,
        radius: Math.max(b.w, b.d) * 0.5,
        height: b.h,
        source: 'ruin',
      });
    }
    void idx;
  });
  scene.add(cityGroup);
  sceneObjects.push(cityGroup);
  ruinObjects.push(cityGroup);

  // 5. CLASSIC BUENOS AIRES STREETLAMPS along Av. 9 de Julio & Plaza de la República
  const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.13, 5.2, 8);
  lampPoleGeo.translate(0, 2.6, 0);
  const lampArmGeo = new THREE.BoxGeometry(0.1, 0.1, 1.15);
  const lampHeadGeo = new THREE.BoxGeometry(0.34, 0.15, 0.52);
  const lampBulbGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const lampMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e242d,
    roughness: 0.5,
    metalness: 0.78,
  });
  disposables.push(lampPoleGeo, lampArmGeo, lampHeadGeo, lampBulbGeo, lampMetalMat);

  const lampCoords = [
    { x: -8.6, z: -9.6, yaw: Math.PI * 0.25, lit: true },
    { x: 8.6, z: -9.6, yaw: -Math.PI * 0.25, lit: true },
    { x: -8.6, z: 9.6, yaw: Math.PI * 0.75, lit: true },
    { x: 8.6, z: 9.6, yaw: -Math.PI * 0.75, lit: true },
    { x: -27.2, z: -13.0, yaw: Math.PI / 2, lit: false },
    { x: 27.2, z: -13.0, yaw: -Math.PI / 2, lit: false },
    { x: -27.2, z: 13.0, yaw: Math.PI / 2, lit: false },
    { x: 27.2, z: 13.0, yaw: -Math.PI / 2, lit: false },
  ];
  const lampGroups: { group: THREE.Group; x: number; z: number }[] = [];
  const lampPoints: THREE.PointLight[] = [];
  lampCoords.forEach((lc) => {
    const ly = groundHeightAt(lc.x, lc.z);
    const lampGroup = new THREE.Group();
    lampGroup.position.set(lc.x, ly, lc.z);
    lampGroup.rotation.y = lc.yaw;

    const pole = new THREE.Mesh(lampPoleGeo, lampMetalMat);
    pole.castShadow = true;
    pole.receiveShadow = true;
    const arm = new THREE.Mesh(lampArmGeo, lampMetalMat);
    arm.position.set(0, 5.1, 0.48);
    const head = new THREE.Mesh(lampHeadGeo, lampMetalMat);
    head.position.set(0, 5.04, 0.96);
    const bulb = new THREE.Mesh(lampBulbGeo, lampGlowMat);
    bulb.position.set(0, 4.94, 0.98);
    lampGroup.add(pole, arm, head, bulb);

    if (lc.lit) {
      const point = new THREE.PointLight(0xffb85c, 2.3, 18, 1.4);
      point.position.set(0, 4.75, 1.0);
      lampGroup.add(point);
      lampPoints.push(point);
    }

    scene.add(lampGroup);
    sceneObjects.push(lampGroup);
    citySurfaceObjects.push(lampGroup);
    lampGroups.push({ group: lampGroup, x: lc.x, z: lc.z });
    baseColliders.push({ x: lc.x, z: lc.z, radius: 0.36, height: 5.2, source: 'lamp' });
  });

  // 6. HARVEST / SUPPLY NODES (urban supply crates & fuel drums along plaza & avenue)
  const harvestNodes: HarvestNode[] = [];
  const crateGeo = new THREE.BoxGeometry(1.1, 1.05, 1.1);
  crateGeo.translate(0, 0.525, 0);
  const drumGeo = new THREE.CylinderGeometry(0.46, 0.46, 1.15, 12);
  drumGeo.translate(0, 0.575, 0);

  const crateMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: 0x9a7b4f,
    roughness: 0.82,
    metalness: 0.08,
  });
  const drumMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: new THREE.Color(0xd97706),
    emissiveIntensity: 0.7,
    roughness: 0.32,
    metalness: 0.55,
  });
  disposables.push(crateGeo, drumGeo, crateMat, drumMat);

  const nodeSpots = [
    { x: -6.8, z: -8.6 },
    { x: 6.8, z: -8.6 },
    { x: -16.8, z: -13.5 },
    { x: 16.8, z: -13.5 },
    { x: -17.5, z: 14.5 },
    { x: 17.5, z: 14.5 },
    { x: -26.2, z: -5.5 },
    { x: 26.2, z: 5.5 },
    { x: -26.2, z: 22.0 },
    { x: 26.2, z: -22.0 },
    { x: -6.8, z: 27.5 },
    { x: 6.8, z: -27.5 },
  ];

  nodeSpots.forEach((spot, i) => {
    const y = groundHeightAt(spot.x, spot.z);
    const kind: 'timber' | 'sunstone' = i % 3 === 0 ? 'sunstone' : 'timber';
    const nodeGroup = new THREE.Group();
    nodeGroup.position.set(spot.x, y, spot.z);
    nodeGroup.rotation.y = i * 0.72;

    if (kind === 'timber') {
      const box = new THREE.Mesh(crateGeo, crateMat);
      box.castShadow = true;
      box.receiveShadow = true;
      nodeGroup.add(box);
    } else {
      const drum = new THREE.Mesh(drumGeo, drumMat);
      drum.castShadow = true;
      nodeGroup.add(drum);
    }

    scene.add(nodeGroup);
    harvestNodes.push({
      id: i,
      kind,
      x: spot.x,
      z: spot.z,
      hp: kind === 'timber' ? 35 : 45,
      maxHp: kind === 'timber' ? 35 : 45,
      respawnTimer: 0,
      group: nodeGroup,
      hitFlash: 0,
    });
  });

  // 7. PORTEÑO URBAN TREES: Jacarandás (violet-blooming) & Boulevard Plátanos/Tipas
  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.3, 3.8, 7);
  trunkGeo.translate(0, 1.9, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    color: 0x5c4635,
    roughness: 0.92,
    metalness: 0.04,
  });
  const canopyMainGeo = new THREE.DodecahedronGeometry(1.75, 1);
  canopyMainGeo.translate(0, 4.45, 0);
  const canopySideGeo = new THREE.DodecahedronGeometry(1.25, 1);
  canopySideGeo.translate(0.9, 3.85, 0.65);
  const canopyTopGeo = new THREE.DodecahedronGeometry(1.3, 1);
  canopyTopGeo.translate(-0.7, 5.05, -0.5);
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.03,
  });
  const planterGeo = new THREE.BoxGeometry(1.45, 0.28, 1.45);
  planterGeo.translate(0, 0.14, 0);

  const treeCoords: { x: number; z: number; jacaranda: boolean; scale: number; solid: boolean }[] = [
    // Plaza de la República corner trees
    { x: -6.8, z: -4.2, jacaranda: true, scale: 0.95, solid: true },
    { x: 6.8, z: -4.2, jacaranda: true, scale: 0.95, solid: true },
    { x: -6.8, z: 3.6, jacaranda: true, scale: 0.92, solid: true },
    { x: 6.8, z: 3.6, jacaranda: true, scale: 0.92, solid: true },
    // Metrobus & central median boulevard trees (north & south of plaza)
    { x: -9.8, z: -15.0, jacaranda: true, scale: 1.05, solid: true },
    { x: 9.8, z: -15.0, jacaranda: false, scale: 1.05, solid: true },
    { x: -9.8, z: -26.5, jacaranda: false, scale: 1.1, solid: true },
    { x: 9.8, z: -26.5, jacaranda: true, scale: 1.08, solid: true },
    { x: -9.8, z: 15.0, jacaranda: false, scale: 1.04, solid: true },
    { x: 9.8, z: 15.0, jacaranda: true, scale: 1.04, solid: true },
    { x: -9.8, z: 26.5, jacaranda: true, scale: 1.1, solid: true },
    { x: 9.8, z: 26.5, jacaranda: false, scale: 1.08, solid: true },
    { x: 0, z: -17.5, jacaranda: true, scale: 1.0, solid: true },
    { x: 0, z: -28.0, jacaranda: false, scale: 1.08, solid: true },
    { x: 0, z: 20.5, jacaranda: true, scale: 1.02, solid: true },
    { x: 0, z: 31.0, jacaranda: false, scale: 1.08, solid: true },
    // Cerrito & Carlos Pellegrini sidewalk trees
    { x: -28.2, z: -10.5, jacaranda: true, scale: 1.12, solid: true },
    { x: -28.2, z: -21.0, jacaranda: false, scale: 1.14, solid: true },
    { x: -28.2, z: -32.0, jacaranda: true, scale: 1.1, solid: true },
    { x: -28.2, z: 10.5, jacaranda: false, scale: 1.12, solid: true },
    { x: -28.2, z: 21.0, jacaranda: true, scale: 1.15, solid: true },
    { x: -28.2, z: 32.0, jacaranda: false, scale: 1.1, solid: true },
    { x: 28.2, z: -10.5, jacaranda: false, scale: 1.12, solid: true },
    { x: 28.2, z: -21.0, jacaranda: true, scale: 1.14, solid: true },
    { x: 28.2, z: -32.0, jacaranda: false, scale: 1.1, solid: true },
    { x: 28.2, z: 10.5, jacaranda: true, scale: 1.12, solid: true },
    { x: 28.2, z: 21.0, jacaranda: false, scale: 1.15, solid: true },
    { x: 28.2, z: 32.0, jacaranda: true, scale: 1.1, solid: true },
    // Outer avenue depth trees
    { x: -28.2, z: -46.0, jacaranda: true, scale: 1.15, solid: false },
    { x: 28.2, z: -46.0, jacaranda: false, scale: 1.15, solid: false },
    { x: -28.2, z: 46.0, jacaranda: false, scale: 1.15, solid: false },
    { x: 28.2, z: 46.0, jacaranda: true, scale: 1.15, solid: false },
  ];

  const treeCount = treeCoords.length;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyMainInst = new THREE.InstancedMesh(canopyMainGeo, foliageMat, treeCount);
  const canopySideInst = new THREE.InstancedMesh(canopySideGeo, foliageMat, treeCount);
  const canopyTopInst = new THREE.InstancedMesh(canopyTopGeo, foliageMat, treeCount);
  const planterInst = new THREE.InstancedMesh(planterGeo, barrierMat, treeCount);
  [trunkInst, canopyMainInst, canopySideInst, canopyTopInst, planterInst].forEach((inst) => {
    inst.castShadow = true;
    inst.receiveShadow = true;
  });

  const tintColor = new THREE.Color();
  treeCoords.forEach((tc, idx) => {
    const y = groundHeightAt(tc.x, tc.z);
    const rotY = idx * 1.13;
    dummy.position.set(tc.x, y, tc.z);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.setScalar(tc.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    canopyMainInst.setMatrixAt(idx, dummy.matrix);
    canopySideInst.setMatrixAt(idx, dummy.matrix);
    canopyTopInst.setMatrixAt(idx, dummy.matrix);

    dummy.scale.setScalar(1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    planterInst.setMatrixAt(idx, dummy.matrix);

    if (tc.jacaranda) {
      // Signature Buenos Aires Jacarandá violet-lavender blossom crowns
      tintColor.setHex(0x7c54b8).offsetHSL(((idx % 3) - 1) * 0.02, 0.04, 0);
      canopyMainInst.setColorAt(idx, tintColor);
      tintColor.setHex(0x9168cc);
      canopySideInst.setColorAt(idx, tintColor);
      tintColor.setHex(0xa27ce0);
      canopyTopInst.setColorAt(idx, tintColor);
    } else {
      // Lush urban Tipa / Plátano green crowns
      tintColor.setHex(0x2d5e31).offsetHSL(((idx % 4) - 1.5) * 0.015, 0.03, 0);
      canopyMainInst.setColorAt(idx, tintColor);
      tintColor.offsetHSL(0, 0, 0.04);
      canopySideInst.setColorAt(idx, tintColor);
      tintColor.offsetHSL(0, 0, 0.05);
      canopyTopInst.setColorAt(idx, tintColor);
    }

    if (tc.solid) {
      baseColliders.push({
        x: tc.x,
        z: tc.z,
        radius: 0.75 * tc.scale,
        height: 4.5,
        source: 'tree',
      });
    }
  });
  [trunkInst, canopyMainInst, canopySideInst, canopyTopInst, planterInst].forEach((inst) => {
    inst.computeBoundingSphere();
    scene.add(inst);
    sceneObjects.push(inst);
    forestObjects.push(inst);
  });
  disposables.push(
    trunkGeo,
    trunkMat,
    canopyMainGeo,
    canopySideGeo,
    canopyTopGeo,
    foliageMat,
    planterGeo,
  );

  const rebuildTerrainHeights = (newScale: number, preset: MapPresetId = activeMapPreset) => {
    setTerrainReliefScale(newScale);
    applyTerrainAttributes(preset);

    whiteStripePositions.forEach((st, idx) => {
      dummy.position.set(st.x, groundHeightAt(st.x, st.z) + 0.025, st.z);
      dummy.rotation.set(0, st.rotY, 0);
      dummy.scale.set(st.sx, 1, st.sz);
      dummy.updateMatrix();
      whiteStripeInst.setMatrixAt(idx, dummy.matrix);
    });
    whiteStripeInst.instanceMatrix.needsUpdate = true;

    barrierMeta.forEach((bm, idx) => {
      dummy.position.set(bm.x, groundHeightAt(bm.x, bm.z) + 0.28, bm.z);
      dummy.rotation.set(0, bm.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barrierInst.setMatrixAt(idx, dummy.matrix);
    });
    barrierInst.instanceMatrix.needsUpdate = true;

    lampGroups.forEach((lg) => {
      lg.group.position.y = groundHeightAt(lg.x, lg.z);
    });
    harvestNodes.forEach((hn) => {
      hn.group.position.y = groundHeightAt(hn.x, hn.z);
    });

    treeCoords.forEach((tc, idx) => {
      const y = groundHeightAt(tc.x, tc.z);
      dummy.position.set(tc.x, y, tc.z);
      dummy.rotation.set(0, idx * 1.13, 0);
      dummy.scale.setScalar(tc.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);
      canopyMainInst.setMatrixAt(idx, dummy.matrix);
      canopySideInst.setMatrixAt(idx, dummy.matrix);
      canopyTopInst.setMatrixAt(idx, dummy.matrix);

      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      planterInst.setMatrixAt(idx, dummy.matrix);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyMainInst.instanceMatrix.needsUpdate = true;
    canopySideInst.instanceMatrix.needsUpdate = true;
    canopyTopInst.instanceMatrix.needsUpdate = true;
    planterInst.instanceMatrix.needsUpdate = true;
  };

  return {
    harvestNodes,
    baseColliders,
    colliders: [...baseColliders],
    terrain,
    terrainMat,
    plazaMat,
    pillarMat,
    barrierMat,
    rockMat,
    trunkMat,
    crateMat,
    skyMat,
    sunDisc,
    sunHalo,
    moonMesh,
    moonHalo,
    stars,
    starMat,
    lampGlowMat,
    lampPoints,
    nightGlowMats,
    ruinObjects,
    forestObjects,
    citySurfaceObjects,
    editorGrid,
    rebuildTerrainHeights,
    dispose: () => {
      sceneObjects.forEach((obj) => scene.remove(obj));
      harvestNodes.forEach((n) => scene.remove(n.group));
      disposables.forEach((d) => d.dispose());
    },
  };
}
