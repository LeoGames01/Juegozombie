import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GameAudio } from './audio';
import {
  actualizarZombieSlotCountCache,
  actualizarZombieSlotTargetCache,
  cargarCameraSettingsLocal,
  cargarMapSettingsLocal,
  cargarModeloCache,
  cargarModeloMeta,
  cargarPlacedPropsCache,
  cargarPostProcessLocal,
  cargarPropSlotBuffer,
  cargarPropSlotBuffers,
  cargarRifleCache,
  cargarRifleMeta,
  cargarTextureCache,
  cargarZombieCache,
  cargarZombieMeta,
  cargarZombieSlotBuffer,
  cargarZombieSlotBuffers,
  eliminarModeloCache,
  eliminarPropSlotCache,
  eliminarRifleCache,
  eliminarTextureCache,
  eliminarZombieCache,
  eliminarZombieSlotCache,
  guardarCameraSettingsLocal,
  guardarMapSettingsLocal,
  guardarModeloCache,
  guardarPlacedPropsCache,
  guardarPostProcessLocal,
  guardarPropSlotCache,
  guardarRifleCache,
  guardarTextureCache,
  guardarZombieSlotCache,
  guardarZombieSlotsBatchCache,
  limpiarTodosZombiesCache,
  listarPropSlotsCache,
  listarZombieSlotsCache,
} from './modelCache';
import {
  applyRifleToRig,
  ARENA_PLAYABLE_RADIUS,
  type BoneRest,
  buildBloodStumpMesh,
  buildCampfireGroup,
  buildDefaultSurvivor,
  buildEnemyMesh,
  buildGoreChunkMesh,
  buildLootMeshGroup,
  buildSeveredLimbMesh,
  buildWorldEnvironment,
  CAMPFIRE_SAFE_RADIUS,
  type CampfireVisuals,
  type CharacterRig,
  type CustomPropTemplate,
  type CustomRifleTemplate,
  type CustomZombieTemplate,
  type EnemyMeshBundle,
  getCampfireCoords,
  getPlayerSpawnCoords,
  groundHeightAt,
  instantiatePropFromTemplate,
  type LimbId,
  parseGlbCharacter,
  parseGlbPropTemplate,
  parseGlbRifleTemplate,
  parseGlbZombieTemplate,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Z,
  setActiveMapPreset,
  type WorldCollider,
  type WorldEnvironment,
} from './models';
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_SETTINGS,
  POST_PROCESS_PRESETS,
  PROP_CATEGORIES,
} from './settingsDefaults';
import {
  createBarkTexture,
  createContactShadowTexture,
  createGroundBumpTexture,
  createGroundTexture,
  createSimpleTerrainTexture,
  createSkyGradientTexture,
  createStoneTexture,
  getAwarenessIconTextures,
  getBloodPuddleTextures,
} from './textures';
import {
  type CameraPresetId,
  type CameraSettings,
  type DifficultyId,
  type EnemyKind,
  type GameState,
  type HudSnapshot,
  type LootKind,
  type MapMaterialSettings,
  type MovementStance,
  type PlacedWorldProp,
  type PostProcessPreset,
  type PostProcessSettings,
  type TextureTargetId,
  type WeaponKind,
  type WorldPropCategory,
  type WorldPropSlot,
  type ZombieModelSlot,
  type ZombieTargetKind,
} from './types';

const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _cNightSky = new THREE.Color(0x0b1220);
const _cDuskSky = new THREE.Color(0x4a2c2f);
const _cDaySky = new THREE.Color(0x7ca2c7);
const _cSkyCol = new THREE.Color();
const _cSkyMatDark = new THREE.Color(0x3a4861);
const _cSkyMatWhite = new THREE.Color(0xffffff);
const _cSkyMatTint = new THREE.Color();
const _cLightNight = new THREE.Color(0x9fbce8);
const _cLightDay = new THREE.Color(0xfff4d6);
const _cLightDusk = new THREE.Color(0xff9c5b);
const _cLightCol = new THREE.Color();
const _cHemiDay = new THREE.Color(0xdbeafe);
const _cHemiGround = new THREE.Color(0x3c434f);
const _cFogNight = new THREE.Color(0x101926);
const _cFogDay = new THREE.Color(0x88a4c0);
const _cFogDusk = new THREE.Color(0x4a3130);
const _cFogCol = new THREE.Color();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _rayHit = new THREE.Vector3();

// Reusable IK & weapon-alignment scratch vectors/quaternions (zero per-frame allocations)
const _ikS = new THREE.Vector3();
const _ikE = new THREE.Vector3();
const _ikH = new THREE.Vector3();
const _ikT = new THREE.Vector3();
const _ikDir = new THREE.Vector3();
const _ikPole = new THREE.Vector3();
const _ikPoleR = new THREE.Vector3();
const _ikBend = new THREE.Vector3();
const _ikCurDir = new THREE.Vector3();
const _ikTargetDir = new THREE.Vector3();
const _ikTargetElbow = new THREE.Vector3();
const _ikParentQ = new THREE.Quaternion();
const _ikWorldQ = new THREE.Quaternion();
const _ikDeltaQ = new THREE.Quaternion();
const _ikLocalQ = new THREE.Quaternion();
const _chestCenter = new THREE.Vector3();
const _rightShoulderPos = new THREE.Vector3();
const _leftShoulderPos = new THREE.Vector3();
const _rightGripTarget = new THREE.Vector3();
const _weaponFwd = new THREE.Vector3();
const _weaponRight = new THREE.Vector3();
const _weaponAimDir = new THREE.Vector3();
const _basisX = new THREE.Vector3();
const _basisY = new THREE.Vector3();
const _basisZ = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _alignMat = new THREE.Matrix4();
const _savedRArmQ = new THREE.Quaternion();
const _savedRForeQ = new THREE.Quaternion();
const _savedRHandQ = new THREE.Quaternion();
const _savedLArmQ = new THREE.Quaternion();
const _savedLForeQ = new THREE.Quaternion();
const _savedLHandQ = new THREE.Quaternion();

function dampBoneRot(
  bone: BoneRest | null,
  ox: number,
  oy: number,
  oz: number,
  lambda: number,
  dt: number,
) {
  if (!bone) return;
  _euler.set(
    bone.restRot.x + ox,
    bone.restRot.y + oy,
    bone.restRot.z + oz,
    bone.restRot.order,
  );
  _quat.setFromEuler(_euler);
  bone.node.quaternion.slerp(_quat, 1 - Math.exp(-lambda * dt));
}

// Analytic 2-bone arm IK: aims upperArm -> foreArm -> handNode toward targetWorldPos
// Works across both procedural rigs and imported .glb skeletons regardless of local bone axis.
function solveTwoBoneArmIK(
  upperArm: THREE.Object3D,
  foreArm: THREE.Object3D,
  handNode: THREE.Object3D,
  targetWorldPos: THREE.Vector3,
  poleWorldDir: THREE.Vector3,
  dt: number,
  lambda = 38,
) {
  upperArm.updateMatrixWorld(true);
  upperArm.getWorldPosition(_ikS);
  foreArm.getWorldPosition(_ikE);
  handNode.getWorldPosition(_ikH);

  const l1 = Math.max(0.05, _ikS.distanceTo(_ikE));
  const l2 = Math.max(0.05, _ikE.distanceTo(_ikH));

  _ikT.copy(targetWorldPos).sub(_ikS);
  const rawDist = _ikT.length();
  if (rawDist < 0.001) return;

  const minReach = Math.abs(l1 - l2) + 0.02;
  const maxReach = l1 + l2 - 0.006;
  const d = THREE.MathUtils.clamp(rawDist, minReach, maxReach);
  _ikDir.copy(_ikT).divideScalar(rawDist);

  const cosAlpha = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Orthogonalize pole direction against shoulder->target axis
  const proj = poleWorldDir.dot(_ikDir);
  _ikBend.copy(poleWorldDir).addScaledVector(_ikDir, -proj);
  if (_ikBend.lengthSq() < 0.0001) _ikBend.set(0, -1, 0);
  _ikBend.normalize();

  _ikTargetElbow
    .copy(_ikS)
    .addScaledVector(_ikDir, l1 * cosAlpha)
    .addScaledVector(_ikBend, l1 * sinAlpha);

  // Rotate upperArm so current shoulder->elbow aligns with shoulder->targetElbow
  _ikCurDir.copy(_ikE).sub(_ikS);
  _ikTargetDir.copy(_ikTargetElbow).sub(_ikS);
  if (_ikCurDir.lengthSq() > 1e-6 && _ikTargetDir.lengthSq() > 1e-6 && upperArm.parent) {
    _ikCurDir.normalize();
    _ikTargetDir.normalize();
    _ikDeltaQ.setFromUnitVectors(_ikCurDir, _ikTargetDir);
    upperArm.getWorldQuaternion(_ikWorldQ);
    _ikWorldQ.premultiply(_ikDeltaQ);
    upperArm.parent.getWorldQuaternion(_ikParentQ).invert();
    _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
    upperArm.quaternion.slerp(_ikLocalQ, 1 - Math.exp(-lambda * dt));
  }

  // Update world matrices & align foreArm->hand toward targetWorldPos
  upperArm.updateMatrixWorld(true);
  foreArm.getWorldPosition(_ikE);
  handNode.getWorldPosition(_ikH);
  _ikCurDir.copy(_ikH).sub(_ikE);
  _ikTargetDir.copy(targetWorldPos).sub(_ikE);
  if (_ikCurDir.lengthSq() > 1e-6 && _ikTargetDir.lengthSq() > 1e-6 && foreArm.parent) {
    _ikCurDir.normalize();
    _ikTargetDir.normalize();
    _ikDeltaQ.setFromUnitVectors(_ikCurDir, _ikTargetDir);
    foreArm.getWorldQuaternion(_ikWorldQ);
    _ikWorldQ.premultiply(_ikDeltaQ);
    foreArm.parent.getWorldQuaternion(_ikParentQ).invert();
    _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
    foreArm.quaternion.slerp(_ikLocalQ, 1 - Math.exp(-lambda * dt));
  }
}

// Aligns a single bone segment (bone -> childBone) toward a desired world direction
function orientBoneSegmentToWorldDir(
  bone: THREE.Object3D,
  childBone: THREE.Object3D,
  desiredWorldDir: THREE.Vector3,
  dt: number,
  lambda = 14,
) {
  if (!bone.parent || desiredWorldDir.lengthSq() < 0.0001) return;
  bone.updateMatrixWorld(true);
  bone.getWorldPosition(_ikS);
  childBone.getWorldPosition(_ikE);
  _ikCurDir.copy(_ikE).sub(_ikS);
  if (_ikCurDir.lengthSq() < 0.0001) return;
  _ikCurDir.normalize();
  _ikTargetDir.copy(desiredWorldDir).normalize();
  _ikDeltaQ.setFromUnitVectors(_ikCurDir, _ikTargetDir);
  bone.getWorldQuaternion(_ikWorldQ);
  _ikWorldQ.premultiply(_ikDeltaQ);
  bone.parent.getWorldQuaternion(_ikParentQ).invert();
  _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
  bone.quaternion.slerp(_ikLocalQ, 1 - Math.exp(-lambda * dt));
}

function addWorldAxisRotation(
  boneNode: THREE.Object3D,
  worldAxis: THREE.Vector3,
  angleRad: number,
) {
  if (Math.abs(angleRad) < 0.0005 || !boneNode.parent) return;
  boneNode.updateMatrixWorld(true);
  boneNode.getWorldQuaternion(_ikWorldQ);
  _ikDeltaQ.setFromAxisAngle(worldAxis, angleRad);
  _ikWorldQ.premultiply(_ikDeltaQ);
  boneNode.parent.getWorldQuaternion(_ikParentQ).invert();
  _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
  boneNode.quaternion.copy(_ikLocalQ);
  boneNode.updateMatrixWorld(true);
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  life: number;
  radius: number;
  mesh: THREE.Mesh;
}

interface Pickup {
  active: boolean;
  kind: LootKind;
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  mesh: THREE.Object3D;
  disposeMesh?: () => void;
}

type LimbTarget = LimbId | 'torso';

interface LimbHitVolume {
  limb: LimbTarget;
  x: number;
  y: number;
  z: number;
  radius: number;
}

interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  scoreValue: number;
  state: 'wander' | 'investigate' | 'chase' | 'windup' | 'lunge' | 'attack' | 'recover';
  stateTimer: number;
  attackDuration: number;
  hasHitThisAttack: boolean;
  attackCooldown: number;
  wanderX: number;
  wanderZ: number;
  wanderWait: number;
  investigateX: number;
  investigateZ: number;
  investigateTimer: number;
  suspicion: number;
  aggroTimer: number;
  alertTimer: number;
  provoked: boolean;
  walkStyle: 'orco' | 'inestable';
  lungeDx: number;
  lungeDz: number;
  hitFlashTimer: number;
  squash: number;
  walkPhase: number;
  customSlotId?: string;
  limbHits: Record<LimbId, number>;
  severedLimbs: Set<LimbId>;
  bleedTimers: Record<LimbId, number>;
  stumpMeshes: Partial<Record<LimbId, { mesh: THREE.Mesh; dispose: () => void }>>;
  crawlFactor: number;
  bundle: EnemyMeshBundle;
  shadow: THREE.Mesh;
}

interface DyingEnemy {
  bundle: EnemyMeshBundle;
  shadow: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  yaw: number;
  baseShadowScale: number;
  fallDir: number;
  timer: number;
  duration: number;
  severedLimbs: Set<LimbId>;
  stumpMeshes: Partial<Record<LimbId, { mesh: THREE.Mesh; dispose: () => void }>>;
  crawlFactor: number;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  r: number;
  g: number;
  b: number;
}

interface BloodParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  splatted: boolean;
  splatChance: number;
  r: number;
  g: number;
  b: number;
}

interface BloodDecal {
  active: boolean;
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  mat: THREE.MeshStandardMaterial;
  baseXZ: Float32Array;
  x: number;
  z: number;
  age: number;
  duration: number;
  expandDuration: number;
  maxOpacity: number;
}

interface SeveredLimbChunk {
  group: THREE.Group;
  dispose: () => void;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  grounded: boolean;
  life: number;
  bleedTimer: number;
}

const MAX_PARTICLES = 240;
const MAX_BLOOD_PARTICLES = 360;
const MAX_BLOOD_DECALS = 100;
const BEST_SCORE_STORAGE_KEY = 'zona_cero_best_score';

const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
    uChromatic: { value: 0.14 },
    uGrain: { value: 0.06 },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.04 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uChromatic;
    uniform float uGrain;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uTime;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      vec2 offset = centered * (uChromatic * 0.0045 * dist);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;

      float vig = smoothstep(0.32, 0.92, dist);
      col *= 1.0 - vig * uVignette;

      if (uGrain > 0.001) {
        float n = (rand(vUv * 420.0 + vec2(uTime * 13.7, uTime * 7.3)) - 0.5) * uGrain * 0.16;
        col += n;
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export class SurvivalGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private audio = new GameAudio();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private isSoftwareGl = false;
  private disposed = false;
  private frameId = 0;
  private lastTimestamp = 0;

  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gradePass: ShaderPass | null = null;

  private hemiLight!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private campfireLight!: THREE.PointLight;
  private campfireVisuals!: CampfireVisuals;
  private worldEnv!: WorldEnvironment;
  private contactShadowTex!: THREE.CanvasTexture;
  private groundTex!: THREE.CanvasTexture;
  private simpleGroundTex!: THREE.CanvasTexture;
  private groundBumpTex!: THREE.CanvasTexture;
  private barkTex!: THREE.CanvasTexture;
  private stoneTex!: THREE.CanvasTexture;
  private skyTex!: THREE.CanvasTexture;
  private customGroundTex: THREE.Texture | null = null;
  private customStoneTex: THREE.Texture | null = null;
  private customBarkTex: THREE.Texture | null = null;

  private playerRig!: CharacterRig;
  private customZombieSlots: ZombieModelSlot[] = [];
  private customZombieTemplates = new Map<string, CustomZombieTemplate>();
  private customRifleTemplate: CustomRifleTemplate | null = null;
  private playerShadow!: THREE.Mesh;
  private aimReticle!: THREE.Mesh;
  private flareWaveMesh!: THREE.Mesh;
  private flareWaveTimer = 0;
  private muzzleFlashMesh!: THREE.Mesh;
  private muzzleFlashTimer = 0;

  private particleInst!: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private bloodInst!: THREE.InstancedMesh;
  private bloodParticles: BloodParticle[] = [];
  private bloodDecals: BloodDecal[] = [];
  private severedLimbChunks: SeveredLimbChunk[] = [];

  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private enemies: EnemyEntity[] = [];
  private dyingEnemies: DyingEnemy[] = [];
  private nextEnemyId = 1;

  private playerBoltGeo!: THREE.BufferGeometry;
  private playerBoltMat!: THREE.MeshBasicMaterial;
  private playerBoltTrailGeo!: THREE.BufferGeometry;
  private playerBoltTrailMat!: THREE.MeshBasicMaterial;
  private enemyBoltGeo!: THREE.BufferGeometry;
  private enemyBoltMat!: THREE.MeshStandardMaterial;
  private emberGeo!: THREE.BufferGeometry;
  private emberMat!: THREE.MeshStandardMaterial;
  private woodGeo!: THREE.BufferGeometry;
  private woodMat!: THREE.MeshStandardMaterial;
  private shadowGeo!: THREE.PlaneGeometry;
  private shadowMat!: THREE.MeshBasicMaterial;

  private gameState: GameState = 'TITLE_MENU';
  private difficulty: DifficultyId = 'warden';
  private elapsed = 0;
  private titleOrbitAngle = 0.6;
  private hitstopTimer = 0;
  private shakeTrauma = 0;

  // Free 3D position, velocity, jump & stance state
  private px = PLAYER_SPAWN_X;
  private py = 0;
  private pz = PLAYER_SPAWN_Z;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private pyaw = Math.PI;
  private grounded = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private jumpWindupTimer = 0;
  private readonly jumpWindupDuration = 0.115;
  private isCrouching = false;
  private crouchFactor = 0;
  private stance: MovementStance = 'idle';

  // Third-person behind-player chase & free look camera
  private camYaw = 0;
  private camPitch = 0.2;
  private camDistCurrent = 4.25;
  private camShoulderOffset = 0.38;
  private camPivotHeight = 1.5;
  private manualCameraCooldown = 0;
  private recenterCamTimer = 0;
  private pointerLocked = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private hasLastPointer = false;

  // Weapons & Combat
  private weapon: WeaponKind = 'rifle';
  private pistolAmmo = 15;
  private pistolMaxAmmo = 15;
  private pistolReserveAmmo = 30;
  private rifleAmmo = 30;
  private rifleMaxAmmo = 30;
  private rifleReserveAmmo = 60;
  private bandages = 1;
  private food = 1;
  private reloadTimer = 0;
  private isAiming = false;
  private aimPoint = new THREE.Vector3(0, 1.2, -10);

  private hp = 100;
  private maxHp = 100;
  private flareCharge = 45;
  private wood = 0;
  private score = 0;
  private bestScore = 0;
  private combo = 1;
  private comboTimer = 0;
  private survivalTime = 0;
  private kills = 0;
  private campfireWarmth = 100;
  private respawnTimer = 0;

  private strikeCooldown = 0;
  private invulnTimer = 0;
  private hurtFlashTimer = 0;
  private walkPhase = 0;
  private squashY = 1;
  private recoilTimer = 0;
  private meleeTimer = 0;
  private meleeHandSign = 1;
  private headYawOffset = 0;
  private headPitchOffset = 0;
  private deathAnimTimer = 0;
  private deathOrbitTimer = 0;
  private deathCamStartDist = 4.2;
  private deathCamStartHeight = 2.2;
  private deathFallDir = 1;

  private customModelName: string | null = null;
  private customRifleName: string | null = null;
  private modelError: string | null = null;

  private heldKeys = new Set<string>();
  private fireHeld = false;
  private aimHeld = false;
  private flareBufferTimer = 0;

  // Mobile / Touch Virtual Controls State
  private virtualMoveX = 0;
  private virtualMoveY = 0;
  private virtualSprint = false;
  private virtualFire = false;
  private virtualAim = false;
  private virtualCamVelYaw = 0;
  private virtualCamVelPitch = 0;
  private activeCamPointerId: number | null = null;
  private lastPointerType: string = 'mouse';

  private hudSyncTimer = 0;
  private ambientEmberTimer = 0;

  // Map, Dynamic Fog, Day/Night, Post-Processing, Camera & 3D World Editor
  private mapSettings: MapMaterialSettings = cargarMapSettingsLocal();
  private postProcess: PostProcessSettings = cargarPostProcessLocal();
  private cameraSettings: CameraSettings = cargarCameraSettingsLocal();
  private cameraPreviewActive = false;
  private cameraPreviewAim = false;
  private currentFogLevel = 0.0172;
  private propSlots: WorldPropSlot[] = [];
  private propTemplates = new Map<string, CustomPropTemplate>();
  private placedProps: PlacedWorldProp[] = [];
  private placedPropMeshes = new Map<string, THREE.Group>();
  private activePlacementSlotId: string | null = null;
  private selectedPropId: string | null = null;
  private selectionRing!: THREE.Mesh;
  private editorMode = false;
  private editorYaw = 0.6;
  private editorPitch = 0.72;
  private editorDist = 20;
  private editorTarget = new THREE.Vector3(0, 0, 0);
  private editorDragMode: 'none' | 'orbit' | 'move' = 'none';
  private editorDragStart = { x: 0, y: 0 };
  private editorPointerMoved = false;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    try {
      const saved = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
      if (saved) this.bestScore = Number(saved) || 0;
    } catch {
      this.bestScore = 0;
    }

    this.initRendererAndScene();
    this.initPoolsAndVisuals();
    this.bindEvents();
    void this.restoreCachedModels();
    this.emitHud();

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene() {
    this.isSoftwareGl = this.detectSoftwareWebGL();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1826);
    this.scene.fog = new THREE.FogExp2(0x111a26, 0.0172);

    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 165);
    this.camera.position.set(0, 6.2, 12.5);
    this.camera.lookAt(0, 1.3, 0);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.hemiLight = new THREE.HemisphereLight(0x6d8fc2, 0x1a241b, 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xc4dcff, 1.55);
    this.sunLight.position.set(18, 28, 16);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 65;
    const d = 22;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0xff9e5e, 0.42);
    this.rimLight.position.set(-16, 12, -18);
    this.scene.add(this.rimLight);

    setActiveMapPreset(this.mapSettings.mapPreset);
    const initialCf = this.getCampfirePos();
    const initialSpawn = this.getPlayerSpawnPos();
    this.px = initialSpawn.x;
    this.pz = initialSpawn.z;

    this.campfireLight = new THREE.PointLight(0xff7b1f, 6.8, 28, 1.4);
    this.campfireLight.position.set(
      initialCf.x,
      groundHeightAt(initialCf.x, initialCf.z) + 2.2,
      initialCf.z,
    );
    this.scene.add(this.campfireLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.groundTex = createGroundTexture(maxAniso);
    this.simpleGroundTex = createSimpleTerrainTexture(maxAniso);
    this.groundBumpTex = createGroundBumpTexture(maxAniso);
    this.barkTex = createBarkTexture(maxAniso);
    this.stoneTex = createStoneTexture(maxAniso);
    this.skyTex = createSkyGradientTexture();
    this.contactShadowTex = createContactShadowTexture();

    this.worldEnv = buildWorldEnvironment(
      this.scene,
      this.groundTex,
      this.groundBumpTex,
      this.barkTex,
      this.stoneTex,
      this.skyTex,
    );
    this.worldEnv.rebuildTerrainHeights(this.mapSettings.terrainScale, this.mapSettings.mapPreset);
    this.campfireVisuals = buildCampfireGroup(this.stoneTex, this.barkTex);
    this.campfireVisuals.group.position.set(
      initialCf.x,
      groundHeightAt(initialCf.x, initialCf.z),
      initialCf.z,
    );
    this.scene.add(this.campfireVisuals.group);

    this.playerRig = buildDefaultSurvivor();
    this.py = groundHeightAt(this.px, this.pz);
    this.playerRig.root.position.set(this.px, this.py, this.pz);
    this.scene.add(this.playerRig.root);
    this.syncWeaponVisibility();

    const selRingGeo = new THREE.RingGeometry(1.05, 1.32, 32);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.selectionRing = new THREE.Mesh(selRingGeo, selRingMat);
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    this.initPostProcessing();
    this.applyMapSettingsVisuals();
    this.applyPostProcessUniforms();
    this.updateDayNightAndFog(0);
  }

  private initPostProcessing() {
    if (this.isSoftwareGl) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(width, height);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      this.postProcess.bloomStrength,
      0.45,
      this.postProcess.bloomThreshold,
    );
    bloomPass.enabled = this.postProcess.bloomEnabled;
    composer.addPass(bloomPass);

    // OutputPass performs ACES tone mapping + Linear->sRGB conversion before sRGB color grading
    const outputPass = new OutputPass();
    outputPass.material.depthTest = false;
    outputPass.material.depthWrite = false;
    composer.addPass(outputPass);

    const gradePass = new ShaderPass(CinematicGradeShader);
    gradePass.material.depthTest = false;
    gradePass.material.depthWrite = false;
    composer.addPass(gradePass);

    this.composer = composer;
    this.bloomPass = bloomPass;
    this.gradePass = gradePass;
  }

  private initPoolsAndVisuals() {
    this.shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    this.shadowGeo.rotateX(-Math.PI / 2);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.playerShadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    this.playerShadow.position.set(this.px, 0.025, this.pz);
    this.scene.add(this.playerShadow);

    const retGeo = new THREE.RingGeometry(0.22, 0.34, 20);
    retGeo.rotateX(-Math.PI / 2);
    const retMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.aimReticle = new THREE.Mesh(retGeo, retMat);
    this.aimReticle.visible = false;
    this.scene.add(this.aimReticle);

    const flareGeo = new THREE.RingGeometry(0.8, 1.25, 36);
    flareGeo.rotateX(-Math.PI / 2);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xff7b24,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.flareWaveMesh = new THREE.Mesh(flareGeo, flareMat);
    this.flareWaveMesh.visible = false;
    this.scene.add(this.flareWaveMesh);

    const muzzleGeo = new THREE.SphereGeometry(0.24, 8, 8);
    const muzzleMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.muzzleFlashMesh = new THREE.Mesh(muzzleGeo, muzzleMat);
    this.muzzleFlashMesh.visible = false;
    this.scene.add(this.muzzleFlashMesh);

    const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInst = new THREE.InstancedMesh(partGeo, partMat, MAX_PARTICLES);
    this.particleInst.frustumCulled = false;
    this.scene.add(this.particleInst);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        gravity: 9.8,
        r: 1,
        g: 0.7,
        b: 0.2,
      });
      _mat4.makeScale(0, 0, 0);
      this.particleInst.setMatrixAt(i, _mat4);
      this.particleInst.setColorAt(i, _color.setRGB(1, 0.7, 0.2));
    }
    this.particleInst.instanceMatrix.needsUpdate = true;
    if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;

    const bloodGeo = new THREE.SphereGeometry(0.032, 5, 4);
    const bloodMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.08,
      emissive: new THREE.Color(0x280205),
      emissiveIntensity: 0.32,
    });
    this.bloodInst = new THREE.InstancedMesh(bloodGeo, bloodMat, MAX_BLOOD_PARTICLES);
    this.bloodInst.frustumCulled = false;
    this.scene.add(this.bloodInst);

    for (let i = 0; i < MAX_BLOOD_PARTICLES; i++) {
      this.bloodParticles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        splatted: false,
        splatChance: 0.35,
        r: 0.52,
        g: 0.03,
        b: 0.04,
      });
      _mat4.makeScale(0, 0, 0);
      this.bloodInst.setMatrixAt(i, _mat4);
      this.bloodInst.setColorAt(i, _color.setRGB(0.52, 0.03, 0.04));
    }
    this.bloodInst.instanceMatrix.needsUpdate = true;
    if (this.bloodInst.instanceColor) this.bloodInst.instanceColor.needsUpdate = true;

    this.playerBoltGeo = new THREE.CylinderGeometry(0.016, 0.03, 1.35, 6);
    this.playerBoltGeo.rotateX(Math.PI / 2);
    this.playerBoltMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.55, 0.25),
      toneMapped: false,
    });
    this.playerBoltTrailGeo = new THREE.CylinderGeometry(0.052, 0.014, 2.35, 6);
    this.playerBoltTrailGeo.rotateX(Math.PI / 2);
    this.playerBoltTrailGeo.translate(0, 0, -0.55);
    this.playerBoltTrailMat = new THREE.MeshBasicMaterial({
      color: 0xff7b00,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.enemyBoltGeo = new THREE.SphereGeometry(0.26, 8, 8);
    this.enemyBoltMat = new THREE.MeshStandardMaterial({
      color: 0xd9f99d,
      emissive: new THREE.Color(0x84cc16),
      emissiveIntensity: 2.4,
      roughness: 0.25,
    });

    const puddleTextures = getBloodPuddleTextures();
    for (let i = 0; i < MAX_BLOOD_DECALS; i++) {
      const geo = new THREE.PlaneGeometry(1, 1, 4, 4);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const baseXZ = new Float32Array(posAttr.count * 2);
      for (let v = 0; v < posAttr.count; v++) {
        baseXZ[v * 2] = posAttr.getX(v);
        baseXZ[v * 2 + 1] = posAttr.getZ(v);
      }
      const mat = new THREE.MeshStandardMaterial({
        map: puddleTextures[0],
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        roughness: 0.12,
        metalness: 0.08,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.bloodDecals.push({
        active: false,
        mesh,
        geo,
        mat,
        baseXZ,
        x: 0,
        z: 0,
        age: 0,
        duration: 48,
        expandDuration: 1.1,
        maxOpacity: 0.9,
      });
    }

    this.emberGeo = new THREE.OctahedronGeometry(0.24, 0);
    this.emberMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 1.9,
      roughness: 0.2,
    });
    this.woodGeo = new THREE.BoxGeometry(0.36, 0.24, 0.36);
    this.woodMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: new THREE.Color(0x059669),
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private async restoreCachedModels() {
    const [
      charBuffer,
      charMeta,
      legacyZombieBuffer,
      legacyZombieMeta,
      loadedZombieSlots,
      rifleBuffer,
      rifleMeta,
      slots,
      placed,
      texGround,
      texStone,
      texBark,
    ] = await Promise.all([
      cargarModeloCache(),
      cargarModeloMeta(),
      cargarZombieCache(),
      cargarZombieMeta(),
      listarZombieSlotsCache(),
      cargarRifleCache(),
      cargarRifleMeta(),
      listarPropSlotsCache(),
      cargarPlacedPropsCache(),
      cargarTextureCache('ground'),
      cargarTextureCache('stone'),
      cargarTextureCache('bark'),
    ]);
    if (this.disposed) return;

    if (rifleBuffer) {
      try {
        await this.applyRifleGlbBuffer(rifleBuffer, rifleMeta?.name || 'Fusil.glb');
      } catch {
        this.modelError = 'No se pudo cargar el .glb del fusil en caché.';
      }
    }
    if (charBuffer && !this.disposed) {
      try {
        await this.applyGlbBuffer(charBuffer, charMeta?.name || 'Superviviente.glb');
      } catch {
        this.modelError = 'No se pudo cargar el .glb del personaje en caché.';
      }
    }

    let zombieSlots = loadedZombieSlots;
    if (zombieSlots.length === 0 && legacyZombieBuffer && !this.disposed) {
      try {
        zombieSlots = await guardarZombieSlotCache(
          'zombie_legacy_1',
          legacyZombieBuffer,
          legacyZombieMeta?.name || 'Zombie.glb',
          'all',
        );
        await eliminarZombieCache();
      } catch {
        // Ignore legacy migration error
      }
    }

    const [zombieBuffers, propBuffers] = await Promise.all([
      cargarZombieSlotBuffers(zombieSlots.map((z) => z.id)),
      cargarPropSlotBuffers(slots.map((s) => s.id)),
    ]);
    if (this.disposed) return;

    const riflePromise = rifleBuffer
      ? this.applyRifleGlbBuffer(rifleBuffer, rifleMeta?.name || 'Fusil.glb').catch(() => {
          this.modelError = 'No se pudo cargar el .glb del fusil en caché.';
        })
      : Promise.resolve();

    const charPromise = charBuffer
      ? parseGlbCharacter(charBuffer, this.customRifleTemplate)
          .then((newRig) => {
            if (this.disposed) {
              newRig.dispose();
              return;
            }
            this.scene.remove(this.playerRig.root);
            this.playerRig.dispose();
            this.playerRig = newRig;
            this.playerRig.root.position.set(this.px, this.py, this.pz);
            this.playerRig.root.rotation.y = this.pyaw;
            this.scene.add(this.playerRig.root);
            this.customModelName = charMeta?.name || 'Superviviente.glb';
          })
          .catch(() => {
            this.modelError = 'No se pudo cargar el .glb del personaje en caché.';
          })
      : Promise.resolve();

    this.customZombieSlots = zombieSlots;
    const zombiePromises = zombieSlots.map(async (zSlot) => {
      const buf = zombieBuffers.get(zSlot.id) ?? (await cargarZombieSlotBuffer(zSlot.id));
      if (!buf || this.disposed) return;
      try {
        const tmpl = await parseGlbZombieTemplate(buf, zSlot.name);
        if (this.disposed) {
          tmpl.dispose();
          return;
        }
        this.customZombieTemplates.set(zSlot.id, tmpl);
      } catch {
        this.modelError = `No se pudo cargar el .glb de zombie en caché (${zSlot.name}).`;
      }
    });

    this.propSlots = slots;
    const propPromises = slots.map(async (slot) => {
      const buf = propBuffers.get(slot.id) ?? (await cargarPropSlotBuffer(slot.id));
      if (!buf || this.disposed) return;
      try {
        const tmpl = await parseGlbPropTemplate(buf, slot.category);
        if (this.disposed) {
          tmpl.dispose();
          return;
        }
        this.propTemplates.set(slot.id, tmpl);
      } catch {
        // Skip corrupted slot buffer
      }
    });

    const texTasks: Promise<void>[] = [];
    if (texGround) {
      texTasks.push(
        this.applyImportedTextureBuffer('ground', texGround.buffer, texGround.name, texGround.mimeType),
      );
    }
    if (texStone) {
      texTasks.push(
        this.applyImportedTextureBuffer('stone', texStone.buffer, texStone.name, texStone.mimeType),
      );
    }
    if (texBark) {
      texTasks.push(
        this.applyImportedTextureBuffer('bark', texBark.buffer, texBark.name, texBark.mimeType),
      );
    }

    await Promise.all([riflePromise, charPromise, ...zombiePromises, ...propPromises, ...texTasks]);
    if (this.disposed) return;

    if (this.customRifleTemplate) {
      applyRifleToRig(this.playerRig, this.customRifleTemplate);
    }
    this.syncWeaponVisibility();

    if (this.customZombieTemplates.size > 0) {
      this.rebuildActiveEnemiesMeshes();
    }

    if (slots.length > 0 && !this.activePlacementSlotId) {
      this.activePlacementSlotId = slots[0].id;
    }

    this.placedProps = placed.filter((p) => this.propTemplates.has(p.slotId));
    this.placedProps.forEach((p) => this.spawnPlacedPropMesh(p));
    this.rebuildActiveColliders();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.emitHud();
  }

  public async loadCustomGlbFile(file: File): Promise<void> {
    this.modelError = null;
    try {
      const buffer = await file.arrayBuffer();
      await this.applyGlbBuffer(buffer, file.name);
      await guardarModeloCache(buffer, file.name);
      if (!this.isSoftwareGl && !this.disposed) {
        this.renderer.compile(this.scene, this.camera);
      }
      this.emitHud();
    } catch (err) {
      this.modelError =
        err instanceof Error ? `Archivo .glb inválido: ${err.message}` : 'Error al cargar el .glb.';
      this.emitHud();
    }
  }

  public async loadCustomZombieGlbFile(file: File): Promise<void> {
    await this.loadCustomZombieGlbFiles([file]);
  }

  public async loadCustomZombieGlbFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    this.modelError = null;
    const baseTs = Date.now();

    const settled = await Promise.allSettled(
      files.map(async (file, i) => {
        const buffer = await file.arrayBuffer();
        const template = await parseGlbZombieTemplate(buffer, file.name);
        if (this.disposed) {
          template.dispose();
          return null;
        }
        const slotId = `zombie_${baseTs}_${Math.random().toString(36).slice(2, 7)}_${i}`;
        return { slotId, buffer, fileName: file.name, template };
      }),
    );

    const parsedItems: Array<{
      slotId: string;
      buffer: ArrayBuffer;
      fileName: string;
      template: CustomZombieTemplate;
    }> = [];

    for (let i = 0; i < settled.length; i++) {
      const res = settled[i];
      if (res.status === 'fulfilled' && res.value) {
        parsedItems.push(res.value);
      } else if (res.status === 'rejected') {
        const fileName = files[i]?.name ?? 'zombie.glb';
        const reason = res.reason;
        this.modelError =
          reason instanceof Error
            ? `Zombie .glb inválido (${fileName}): ${reason.message}`
            : `Error al cargar zombie .glb (${fileName}).`;
      }
    }

    if (this.disposed) {
      parsedItems.forEach((it) => it.template.dispose());
      return;
    }

    if (parsedItems.length > 0) {
      parsedItems.forEach((it) => {
        this.customZombieTemplates.set(it.slotId, it.template);
      });
      this.customZombieSlots = await guardarZombieSlotsBatchCache(
        parsedItems.map((it) => ({
          slotId: it.slotId,
          arrayBuffer: it.buffer,
          fileName: it.fileName,
          targetKind: 'all',
        })),
      );
      if (!this.disposed) {
        this.rebuildActiveEnemiesMeshes();
        this.syncEnemiesToCustomSlotCounts();
        if (!this.isSoftwareGl) {
          this.renderer.compile(this.scene, this.camera);
        }
      }
    }
    this.emitHud();
  }

  public async loadCustomRifleGlbFile(file: File): Promise<void> {
    this.modelError = null;
    try {
      const buffer = await file.arrayBuffer();
      await this.applyRifleGlbBuffer(buffer, file.name);
      await guardarRifleCache(buffer, file.name);
      if (!this.isSoftwareGl && !this.disposed) {
        this.renderer.compile(this.scene, this.camera);
      }
      this.emitHud();
    } catch (err) {
      this.modelError =
        err instanceof Error ? `Fusil .glb inválido: ${err.message}` : 'Error al cargar fusil .glb.';
      this.emitHud();
    }
  }

  private async applyGlbBuffer(buffer: ArrayBuffer, fileName: string): Promise<void> {
    const newRig = await parseGlbCharacter(buffer, this.customRifleTemplate);
    if (this.disposed) {
      newRig.dispose();
      return;
    }
    this.scene.remove(this.playerRig.root);
    this.playerRig.dispose();
    this.playerRig = newRig;
    this.playerRig.root.position.set(this.px, this.py, this.pz);
    this.playerRig.root.rotation.y = this.pyaw;
    this.scene.add(this.playerRig.root);
    this.syncWeaponVisibility();
    this.customModelName = fileName;
    this.modelError = null;
    this.emitHud();
  }

  private async applyRifleGlbBuffer(buffer: ArrayBuffer, fileName: string): Promise<void> {
    const template = await parseGlbRifleTemplate(buffer);
    if (this.disposed) {
      template.dispose();
      return;
    }
    this.customRifleTemplate?.dispose();
    this.customRifleTemplate = template;
    this.customRifleName = fileName;
    this.modelError = null;
    applyRifleToRig(this.playerRig, this.customRifleTemplate);
    this.syncWeaponVisibility();
    this.emitHud();
  }

  private getCustomZombieSummary(): string | null {
    if (this.customZombieSlots.length === 0) return null;
    if (this.customZombieSlots.length === 1) return this.customZombieSlots[0].name;
    return `${this.customZombieSlots.length} modelos de zombie`;
  }

  private getActiveZombieSlots(): ZombieModelSlot[] {
    return this.customZombieSlots.filter((s) => this.customZombieTemplates.has(s.id));
  }

  private pickCustomZombieSlotAndTemplate(
    kind: EnemyKind,
    enemyId: number,
  ): { slotId?: string; template: CustomZombieTemplate | null } {
    const active = this.getActiveZombieSlots();
    if (active.length === 0) return { slotId: undefined, template: null };

    const specific = active.filter((s) => s.targetKind === kind);
    if (specific.length > 0) {
      const slot = specific[Math.abs(enemyId - 1) % specific.length];
      return { slotId: slot.id, template: this.customZombieTemplates.get(slot.id) ?? null };
    }

    const shared = active.filter((s) => !s.targetKind || s.targetKind === 'all');
    if (shared.length > 0) {
      const slot = shared[Math.abs(enemyId - 1) % shared.length];
      return { slotId: slot.id, template: this.customZombieTemplates.get(slot.id) ?? null };
    }

    return { slotId: undefined, template: null };
  }

  private pickSlotWithDeficit(): ZombieModelSlot | null {
    const active = this.getActiveZombieSlots();
    if (active.length === 0) return null;

    const counts = new Map<string, number>();
    for (let i = 0; i < this.enemies.length; i++) {
      const sid = this.enemies[i].customSlotId;
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }

    let bestSlot: ZombieModelSlot | null = null;
    let bestDeficit = 0;
    for (let i = 0; i < active.length; i++) {
      const slot = active[i];
      const desired = Math.max(0, Math.min(25, slot.spawnCount ?? 4));
      const current = counts.get(slot.id) ?? 0;
      const deficit = desired - current;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestSlot = slot;
      }
    }
    return bestSlot;
  }

  private spawnEnemyForActivePopulation(onPerimeter: boolean) {
    const active = this.getActiveZombieSlots();
    if (active.length > 0) {
      const deficitSlot = this.pickSlotWithDeficit();
      if (!deficitSlot) return;
      const kind =
        deficitSlot.targetKind && deficitSlot.targetKind !== 'all'
          ? deficitSlot.targetKind
          : this.pickRandomKind();
      this.spawnEnemy(kind, onPerimeter, deficitSlot.id);
      return;
    }
    this.spawnEnemy(this.pickRandomKind(), onPerimeter);
  }

  private syncEnemiesToCustomSlotCounts() {
    if (this.disposed) return;
    if (this.gameState !== 'PLAYING' && this.gameState !== 'PAUSED') return;

    const active = this.getActiveZombieSlots();
    if (active.length === 0) return;

    const slotMap = new Map<string, ZombieModelSlot>();
    active.forEach((s) => slotMap.set(s.id, s));

    const keptCounts = new Map<string, number>();
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const slot = e.customSlotId ? slotMap.get(e.customSlotId) : undefined;
      const desired = slot ? Math.max(0, Math.min(25, slot.spawnCount ?? 4)) : 0;
      const seen = slot ? (keptCounts.get(slot.id) ?? 0) : 0;
      if (!slot || seen >= desired) {
        Object.values(e.stumpMeshes).forEach((s) => {
          if (s) {
            s.mesh.parent?.remove(s.mesh);
            s.dispose();
          }
        });
        this.scene.remove(e.bundle.group, e.shadow);
        e.bundle.dispose();
        this.enemies.splice(i, 1);
      } else {
        keptCounts.set(slot.id, seen + 1);
      }
    }

    for (let i = 0; i < active.length; i++) {
      const slot = active[i];
      const desired = Math.max(0, Math.min(25, slot.spawnCount ?? 4));
      const current = keptCounts.get(slot.id) ?? 0;
      for (let k = current; k < desired; k++) {
        const kind =
          slot.targetKind && slot.targetKind !== 'all'
            ? slot.targetKind
            : this.pickRandomKind();
        this.spawnEnemy(kind, true, slot.id);
      }
    }
  }

  private clearDyingEnemies() {
    for (let i = 0; i < this.dyingEnemies.length; i++) {
      const d = this.dyingEnemies[i];
      this.scene.remove(d.bundle.group);
      this.scene.remove(d.shadow);
      Object.values(d.stumpMeshes).forEach((s) => s?.dispose());
      d.bundle.dispose();
    }
    this.dyingEnemies = [];
  }

  private rebuildActiveEnemiesMeshes() {
    const activeSlots = this.getActiveZombieSlots();
    const slotMap = new Map<string, ZombieModelSlot>();
    activeSlots.forEach((s) => slotMap.set(s.id, s));

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      Object.values(e.stumpMeshes).forEach((s) => {
        if (s) s.mesh.parent?.remove(s.mesh);
      });
      this.scene.remove(e.bundle.group);
      e.bundle.dispose();

      let tmpl: CustomZombieTemplate | null = null;
      const ownSlot = e.customSlotId ? slotMap.get(e.customSlotId) : undefined;
      if (ownSlot) {
        if (ownSlot.targetKind && ownSlot.targetKind !== 'all') {
          e.kind = ownSlot.targetKind;
        }
        tmpl = this.customZombieTemplates.get(ownSlot.id) ?? null;
      } else {
        const picked = this.pickCustomZombieSlotAndTemplate(e.kind, e.id);
        e.customSlotId = picked.slotId;
        tmpl = picked.template;
      }

      e.bundle = buildEnemyMesh(e.kind, tmpl);
      e.bundle.group.position.set(e.x, groundHeightAt(e.x, e.z), e.z);
      e.bundle.group.rotation.y = e.yaw;
      e.bundle.hpFillMesh.scale.x = Math.max(0.001, e.hp / Math.max(1, e.maxHp));
      Object.values(e.stumpMeshes).forEach((s) => {
        if (s) e.bundle.bodyPivot.add(s.mesh);
      });
      this.scene.add(e.bundle.group);
    }
  }

  public async setZombieSlotTargetKind(
    slotId: string,
    targetKind: ZombieTargetKind,
  ): Promise<void> {
    this.customZombieSlots = await actualizarZombieSlotTargetCache(slotId, targetKind);
    if (this.disposed) return;
    this.rebuildActiveEnemiesMeshes();
    this.emitHud();
  }

  public async setZombieSlotSpawnCount(slotId: string, spawnCount: number): Promise<void> {
    this.customZombieSlots = await actualizarZombieSlotCountCache(slotId, spawnCount);
    if (this.disposed) return;
    this.syncEnemiesToCustomSlotCounts();
    this.emitHud();
  }

  public async deleteCustomZombieSlot(slotId: string): Promise<void> {
    this.customZombieSlots = await eliminarZombieSlotCache(slotId);
    if (this.disposed) return;
    this.clearDyingEnemies();
    const oldTemplate = this.customZombieTemplates.get(slotId);
    if (oldTemplate) {
      this.customZombieTemplates.delete(slotId);
      oldTemplate.dispose();
    }
    this.rebuildActiveEnemiesMeshes();
    this.syncEnemiesToCustomSlotCounts();
    this.modelError = null;
    this.emitHud();
  }

  public async resetToDefaultCharacter(): Promise<void> {
    await eliminarModeloCache();
    if (this.disposed) return;
    this.scene.remove(this.playerRig.root);
    this.playerRig.dispose();
    this.playerRig = buildDefaultSurvivor(this.customRifleTemplate);
    this.playerRig.root.position.set(this.px, this.py, this.pz);
    this.playerRig.root.rotation.y = this.pyaw;
    this.scene.add(this.playerRig.root);
    this.syncWeaponVisibility();
    this.customModelName = null;
    this.modelError = null;
    this.emitHud();
  }

  public async resetToDefaultRifle(): Promise<void> {
    await eliminarRifleCache();
    if (this.disposed) return;
    this.customRifleTemplate?.dispose();
    this.customRifleTemplate = null;
    this.customRifleName = null;
    this.modelError = null;
    applyRifleToRig(this.playerRig, null);
    this.syncWeaponVisibility();
    this.emitHud();
  }

  public async resetToDefaultZombie(): Promise<void> {
    await limpiarTodosZombiesCache();
    if (this.disposed) return;
    this.clearDyingEnemies();
    this.customZombieSlots = [];
    this.modelError = null;
    const oldTemplates = Array.from(this.customZombieTemplates.values());
    this.customZombieTemplates.clear();
    this.rebuildActiveEnemiesMeshes();
    oldTemplates.forEach((t) => t.dispose());
    this.emitHud();
  }

  private syncWeaponVisibility() {
    this.playerRig.pistolMesh.visible = this.weapon === 'pistol';
    this.playerRig.rifleMesh.visible = this.weapon === 'rifle';
  }

  private switchWeapon(next: WeaponKind) {
    if (this.weapon === next) return;
    this.weapon = next;
    this.reloadTimer = 0;
    this.syncWeaponVisibility();
    if (next !== 'unarmed') {
      this.audio.playReload();
    }
    this.emitHud();
  }

  private startReload() {
    if (this.weapon === 'unarmed' || this.reloadTimer > 0) return;
    if (this.weapon === 'pistol') {
      if (this.pistolAmmo >= this.pistolMaxAmmo || this.pistolReserveAmmo <= 0) return;
    } else if (this.weapon === 'rifle') {
      if (this.rifleAmmo >= this.rifleMaxAmmo || this.rifleReserveAmmo <= 0) return;
    }
    this.reloadTimer = this.weapon === 'pistol' ? 0.8 : 1.15;
    this.audio.playReload();
    this.emitHud();
  }

  public useBandage() {
    this.audio.unlock();
    if (this.gameState !== 'PLAYING' || this.bandages <= 0 || this.hp >= this.maxHp) return;
    this.bandages -= 1;
    this.hp = Math.min(this.maxHp, this.hp + 40);
    this.audio.playStoke();
    this.spawnBurst(this.px, this.py + 1.0, this.pz, 10, 0.25, 0.92, 0.45, 4.2);
    this.emitHud();
  }

  public useFood() {
    this.audio.unlock();
    if (
      this.gameState !== 'PLAYING' ||
      this.food <= 0 ||
      (this.hp >= this.maxHp && this.campfireWarmth >= 98)
    ) {
      return;
    }
    this.food -= 1;
    this.hp = Math.min(this.maxHp, this.hp + 25);
    this.campfireWarmth = Math.min(100, this.campfireWarmth + 28);
    this.audio.playPickup(this.combo);
    this.spawnBurst(this.px, this.py + 1.0, this.pz, 10, 0.96, 0.76, 0.24, 4.0);
    this.emitHud();
  }

  // --- MUNDO, SLOTS DE OBJETOS (.GLB), TEXTURAS, EDITOR 3D Y POSTPROCESADO ---

  public async uploadWorldPropGlb(category: WorldPropCategory, file: File): Promise<void> {
    this.modelError = null;
    try {
      const buffer = await file.arrayBuffer();
      const template = await parseGlbPropTemplate(buffer, category);
      if (this.disposed) {
        template.dispose();
        return;
      }
      const slotId = `prop_${category}_${Date.now()}_${Math.floor(Math.random() * 999)}`;
      this.propTemplates.set(slotId, template);
      this.propSlots = await guardarPropSlotCache(slotId, category, buffer, file.name);
      this.activePlacementSlotId = slotId;
      if (!this.isSoftwareGl && !this.disposed) {
        this.renderer.compile(this.scene, this.camera);
      }
      this.emitHud();
    } catch (err) {
      this.modelError =
        err instanceof Error ? `Objeto .glb inválido: ${err.message}` : 'Error al cargar objeto .glb.';
      this.emitHud();
    }
  }

  public async deleteWorldPropSlot(slotId: string): Promise<void> {
    this.propSlots = await eliminarPropSlotCache(slotId);
    const tmpl = this.propTemplates.get(slotId);
    tmpl?.dispose();
    this.propTemplates.delete(slotId);

    const remaining: PlacedWorldProp[] = [];
    for (let i = 0; i < this.placedProps.length; i++) {
      const p = this.placedProps[i];
      if (p.slotId === slotId) {
        this.removePlacedPropMesh(p.instanceId);
        if (this.selectedPropId === p.instanceId) this.selectedPropId = null;
      } else {
        remaining.push(p);
      }
    }
    this.placedProps = remaining;
    await guardarPlacedPropsCache(this.placedProps);
    if (this.activePlacementSlotId === slotId) {
      this.activePlacementSlotId = this.propSlots[0]?.id ?? null;
    }
    this.rebuildActiveColliders();
    this.emitHud();
  }

  public setActivePlacementSlot(slotId: string | null) {
    this.activePlacementSlotId = slotId;
    this.emitHud();
  }

  private getCampfirePos(): { x: number; z: number } {
    return getCampfireCoords(this.mapSettings.mapPreset);
  }

  private getPlayerSpawnPos(): { x: number; z: number } {
    return getPlayerSpawnCoords(this.mapSettings.mapPreset);
  }

  public setEditorMode(enabled: boolean) {
    this.editorMode = enabled;
    this.editorDragMode = 'none';
    this.worldEnv.editorGrid.visible = enabled;
    if (enabled) {
      this.exitPointerLockSafe();
      this.heldKeys.clear();
      this.clearVirtualControls();
      this.editorTarget.set(this.px, this.py, this.pz);
      if (this.selectedPropId) {
        const sel = this.placedProps.find((p) => p.instanceId === this.selectedPropId);
        if (sel) this.syncSelectionRing(sel);
      } else {
        this.selectionRing.visible = false;
      }
    } else {
      this.selectionRing.visible = false;
    }
    this.emitHud();
  }

  public placeWorldPropNearPlayer(slotId: string) {
    const fwdX = Math.sin(this.pyaw);
    const fwdZ = Math.cos(this.pyaw);
    const tx = THREE.MathUtils.clamp(this.px + fwdX * 3.8, -ARENA_PLAYABLE_RADIUS + 1.5, ARENA_PLAYABLE_RADIUS - 1.5);
    const tz = THREE.MathUtils.clamp(this.pz + fwdZ * 3.8, -ARENA_PLAYABLE_RADIUS + 1.5, ARENA_PLAYABLE_RADIUS - 1.5);
    this.placeWorldPropAt(slotId, tx, tz);
  }

  public placeWorldPropAt(slotId: string, x: number, z: number) {
    const slot = this.propSlots.find((s) => s.id === slotId);
    const tmpl = this.propTemplates.get(slotId);
    if (!slot || !tmpl) return;

    const catMeta = PROP_CATEGORIES.find((c) => c.id === slot.category);
    const instanceId = `inst_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const clampedR = Math.hypot(x, z);
    let px = x;
    let pz = z;
    if (clampedR > ARENA_PLAYABLE_RADIUS + 10) {
      px = (x / clampedR) * (ARENA_PLAYABLE_RADIUS + 10);
      pz = (z / clampedR) * (ARENA_PLAYABLE_RADIUS + 10);
    }

    const placed: PlacedWorldProp = {
      instanceId,
      slotId,
      category: slot.category,
      name: slot.name,
      x: Number(px.toFixed(2)),
      yOffset: 0,
      z: Number(pz.toFixed(2)),
      scale: 1,
      rotationY: 0,
      solid: catMeta ? catMeta.solidDefault : true,
    };
    this.placedProps.push(placed);
    this.spawnPlacedPropMesh(placed);
    this.selectedPropId = instanceId;
    this.syncSelectionRing(placed);
    this.rebuildActiveColliders();
    void guardarPlacedPropsCache(this.placedProps);
    this.emitHud();
  }

  public duplicatePlacedProp(instanceId: string) {
    const src = this.placedProps.find((p) => p.instanceId === instanceId);
    if (!src) return;
    if (!this.propTemplates.has(src.slotId)) return;
    const nextId = `inst_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    let nx = src.x + 1.5;
    let nz = src.z + 1.5;
    const rad = Math.hypot(nx, nz);
    if (rad > ARENA_PLAYABLE_RADIUS + 10) {
      nx = (nx / rad) * (ARENA_PLAYABLE_RADIUS + 10);
      nz = (nz / rad) * (ARENA_PLAYABLE_RADIUS + 10);
    }
    const copy: PlacedWorldProp = {
      ...src,
      instanceId: nextId,
      x: Number(nx.toFixed(2)),
      z: Number(nz.toFixed(2)),
    };
    this.placedProps.push(copy);
    this.spawnPlacedPropMesh(copy);
    this.selectedPropId = nextId;
    this.syncSelectionRing(copy);
    this.rebuildActiveColliders();
    void guardarPlacedPropsCache(this.placedProps);
    this.emitHud();
  }

  public selectPlacedProp(instanceId: string | null) {
    this.selectedPropId = instanceId;
    const found = instanceId ? this.placedProps.find((p) => p.instanceId === instanceId) : null;
    if (found) {
      this.syncSelectionRing(found);
      this.editorTarget.set(found.x, groundHeightAt(found.x, found.z), found.z);
    } else {
      this.selectionRing.visible = false;
    }
    this.emitHud();
  }

  public updatePlacedProp(instanceId: string, patch: Partial<PlacedWorldProp>) {
    const idx = this.placedProps.findIndex((p) => p.instanceId === instanceId);
    if (idx === -1) return;
    const next: PlacedWorldProp = {
      ...this.placedProps[idx],
      ...patch,
      scale: THREE.MathUtils.clamp(patch.scale ?? this.placedProps[idx].scale, 0.25, 5.0),
    };
    this.placedProps[idx] = next;
    const mesh = this.placedPropMeshes.get(instanceId);
    if (mesh) {
      mesh.position.set(next.x, groundHeightAt(next.x, next.z) + next.yOffset, next.z);
      mesh.scale.setScalar(next.scale);
      mesh.rotation.y = (next.rotationY * Math.PI) / 180;
    }
    if (this.selectedPropId === instanceId) {
      this.syncSelectionRing(next);
    }
    this.rebuildActiveColliders();
    void guardarPlacedPropsCache(this.placedProps);
    this.emitHud();
  }

  public removePlacedProp(instanceId: string) {
    this.placedProps = this.placedProps.filter((p) => p.instanceId !== instanceId);
    this.removePlacedPropMesh(instanceId);
    if (this.selectedPropId === instanceId) {
      this.selectedPropId = null;
      this.selectionRing.visible = false;
    }
    this.rebuildActiveColliders();
    void guardarPlacedPropsCache(this.placedProps);
    this.emitHud();
  }

  public clearAllPlacedProps() {
    this.placedProps.forEach((p) => this.removePlacedPropMesh(p.instanceId));
    this.placedProps = [];
    this.selectedPropId = null;
    this.selectionRing.visible = false;
    this.rebuildActiveColliders();
    void guardarPlacedPropsCache([]);
    this.emitHud();
  }

  private spawnPlacedPropMesh(prop: PlacedWorldProp) {
    const tmpl = this.propTemplates.get(prop.slotId);
    if (!tmpl) return;
    this.removePlacedPropMesh(prop.instanceId);
    const group = instantiatePropFromTemplate(tmpl);
    group.userData.propInstanceId = prop.instanceId;
    group.traverse((child) => {
      child.userData.propInstanceId = prop.instanceId;
    });
    group.position.set(prop.x, groundHeightAt(prop.x, prop.z) + prop.yOffset, prop.z);
    group.scale.setScalar(prop.scale);
    group.rotation.y = (prop.rotationY * Math.PI) / 180;
    this.scene.add(group);
    this.placedPropMeshes.set(prop.instanceId, group);
  }

  private removePlacedPropMesh(instanceId: string) {
    const existing = this.placedPropMeshes.get(instanceId);
    if (existing) {
      this.scene.remove(existing);
      this.placedPropMeshes.delete(instanceId);
    }
  }

  private syncSelectionRing(prop: PlacedWorldProp) {
    const tmpl = this.propTemplates.get(prop.slotId);
    const r = Math.max(0.8, (tmpl?.baseRadius ?? 1.0) * prop.scale * 1.15);
    this.selectionRing.visible = this.editorMode;
    this.selectionRing.position.set(prop.x, groundHeightAt(prop.x, prop.z) + 0.08, prop.z);
    this.selectionRing.scale.setScalar(r);
  }

  private rebuildActiveColliders() {
    const isSandbox = this.mapSettings.mapPreset === 'custom_sandbox';
    const next: WorldCollider[] = [];
    if (!isSandbox) {
      for (let i = 0; i < this.worldEnv.baseColliders.length; i++) {
        const c = this.worldEnv.baseColliders[i];
        if (c.source === 'ruin' && !this.mapSettings.showDefaultRuins) continue;
        if (c.source === 'tree' && !this.mapSettings.showDefaultForest) continue;
        next.push(c);
      }
    }
    for (let i = 0; i < this.placedProps.length; i++) {
      const p = this.placedProps[i];
      if (!p.solid) continue;
      const tmpl = this.propTemplates.get(p.slotId);
      next.push({
        x: p.x,
        z: p.z,
        radius: Math.max(0.45, (tmpl?.baseRadius ?? 0.9) * p.scale),
        height: Math.max(0.8, (tmpl?.baseHeight ?? 2.0) * p.scale),
        source: 'prop',
      });
    }
    this.worldEnv.colliders = next;
  }

  public setMapSettings(patch: Partial<MapMaterialSettings>) {
    const prevRelief = this.mapSettings.terrainScale;
    const prevPreset = this.mapSettings.mapPreset;
    this.mapSettings = { ...this.mapSettings, ...patch };
    const presetChanged = this.mapSettings.mapPreset !== prevPreset;
    const reliefChanged = Math.abs(this.mapSettings.terrainScale - prevRelief) > 0.001;
    if (presetChanged || reliefChanged) {
      this.worldEnv.rebuildTerrainHeights(this.mapSettings.terrainScale, this.mapSettings.mapPreset);
      const cf = this.getCampfirePos();
      const cfY = groundHeightAt(cf.x, cf.z);
      this.campfireVisuals.group.position.set(cf.x, cfY, cf.z);
      this.campfireLight.position.set(cf.x, cfY + 2.2, cf.z);

      if (presetChanged && this.gameState === 'TITLE_MENU') {
        const sp = this.getPlayerSpawnPos();
        this.px = sp.x;
        this.pz = sp.z;
        this.playerRig.root.position.x = sp.x;
        this.playerRig.root.position.z = sp.z;
        this.playerShadow.position.x = sp.x;
        this.playerShadow.position.z = sp.z;
      }

      const gy = groundHeightAt(this.px, this.pz);
      if (this.grounded) {
        this.py = gy;
        this.playerRig.root.position.y = gy;
        this.playerShadow.position.y = gy + 0.025;
      }
      this.placedProps.forEach((p) => {
        const m = this.placedPropMeshes.get(p.instanceId);
        if (m) m.position.y = groundHeightAt(p.x, p.z) + p.yOffset;
      });
      this.enemies.forEach((e) => {
        const ey = groundHeightAt(e.x, e.z);
        e.bundle.group.position.y = ey;
        e.shadow.position.y = ey + 0.025;
      });
      this.bloodDecals.forEach((d) => {
        if (d.active) {
          d.mesh.position.y = groundHeightAt(d.x, d.z);
        }
      });
      if (this.selectedPropId) {
        const sel = this.placedProps.find((p) => p.instanceId === this.selectedPropId);
        if (sel) this.syncSelectionRing(sel);
      }
    }
    this.applyMapSettingsVisuals();
    this.rebuildActiveColliders();
    this.updateDayNightAndFog(0);
    guardarMapSettingsLocal(this.mapSettings);
    this.emitHud();
  }

  private applyMapSettingsVisuals() {
    const isSandbox = this.mapSettings.mapPreset === 'custom_sandbox';
    this.worldEnv.citySurfaceObjects.forEach((o) => {
      o.visible = !isSandbox;
    });
    this.worldEnv.lampPoints.forEach((pt) => {
      pt.visible = !isSandbox;
    });
    this.worldEnv.ruinObjects.forEach((o) => {
      o.visible = !isSandbox && this.mapSettings.showDefaultRuins;
    });
    this.worldEnv.forestObjects.forEach((o) => {
      o.visible = !isSandbox && this.mapSettings.showDefaultForest;
    });

    const gMap = this.customGroundTex ?? (isSandbox ? this.simpleGroundTex : this.groundTex);
    gMap.repeat.set(this.mapSettings.groundRepeat, this.mapSettings.groundRepeat);
    gMap.needsUpdate = true;
    this.groundBumpTex.repeat.set(this.mapSettings.groundRepeat, this.mapSettings.groundRepeat);
    this.worldEnv.terrainMat.map = gMap;
    this.worldEnv.terrainMat.color.set(this.mapSettings.groundTint);
    this.worldEnv.terrainMat.roughness = this.mapSettings.groundRoughness;
    this.worldEnv.terrainMat.metalness = this.mapSettings.groundMetalness;
    this.worldEnv.terrainMat.needsUpdate = true;

    [this.worldEnv.barrierMat, this.worldEnv.rockMat].forEach((mat) => {
      if (this.customStoneTex) {
        mat.map = this.customStoneTex;
      } else {
        mat.map = this.stoneTex;
      }
      mat.roughness = this.mapSettings.stoneRoughness;
      mat.metalness = this.mapSettings.stoneMetalness;
      mat.color.set(this.mapSettings.stoneTint);
      mat.needsUpdate = true;
    });
    if (this.customStoneTex) {
      this.worldEnv.plazaMat.map = this.customStoneTex;
      this.worldEnv.pillarMat.map = this.customStoneTex;
    }
    this.worldEnv.plazaMat.roughness = this.mapSettings.stoneRoughness;
    this.worldEnv.plazaMat.needsUpdate = true;
    this.worldEnv.pillarMat.needsUpdate = true;

    const bMap = this.customBarkTex ?? this.barkTex;
    this.worldEnv.trunkMat.map = bMap;
    this.worldEnv.trunkMat.color.set(this.mapSettings.barkTint);
    this.worldEnv.trunkMat.roughness = this.mapSettings.barkRoughness;
    this.worldEnv.trunkMat.needsUpdate = true;
    this.worldEnv.crateMat.map = bMap;
    this.worldEnv.crateMat.needsUpdate = true;
  }

  public async loadCustomTextureFile(target: TextureTargetId, file: File): Promise<void> {
    this.modelError = null;
    try {
      const buffer = await file.arrayBuffer();
      await this.applyImportedTextureBuffer(target, buffer, file.name, file.type || 'image/png');
      await guardarTextureCache(target, buffer, file.name, file.type || 'image/png');
      if (target === 'ground') this.mapSettings.customGroundTexName = file.name;
      else if (target === 'stone') this.mapSettings.customStoneTexName = file.name;
      else this.mapSettings.customBarkTexName = file.name;
      guardarMapSettingsLocal(this.mapSettings);
      this.emitHud();
    } catch (err) {
      this.modelError =
        err instanceof Error ? `Textura inválida: ${err.message}` : 'No se pudo cargar la textura.';
      this.emitHud();
    }
  }

  public async resetCustomTexture(target: TextureTargetId): Promise<void> {
    await eliminarTextureCache(target);
    if (target === 'ground') {
      this.customGroundTex?.dispose();
      this.customGroundTex = null;
      this.mapSettings.customGroundTexName = null;
    } else if (target === 'stone') {
      this.customStoneTex?.dispose();
      this.customStoneTex = null;
      this.mapSettings.customStoneTexName = null;
    } else {
      this.customBarkTex?.dispose();
      this.customBarkTex = null;
      this.mapSettings.customBarkTexName = null;
    }
    this.applyMapSettingsVisuals();
    guardarMapSettingsLocal(this.mapSettings);
    this.emitHud();
  }

  private async applyImportedTextureBuffer(
    target: TextureTargetId,
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
  ): Promise<void> {
    const blob = new Blob([buffer], { type: mimeType || 'image/png' });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Imagen no compatible'));
        el.src = url;
      });
      const maxDim = 1024;
      const srcW = img.naturalWidth || img.width || 512;
      const srcH = img.naturalHeight || img.height || 512;
      let tex: THREE.Texture;
      if (srcW > maxDim || srcH > maxDim) {
        const scale = maxDim / Math.max(srcW, srcH);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(srcW * scale));
        canvas.height = Math.max(1, Math.round(srcH * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          tex = new THREE.CanvasTexture(canvas);
        } else {
          tex = new THREE.Texture(img);
        }
      } else {
        tex = new THREE.Texture(img);
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
      tex.needsUpdate = true;

      if (target === 'ground') {
        this.customGroundTex?.dispose();
        this.customGroundTex = tex;
        this.mapSettings.customGroundTexName = fileName;
      } else if (target === 'stone') {
        this.customStoneTex?.dispose();
        this.customStoneTex = tex;
        this.mapSettings.customStoneTexName = fileName;
      } else {
        this.customBarkTex?.dispose();
        this.customBarkTex = tex;
        this.mapSettings.customBarkTexName = fileName;
      }
      this.applyMapSettingsVisuals();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public setPostProcessSettings(patch: Partial<PostProcessSettings>) {
    this.postProcess = { ...this.postProcess, ...patch };
    this.applyPostProcessUniforms();
    guardarPostProcessLocal(this.postProcess);
    this.emitHud();
  }

  public applyPostProcessPreset(preset: PostProcessPreset) {
    this.postProcess = {
      ...this.postProcess,
      preset,
      ...POST_PROCESS_PRESETS[preset],
    };
    this.applyPostProcessUniforms();
    guardarPostProcessLocal(this.postProcess);
    this.emitHud();
  }

  public setCameraSettings(patch: Partial<CameraSettings>) {
    this.cameraSettings = { ...this.cameraSettings, ...patch };
    if (typeof patch.normalPitch === 'number') {
      this.camPitch = patch.normalPitch;
    }
    guardarCameraSettingsLocal(this.cameraSettings);
    this.emitHud();
  }

  public applyCameraPreset(preset: CameraPresetId) {
    this.cameraSettings = {
      preset,
      ...CAMERA_PRESETS[preset],
    };
    this.camPitch = this.cameraSettings.normalPitch;
    guardarCameraSettingsLocal(this.cameraSettings);
    this.emitHud();
  }

  public resetCameraSettings() {
    this.cameraSettings = { ...DEFAULT_CAMERA_SETTINGS };
    this.camPitch = this.cameraSettings.normalPitch;
    guardarCameraSettingsLocal(this.cameraSettings);
    this.emitHud();
  }

  public setCameraPreview(active: boolean, aim = false) {
    const entering = active && !this.cameraPreviewActive;
    this.cameraPreviewActive = active;
    this.cameraPreviewAim = active && aim;
    if (entering && this.gameState === 'TITLE_MENU') {
      this.camYaw = this.pyaw + Math.PI;
      this.camPitch = this.cameraSettings.normalPitch;
      this.camDistCurrent = this.cameraPreviewAim
        ? this.cameraSettings.aimDistance
        : this.cameraSettings.normalDistance;
      this.camShoulderOffset = this.cameraPreviewAim
        ? this.cameraSettings.aimShoulderOffset
        : this.cameraSettings.normalShoulderOffset;
      this.camPivotHeight = this.cameraPreviewAim
        ? this.cameraSettings.aimHeight
        : this.cameraSettings.normalHeight;
    }
    if (!active && this.gameState !== 'PLAYING') {
      this.camera.fov = this.cameraSettings.normalFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private applyPostProcessUniforms() {
    this.renderer.toneMappingExposure = this.postProcess.enabled
      ? this.postProcess.exposure
      : 1.16;
    if (this.bloomPass) {
      this.bloomPass.enabled = this.postProcess.enabled && this.postProcess.bloomEnabled;
      this.bloomPass.strength = this.postProcess.bloomStrength;
      this.bloomPass.threshold = this.postProcess.bloomThreshold;
    }
    if (this.gradePass) {
      this.gradePass.enabled = this.postProcess.enabled;
      const u = this.gradePass.uniforms;
      u.uVignette.value = this.postProcess.vignette;
      u.uChromatic.value = this.postProcess.chromaticAberration;
      u.uGrain.value = this.postProcess.filmGrain;
      u.uSaturation.value = this.postProcess.saturation;
      u.uContrast.value = this.postProcess.contrast;
    }
  }

  private requestPointerLockSafe() {
    try {
      if (document.pointerLockElement !== this.renderer.domElement) {
        void this.renderer.domElement.requestPointerLock?.();
      }
    } catch {
      // Fallback pointer-move orbit works seamlessly if pointer lock is disallowed
    }
  }

  private exitPointerLockSafe() {
    try {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  private handlePointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.hasLastPointer = false;
    this.emitHud();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    this.audio.unlock();
    const code = e.code;

    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    ) {
      if (this.gameState === 'PLAYING' || this.gameState === 'TITLE_MENU') {
        e.preventDefault();
      }
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      if (this.gameState === 'PLAYING') {
        this.pauseGame();
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      } else if (this.gameState === 'GAME_OVER' && code === 'Escape' && this.deathOrbitTimer > 1.2) {
        this.returnToTitle();
      }
      return;
    }

    if (this.gameState === 'TITLE_MENU' && (code === 'Enter' || code === 'Space')) {
      this.startNewRun();
      return;
    }

    if (
      this.gameState === 'GAME_OVER' &&
      this.deathOrbitTimer > 1.2 &&
      (code === 'Enter' || code === 'Space')
    ) {
      this.startNewRun();
      return;
    }

    if (this.gameState === 'PLAYING' && !this.editorMode) {
      if (!e.repeat) {
        if (code === 'Space') {
          this.jumpBufferTimer = 0.14;
        }
        if (code === 'KeyC' || code === 'ControlLeft' || code === 'KeyZ') {
          this.isCrouching = !this.isCrouching;
        }
        if (code === 'Digit1') {
          this.switchWeapon('pistol');
        }
        if (code === 'Digit2') {
          this.switchWeapon('rifle');
        }
        if (code === 'Digit3' || code === 'Digit0' || code === 'KeyX') {
          this.switchWeapon('unarmed');
        }
        if (code === 'KeyQ') {
          const next: WeaponKind =
            this.weapon === 'pistol'
              ? 'rifle'
              : this.weapon === 'rifle'
                ? 'unarmed'
                : 'pistol';
          this.switchWeapon(next);
        }
        if (code === 'KeyR') {
          this.startReload();
        }
        if (code === 'KeyE') {
          this.flareBufferTimer = 0.14;
        }
        if (code === 'KeyH') {
          this.useBandage();
        }
        if (code === 'KeyJ') {
          this.useFood();
        }
        if (code === 'KeyF') {
          this.centerCameraBehindPlayer();
        }
      }
      this.heldKeys.add(code);
    } else if (this.editorMode) {
      this.heldKeys.add(code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.clearVirtualControls();
    this.hasLastPointer = false;
    this.editorDragMode = 'none';
  };

  private clearVirtualControls() {
    this.fireHeld = false;
    this.aimHeld = false;
    this.virtualMoveX = 0;
    this.virtualMoveY = 0;
    this.virtualSprint = false;
    this.virtualFire = false;
    this.virtualAim = false;
    this.virtualCamVelYaw = 0;
    this.virtualCamVelPitch = 0;
    this.activeCamPointerId = null;
  }

  private getCanvasNdc(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  private handleEditorPointerDown(e: PointerEvent) {
    this.editorDragStart = { x: e.clientX, y: e.clientY };
    this.editorPointerMoved = false;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.hasLastPointer = true;

    if (e.button === 2 || e.shiftKey) {
      this.editorDragMode = 'orbit';
      return;
    }

    const ndc = this.getCanvasNdc(e.clientX, e.clientY);
    this.raycaster.setFromCamera(ndc, this.camera);
    const propRoots = Array.from(this.placedPropMeshes.values());
    const hits = propRoots.length > 0 ? this.raycaster.intersectObjects(propRoots, true) : [];
    if (hits.length > 0) {
      const hitId = hits[0].object.userData?.propInstanceId as string | undefined;
      if (hitId) {
        this.selectPlacedProp(hitId);
        this.editorDragMode = 'move';
        return;
      }
    }
    this.editorDragMode = 'orbit';
  }

  private handleEditorPointerMove(e: PointerEvent) {
    if (this.editorDragMode === 'none') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (Math.hypot(e.clientX - this.editorDragStart.x, e.clientY - this.editorDragStart.y) > 5) {
      this.editorPointerMoved = true;
    }

    if (this.editorDragMode === 'move' && this.selectedPropId) {
      const ndc = this.getCanvasNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(ndc, this.camera);
      const tHit = this.raycaster.intersectObject(this.worldEnv.terrain, false);
      if (tHit.length > 0) {
        const pt = tHit[0].point;
        const clampedR = Math.hypot(pt.x, pt.z);
        const maxR = ARENA_PLAYABLE_RADIUS + 10;
        const nx = clampedR > maxR ? (pt.x / clampedR) * maxR : pt.x;
        const nz = clampedR > maxR ? (pt.z / clampedR) * maxR : pt.z;
        this.updatePlacedProp(this.selectedPropId, {
          x: Number(nx.toFixed(2)),
          z: Number(nz.toFixed(2)),
        });
      }
    } else if (this.editorDragMode === 'orbit') {
      this.editorYaw -= dx * 0.007;
      this.editorPitch = THREE.MathUtils.clamp(this.editorPitch + dy * 0.006, 0.22, 1.38);
    }
  }

  private handleEditorPointerUp(e: PointerEvent) {
    if (this.editorDragMode === 'orbit' && !this.editorPointerMoved && e.button === 0 && this.activePlacementSlotId) {
      const ndc = this.getCanvasNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(ndc, this.camera);
      const tHit = this.raycaster.intersectObject(this.worldEnv.terrain, false);
      if (tHit.length > 0) {
        this.placeWorldPropAt(this.activePlacementSlotId, tHit[0].point.x, tHit[0].point.z);
      }
    }
    this.editorDragMode = 'none';
  }

  private handleWheel = (e: WheelEvent) => {
    if (!this.editorMode) return;
    e.preventDefault();
    this.editorDist = THREE.MathUtils.clamp(this.editorDist + e.deltaY * 0.02, 7, 56);
  };

  private handlePointerMove = (e: PointerEvent) => {
    this.lastPointerType = e.pointerType || 'mouse';

    if (this.editorMode) {
      this.handleEditorPointerMove(e);
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    const sensitivity = this.isAiming ? 0.0017 : 0.0026;
    if (e.pointerType !== 'mouse') {
      if (this.activeCamPointerId !== e.pointerId) return;
      if (this.hasLastPointer) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.rotateCameraBy(-dx * sensitivity * 1.6, dy * sensitivity * 1.45);
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.hasLastPointer = true;
      return;
    }

    if (this.pointerLocked) {
      this.rotateCameraBy(-e.movementX * sensitivity, e.movementY * sensitivity);
    } else {
      if (this.hasLastPointer) {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.rotateCameraBy(-dx * sensitivity * 1.15, dy * sensitivity * 1.15);
      }
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.hasLastPointer = true;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    this.lastPointerType = e.pointerType || 'mouse';
    if (this.editorMode) {
      this.handleEditorPointerDown(e);
      return;
    }
    if (this.gameState !== 'PLAYING') return;

    if (e.pointerType === 'mouse') {
      this.requestPointerLockSafe();
      if (e.button === 0) {
        this.fireHeld = true;
      } else if (e.button === 2) {
        this.aimHeld = true;
      }
    } else {
      // On touch devices, dragging the 3D viewport rotates the camera without triggering fire
      if (this.activeCamPointerId === null) {
        this.activeCamPointerId = e.pointerId;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.hasLastPointer = true;
      }
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.editorMode) {
      this.handleEditorPointerUp(e);
      return;
    }
    if (e.pointerType === 'mouse') {
      if (e.button === 0) this.fireHeld = false;
      if (e.button === 2) this.aimHeld = false;
    }
    if (this.activeCamPointerId === e.pointerId) {
      this.activeCamPointerId = null;
      this.hasLastPointer = false;
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    if (this.gameState === 'PLAYING' || this.editorMode) {
      e.preventDefault();
    }
  };

  private handleResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
  }



  public setVirtualMove(x: number, y: number, sprint?: boolean) {
    this.virtualMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.virtualMoveY = THREE.MathUtils.clamp(y, -1, 1);
    if (typeof sprint === 'boolean') {
      this.virtualSprint = sprint;
    }
  }

  public setVirtualCameraVelocity(yawVel: number, pitchVel: number) {
    this.virtualCamVelYaw = yawVel;
    this.virtualCamVelPitch = pitchVel;
  }

  public rotateCameraBy(deltaYaw: number, deltaPitch: number) {
    if (this.gameState !== 'PLAYING') return;
    if (Math.abs(deltaYaw) > 0.0004 || Math.abs(deltaPitch) > 0.0004) {
      this.manualCameraCooldown = 0.65;
      this.recenterCamTimer = 0;
    }
    this.camYaw += deltaYaw;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + deltaPitch, -0.36, 0.78);
  }

  public centerCameraBehindPlayer() {
    if (this.gameState !== 'PLAYING') return;
    this.recenterCamTimer = 0.28;
    this.manualCameraCooldown = 0;
  }

  public setVirtualFire(active: boolean) {
    this.audio.unlock();
    this.virtualFire = active;
  }

  public setVirtualAim(active: boolean) {
    this.audio.unlock();
    this.virtualAim = active;
    this.emitHud();
  }

  public triggerJump() {
    this.audio.unlock();
    if (this.gameState === 'PLAYING') {
      this.jumpBufferTimer = 0.14;
    }
  }

  public toggleCrouch() {
    this.audio.unlock();
    if (this.gameState === 'PLAYING') {
      this.isCrouching = !this.isCrouching;
      this.emitHud();
    }
  }

  public triggerReload() {
    this.audio.unlock();
    if (this.gameState === 'PLAYING') {
      this.startReload();
    }
  }

  public triggerGrenade() {
    this.audio.unlock();
    if (this.gameState === 'PLAYING') {
      this.flareBufferTimer = 0.14;
    }
  }

  public cycleWeapon() {
    this.audio.unlock();
    if (this.gameState === 'PLAYING') {
      const next: WeaponKind =
        this.weapon === 'pistol'
          ? 'rifle'
          : this.weapon === 'rifle'
            ? 'unarmed'
            : 'pistol';
      this.switchWeapon(next);
    }
  }

  public setDifficulty(diff: DifficultyId) {
    this.difficulty = diff;
    this.emitHud();
  }

  public toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.emitHud();
  }

  private getTargetZombieCount(): number {
    const active = this.getActiveZombieSlots();
    if (active.length > 0) {
      return active.reduce((sum, s) => sum + Math.max(0, Math.min(25, s.spawnCount ?? 4)), 0);
    }
    return this.difficulty === 'pilgrim' ? 9 : this.difficulty === 'warden' ? 12 : 16;
  }

  private pickRandomKind(): EnemyKind {
    const r = Math.random();
    if (r < 0.14) return 'brute';
    if (r < 0.36) return 'spitter';
    return 'stalker';
  }

  public startNewRun() {
    this.audio.unlock();
    this.clearDynamicEntities();
    this.editorMode = false;
    this.worldEnv.editorGrid.visible = false;
    this.selectionRing.visible = false;

    const sp = this.getPlayerSpawnPos();
    this.px = sp.x;
    this.pz = sp.z;
    this.py = groundHeightAt(this.px, this.pz);
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.pyaw = Math.PI;
    this.camYaw = 0;
    this.camPitch = this.cameraSettings.normalPitch;
    this.camDistCurrent = this.cameraSettings.normalDistance;
    this.camShoulderOffset = this.cameraSettings.normalShoulderOffset;
    this.camPivotHeight = this.cameraSettings.normalHeight;
    this.camera.fov = this.cameraSettings.normalFov;
    this.camera.updateProjectionMatrix();
    this.cameraPreviewActive = false;
    this.cameraPreviewAim = false;
    this.manualCameraCooldown = 0;
    this.recenterCamTimer = 0;
    this.grounded = true;
    this.jumpWindupTimer = 0;
    this.isCrouching = false;
    this.crouchFactor = 0;
    this.stance = 'idle';
    this.camera.position.set(
      this.px + this.cameraSettings.normalShoulderOffset,
      this.py + this.cameraSettings.normalHeight + Math.sin(this.camPitch) * this.camDistCurrent,
      this.pz + Math.cos(this.camPitch) * this.camDistCurrent,
    );

    this.weapon = 'rifle';
    this.pistolAmmo = this.pistolMaxAmmo;
    this.pistolReserveAmmo = 30;
    this.rifleAmmo = this.rifleMaxAmmo;
    this.rifleReserveAmmo = 60;
    this.bandages = 1;
    this.food = 1;
    this.reloadTimer = 0;
    this.isAiming = false;
    this.syncWeaponVisibility();

    this.maxHp = this.difficulty === 'pilgrim' ? 125 : this.difficulty === 'warden' ? 100 : 85;
    this.hp = this.maxHp;
    this.flareCharge = 50;
    this.wood = 0;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.survivalTime = 0;
    this.kills = 0;
    this.campfireWarmth = 100;
    this.respawnTimer = 2.4;
    this.invulnTimer = 0;
    this.strikeCooldown = 0;
    this.hurtFlashTimer = 0;
    this.recoilTimer = 0;
    this.meleeTimer = 0;
    this.deathAnimTimer = 0;
    this.deathOrbitTimer = 0;
    this.squashY = 1;
    this.shakeTrauma = 0;
    this.hitstopTimer = 0;
    this.flareWaveTimer = 0;
    this.flareWaveMesh.visible = false;
    this.muzzleFlashTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.resetPlayerPoseTransforms();

    this.worldEnv.harvestNodes.forEach((n) => {
      n.hp = n.maxHp;
      n.respawnTimer = 0;
      n.group.visible = true;
      n.group.scale.setScalar(1);
    });

    this.gameState = 'PLAYING';
    this.requestPointerLockSafe();

    // Populate roaming zombies & scatter initial survival loot across the sector
    const initialCount = this.getTargetZombieCount();
    for (let i = 0; i < initialCount; i++) {
      this.spawnEnemyForActivePopulation(false);
    }
    this.spawnInitialSurvivalLoot();

    this.emitHud();
  }

  public pauseGame() {
    if (this.gameState !== 'PLAYING') return;
    this.heldKeys.clear();
    this.clearVirtualControls();
    this.exitPointerLockSafe();
    this.gameState = 'PAUSED';
    this.emitHud();
  }

  public resumeGame() {
    if (this.gameState !== 'PAUSED') return;
    this.editorMode = false;
    this.cameraPreviewActive = false;
    this.cameraPreviewAim = false;
    this.selectionRing.visible = false;
    this.gameState = 'PLAYING';
    this.lastTimestamp = performance.now();
    this.requestPointerLockSafe();
    this.emitHud();
  }

  public returnToTitle() {
    this.clearDynamicEntities();
    this.heldKeys.clear();
    this.clearVirtualControls();
    this.exitPointerLockSafe();
    this.editorMode = false;
    this.worldEnv.editorGrid.visible = false;
    this.cameraPreviewActive = false;
    this.cameraPreviewAim = false;
    this.selectionRing.visible = false;
    const sp = this.getPlayerSpawnPos();
    this.px = sp.x;
    this.pz = sp.z;
    this.py = groundHeightAt(this.px, this.pz);
    this.pyaw = Math.PI;
    this.jumpWindupTimer = 0;
    this.isCrouching = false;
    this.crouchFactor = 0;
    this.isAiming = false;
    this.reloadTimer = 0;
    this.hurtFlashTimer = 0;
    this.recoilTimer = 0;
    this.meleeTimer = 0;
    this.deathAnimTimer = 0;
    this.deathOrbitTimer = 0;
    this.squashY = 1;
    this.flareWaveTimer = 0;
    this.flareWaveMesh.visible = false;
    this.muzzleFlashTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.weapon = 'rifle';
    this.syncWeaponVisibility();
    this.resetPlayerPoseTransforms();
    this.playerRig.root.position.set(this.px, this.py, this.pz);
    this.playerRig.root.rotation.y = this.pyaw;
    this.gameState = 'TITLE_MENU';
    this.emitHud();
  }

  private resetPlayerPoseTransforms() {
    this.playerRig.resetClips?.();
    this.playerRig.root.scale.set(1, 1, 1);
    this.playerRig.bodyPivot.position.set(0, 0, 0);
    this.playerRig.bodyPivot.rotation.set(0, 0, 0);
    if (this.playerRig.bones.hips) {
      this.playerRig.bones.hips.node.position.copy(this.playerRig.bones.hips.restPos);
    }
  }

  private clearDynamicEntities() {
    this.enemies.forEach((e) => {
      this.scene.remove(e.bundle.group, e.shadow);
      Object.values(e.stumpMeshes).forEach((s) => s?.dispose());
      e.bundle.dispose();
    });
    this.enemies = [];

    this.dyingEnemies.forEach((d) => {
      this.scene.remove(d.bundle.group, d.shadow);
      Object.values(d.stumpMeshes).forEach((s) => s?.dispose());
      d.bundle.dispose();
    });
    this.dyingEnemies = [];

    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.projectiles = [];

    this.pickups.forEach((p) => {
      this.scene.remove(p.mesh);
      p.disposeMesh?.();
    });
    this.pickups = [];

    for (let i = 0; i < MAX_BLOOD_PARTICLES; i++) {
      this.bloodParticles[i].active = false;
      _mat4.makeScale(0, 0, 0);
      this.bloodInst.setMatrixAt(i, _mat4);
    }
    this.bloodInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.bloodDecals.length; i++) {
      this.bloodDecals[i].active = false;
      this.bloodDecals[i].mesh.visible = false;
    }

    this.severedLimbChunks.forEach((c) => {
      this.scene.remove(c.group);
      c.dispose();
    });
    this.severedLimbChunks = [];
  }

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private isCurrentlyDaytime(): boolean {
    return this.mapSettings.timeOfDay >= 0.25 && this.mapSettings.timeOfDay <= 0.75;
  }

  private formatClockFromTimeOfDay(t: number): string {
    const totalMins = Math.floor(((t % 1) + 1) % 1 * 24 * 60);
    const hrs = Math.floor(totalMins / 60) % 24;
    const mins = totalMins % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private updateDayNightAndFog(dt: number) {
    if (this.mapSettings.dayNightEnabled && this.gameState === 'PLAYING' && !this.editorMode) {
      this.mapSettings.timeOfDay =
        (this.mapSettings.timeOfDay + dt * 0.0048 * this.mapSettings.cycleSpeed) % 1;
    }

    const t = this.mapSettings.timeOfDay;
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sunSin = Math.sin(sunAngle);
    const sunCos = Math.cos(sunAngle);
    const dayFactor = THREE.MathUtils.clamp((sunSin + 0.14) / 0.44, 0, 1);
    const twilight = Math.max(0, 1 - Math.abs(sunSin) * 3.8);

    _cSkyCol.copy(_cNightSky).lerp(_cDaySky, dayFactor).lerp(_cDuskSky, twilight * 0.48);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_cSkyCol);
    }
    _cSkyMatTint.copy(_cSkyMatDark).lerp(_cSkyMatWhite, dayFactor * 0.85 + twilight * 0.2);
    this.worldEnv.skyMat.color.copy(_cSkyMatTint);
    this.worldEnv.starMat.opacity = (1 - dayFactor) * 0.78;

    const orbitDist = 104;
    this.worldEnv.sunDisc.position.set(sunCos * orbitDist, sunSin * orbitDist, 28);
    this.worldEnv.sunDisc.lookAt(0, 0, 0);
    this.worldEnv.sunDisc.visible = sunSin > -0.18;
    this.worldEnv.sunHalo.position.set(sunCos * (orbitDist - 1), sunSin * (orbitDist - 1), 27.6);
    this.worldEnv.sunHalo.lookAt(0, 0, 0);
    this.worldEnv.sunHalo.visible = sunSin > -0.18;

    this.worldEnv.moonMesh.position.set(-sunCos * orbitDist, -sunSin * orbitDist, -28);
    this.worldEnv.moonMesh.lookAt(0, 0, 0);
    this.worldEnv.moonMesh.visible = -sunSin > -0.18;
    this.worldEnv.moonHalo.position.set(-sunCos * (orbitDist - 1), -sunSin * (orbitDist - 1), -27.6);
    this.worldEnv.moonHalo.lookAt(0, 0, 0);
    this.worldEnv.moonHalo.visible = -sunSin > -0.18;

    _cLightCol.copy(_cLightNight).lerp(_cLightDay, dayFactor).lerp(_cLightDusk, twilight * 0.55);
    this.sunLight.color.copy(_cLightCol);
    this.sunLight.intensity = 0.92 + dayFactor * 1.28;
    this.rimLight.intensity = 0.35 + twilight * 0.35;

    this.hemiLight.color.setHex(0x6d8fc2).lerp(_cHemiDay, dayFactor);
    this.hemiLight.groundColor.setHex(0x1b2029).lerp(_cHemiGround, dayFactor);
    this.hemiLight.intensity = 0.66 + dayFactor * 0.64;

    const nightLampScale = 1 - dayFactor * 0.85;
    this.worldEnv.lampGlowMat.emissiveIntensity = 0.3 + nightLampScale * 2.1;
    this.worldEnv.lampPoints.forEach((pt) => {
      pt.intensity = 2.6 * nightLampScale;
    });
    this.worldEnv.nightGlowMats.forEach((ng) => {
      ng.mat.emissiveIntensity = THREE.MathUtils.lerp(
        ng.nightIntensity,
        ng.dayIntensity,
        dayFactor,
      );
    });

    if (this.scene.fog instanceof THREE.FogExp2) {
      _cFogCol.copy(_cFogNight).lerp(_cFogDay, dayFactor).lerp(_cFogDusk, twilight * 0.42);
      this.scene.fog.color.copy(_cFogCol);

      const wave = this.mapSettings.fogDynamic
        ? 0.82 + 0.22 * Math.sin(this.elapsed * 0.19) + 0.12 * Math.cos(this.elapsed * 0.083)
        : 1.0;
      const baseTimeDensity = 0.0125 - dayFactor * 0.006 + twilight * 0.002;
      const density = THREE.MathUtils.clamp(
        baseTimeDensity * this.mapSettings.fogDensity * wave,
        0.001,
        0.055,
      );
      this.scene.fog.density = density;
      this.currentFogLevel = density;
    }
  }

  private updateEditorCamera(dt: number) {
    let panFwd = 0;
    let panRight = 0;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) panFwd += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) panFwd -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) panRight += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) panRight -= 1;

    if (panFwd !== 0 || panRight !== 0) {
      const spd = 18 * dt;
      const fx = -Math.sin(this.editorYaw);
      const fz = -Math.cos(this.editorYaw);
      const rx = Math.cos(this.editorYaw);
      const rz = -Math.sin(this.editorYaw);
      this.editorTarget.x = THREE.MathUtils.clamp(
        this.editorTarget.x + (fx * panFwd + rx * panRight) * spd,
        -ARENA_PLAYABLE_RADIUS,
        ARENA_PLAYABLE_RADIUS,
      );
      this.editorTarget.z = THREE.MathUtils.clamp(
        this.editorTarget.z + (fz * panFwd + rz * panRight) * spd,
        -ARENA_PLAYABLE_RADIUS,
        ARENA_PLAYABLE_RADIUS,
      );
      this.editorTarget.y = groundHeightAt(this.editorTarget.x, this.editorTarget.z);
    }

    const horiz = Math.cos(this.editorPitch) * this.editorDist;
    const vert = Math.sin(this.editorPitch) * this.editorDist;
    const cx = this.editorTarget.x + Math.sin(this.editorYaw) * horiz;
    const cz = this.editorTarget.z + Math.cos(this.editorYaw) * horiz;
    const cy = Math.max(groundHeightAt(cx, cz) + 1.5, this.editorTarget.y + vert);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.editorTarget.x, this.editorTarget.y + 0.6, this.editorTarget.z);
  }

  private tick() {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.elapsed += dt;
    this.updateDayNightAndFog(dt);
    this.updateCampfireAndParticles(dt);

    if (this.editorMode) {
      this.updateEditorCamera(dt);
      this.selectionRing.rotation.z += dt * 1.4;
    } else if (this.gameState === 'TITLE_MENU') {
      if (this.cameraPreviewActive) {
        this.aimPoint.set(
          this.px + Math.sin(this.pyaw) * 18,
          this.py + this.cameraSettings.aimHeight,
          this.pz + Math.cos(this.pyaw) * 18,
        );
        this.updateFreeCamera(dt);
        this.updatePlayerAnimation(dt, 0, false);
      } else {
        this.updateTitleCamera(dt);
        this.updatePlayerAnimation(dt, 0, false);
      }
    } else if (this.gameState === 'PLAYING') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
        this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);
      } else {
        this.updatePlaying(dt);
      }
      this.updateBloodParticles(dt);
      this.updateBloodDecals(dt);
      this.updateSeveredLimbs(dt);
    } else if (this.gameState === 'GAME_OVER') {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.5);
      if (this.hurtFlashTimer > 0) {
        this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt * 0.85);
        this.hudSyncTimer -= dt;
        if (this.hudSyncTimer <= 0) {
          this.hudSyncTimer = 0.04;
          this.emitHud();
        }
      }
      this.updateEffects(dt);
      this.updateDyingEnemies(dt);
      this.updateBloodParticles(dt);
      this.updateBloodDecals(dt);
      this.updateSeveredLimbs(dt);
      this.animatePlayerDeath(dt);
    } else {
      this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 2.5);
      if (this.cameraPreviewActive) {
        this.aimPoint.set(
          this.px - Math.sin(this.camYaw) * 18,
          this.py + this.cameraSettings.aimHeight - Math.sin(this.camPitch) * 12,
          this.pz - Math.cos(this.camYaw) * 18,
        );
        this.updateFreeCamera(dt);
        this.updatePlayerAnimation(dt, 0, false);
      }
    }

    if (this.gradePass) {
      this.gradePass.uniforms.uTime.value = this.elapsed;
    }
    if (!this.isSoftwareGl && this.postProcess.enabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    }
    this.scheduleNextFrame();
  }

  private updateTitleCamera(dt: number) {
    this.titleOrbitAngle += dt * 0.13;
    const isSandbox = this.mapSettings.mapPreset === 'custom_sandbox';
    const camR = isSandbox ? 14.0 : 19.5;
    const targetX = Math.sin(this.titleOrbitAngle) * camR;
    const targetZ = Math.cos(this.titleOrbitAngle) * camR;
    this.camera.position.set(targetX, isSandbox ? 5.2 : 6.8, targetZ);
    this.camera.lookAt(0, isSandbox ? 1.8 : 5.2, isSandbox ? 0.5 : 0.8);
    this.aimReticle.visible = false;
  }

  private updateCampfireAndParticles(dt: number) {
    const flicker =
      1 + Math.sin(this.elapsed * 11) * 0.08 + Math.cos(this.elapsed * 17.3) * 0.06;
    const warmthScale = 0.65 + (this.campfireWarmth / 100) * 0.55;
    this.campfireLight.intensity = 6.6 * flicker * warmthScale;
    this.campfireVisuals.flameOuter.scale.set(
      warmthScale,
      warmthScale * flicker,
      warmthScale,
    );
    this.campfireVisuals.flameInner.scale.set(
      warmthScale,
      warmthScale * (2 - flicker * 0.8),
      warmthScale,
    );
    this.campfireVisuals.flameOuter.rotation.y += dt * 1.8;

    this.ambientEmberTimer -= dt;
    if (this.ambientEmberTimer <= 0) {
      this.ambientEmberTimer = 0.14;
      const cf = this.getCampfirePos();
      this.spawnParticle(
        cf.x + (Math.random() - 0.5) * 0.8,
        groundHeightAt(cf.x, cf.z) + 1.6,
        cf.z + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.6,
        1.7 + Math.random() * 1.4,
        (Math.random() - 0.5) * 0.6,
        0.9 + Math.random() * 0.6,
        0.85,
        -0.4,
        1.0,
        0.52 + Math.random() * 0.35,
        0.1,
      );
    }

    let anyActive = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.particleInst.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.maxLife;
      const s = p.size * t;
      _vec3.set(p.x, p.y, p.z);
      _euler.set(p.life * 4, p.life * 6, 0);
      _quat.setFromEuler(_euler);
      _scale.set(s, s, s);
      _mat4.compose(_vec3, _quat, _scale);
      this.particleInst.setMatrixAt(i, _mat4);
      _color.setRGB(p.r, p.g, p.b);
      this.particleInst.setColorAt(i, _color);
    }
    if (anyActive) {
      this.particleInst.instanceMatrix.needsUpdate = true;
      if (this.particleInst.instanceColor) this.particleInst.instanceColor.needsUpdate = true;
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    gravity: number,
    r: number,
    g: number,
    b: number,
  ) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.life = life;
        p.maxLife = life;
        p.size = size;
        p.gravity = gravity;
        p.r = r;
        p.g = g;
        p.b = b;
        return;
      }
    }
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    r: number,
    g: number,
    b: number,
    speed = 6,
  ) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.spawnParticle(
        x,
        y,
        z,
        Math.cos(a) * spd,
        2.2 + Math.random() * 3.8,
        Math.sin(a) * spd,
        0.35 + Math.random() * 0.35,
        0.9 + Math.random() * 0.7,
        11.0,
        r,
        g,
        b,
      );
    }
  }

  private spawnBloodDroplet(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    size: number,
    splatChance: number,
    isSpitter = false,
  ) {
    for (let i = 0; i < MAX_BLOOD_PARTICLES; i++) {
      const p = this.bloodParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.life = 0.65 + Math.random() * 0.55;
        p.maxLife = p.life;
        p.size = size;
        p.splatted = false;
        p.splatChance = splatChance;
        if (isSpitter) {
          p.r = 0.28 + Math.random() * 0.14;
          p.g = 0.48 + Math.random() * 0.18;
          p.b = 0.08;
        } else {
          const shade = 0.72 + Math.random() * 0.42;
          p.r = 0.56 * shade;
          p.g = 0.025 * shade;
          p.b = 0.035 * shade;
        }
        return;
      }
    }
  }

  private spawnBloodSpray(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    count: number,
    speed: number,
    spread: number,
    splatChance = 0.34,
    isSpitter = false,
  ) {
    const dirLen = Math.hypot(dirX, dirY, dirZ);
    const nx = dirLen > 0.001 ? dirX / dirLen : 0;
    const ny = dirLen > 0.001 ? dirY / dirLen : 0.6;
    const nz = dirLen > 0.001 ? dirZ / dirLen : 1;

    for (let i = 0; i < count; i++) {
      const spd = speed * (0.42 + Math.random() * 0.92);
      const vx = (nx + (Math.random() - 0.5) * spread * 2.15) * spd;
      const vy = (ny + (Math.random() - 0.25) * spread * 1.55) * spd + 1.2 + Math.random() * 2.3;
      const vz = (nz + (Math.random() - 0.5) * spread * 2.15) * spd;
      this.spawnBloodDroplet(
        x + (Math.random() - 0.5) * 0.06,
        y + (Math.random() - 0.5) * 0.06,
        z + (Math.random() - 0.5) * 0.06,
        vx,
        vy,
        vz,
        0.52 + Math.random() * 0.62,
        splatChance,
        isSpitter,
      );
    }
  }

  private spawnBloodDecal(
    x: number,
    z: number,
    targetRadius: number,
    maxOpacity = 0.9,
    expandDuration = 1.1,
    duration = 48,
    isSpitter = false,
  ) {
    if (this.bloodDecals.length === 0) return;

    let slot: BloodDecal | null = null;
    let oldestActive = this.bloodDecals[0];
    for (let i = 0; i < this.bloodDecals.length; i++) {
      const candidate = this.bloodDecals[i];
      if (!candidate.active) {
        slot = candidate;
        break;
      }
      if (candidate.age > oldestActive.age) {
        oldestActive = candidate;
      }
    }
    if (!slot) slot = oldestActive;

    const textures = getBloodPuddleTextures();
    const tex = textures[Math.floor(Math.random() * textures.length)];
    const rotY = Math.random() * Math.PI * 2;
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const centerY = groundHeightAt(x, z);
    const size = targetRadius * 2;

    const posAttr = slot.geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      const lx = slot.baseXZ[i * 2] * size;
      const lz = slot.baseXZ[i * 2 + 1] * size;
      const wx = x + (lx * cosR + lz * sinR);
      const wz = z + (-lx * sinR + lz * cosR);
      posAttr.setXYZ(i, lx, groundHeightAt(wx, wz) + 0.024 - centerY, lz);
    }
    posAttr.needsUpdate = true;
    slot.geo.computeVertexNormals();
    slot.geo.computeBoundingSphere();

    slot.mat.map = tex;
    slot.mat.color.setHex(isSpitter ? 0x6f8f34 : 0xffffff);
    slot.mat.opacity = maxOpacity * 0.4;

    slot.mesh.position.set(x, centerY, z);
    slot.mesh.rotation.y = rotY;
    slot.mesh.scale.set(0.32, 1, 0.32);
    slot.mesh.visible = true;

    slot.active = true;
    slot.x = x;
    slot.z = z;
    slot.age = 0;
    slot.duration = duration;
    slot.expandDuration = Math.max(0.08, expandDuration);
    slot.maxOpacity = maxOpacity;
  }

  private updateBloodParticles(dt: number) {
    let anyDirty = false;
    for (let i = 0; i < MAX_BLOOD_PARTICLES; i++) {
      const p = this.bloodParticles[i];
      if (!p.active) continue;
      anyDirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4.makeScale(0, 0, 0);
        this.bloodInst.setMatrixAt(i, _mat4);
        continue;
      }

      if (!p.splatted) {
        p.vy -= 19.5 * dt;
        const drag = Math.exp(-1.75 * dt);
        p.vx *= drag;
        p.vz *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;

        const gy = groundHeightAt(p.x, p.z);
        if (p.y <= gy + 0.02) {
          p.y = gy + 0.02;
          p.splatted = true;
          p.life = Math.min(p.life, 0.14);
          p.maxLife = 0.14;
          if (Math.random() < p.splatChance) {
            this.spawnBloodDecal(
              p.x,
              p.z,
              0.11 + Math.random() * 0.14,
              0.78,
              0.1,
              28,
              p.g > 0.25,
            );
          }
        }
      }

      if (p.splatted) {
        const t = Math.max(0, p.life / p.maxLife);
        const s = p.size * (1.1 + (1 - t) * 0.55);
        _vec3.set(p.x, p.y, p.z);
        _quat.identity();
        _scale.set(s * 1.35, Math.max(0.06, s * 0.16 * t), s * 1.35);
        _mat4.compose(_vec3, _quat, _scale);
      } else {
        const speed = Math.hypot(p.vx, p.vy, p.vz);
        _vec3.set(p.x, p.y, p.z);
        if (speed > 0.05) {
          _vec3B.set(p.vx / speed, p.vy / speed, p.vz / speed);
          _quat.setFromUnitVectors(_worldUp, _vec3B);
        } else {
          _quat.identity();
        }
        const t = Math.max(0.25, p.life / p.maxLife);
        const radiusScale = p.size * (0.5 + t * 0.45);
        const stretch = radiusScale * (1.05 + Math.min(3.1, speed * 0.22));
        _scale.set(radiusScale * 0.6, stretch, radiusScale * 0.6);
        _mat4.compose(_vec3, _quat, _scale);
      }

      this.bloodInst.setMatrixAt(i, _mat4);
      _color.setRGB(p.r, p.g, p.b);
      this.bloodInst.setColorAt(i, _color);
    }

    if (anyDirty) {
      this.bloodInst.instanceMatrix.needsUpdate = true;
      if (this.bloodInst.instanceColor) this.bloodInst.instanceColor.needsUpdate = true;
    }
  }

  private updateBloodDecals(dt: number) {
    const fadeDuration = 5.0;
    for (let i = 0; i < this.bloodDecals.length; i++) {
      const d = this.bloodDecals[i];
      if (!d.active) continue;
      d.age += dt;

      if (d.age >= d.duration) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }

      if (d.age < d.expandDuration) {
        const p = d.age / d.expandDuration;
        const ease = 1 - Math.pow(1 - p, 2.2);
        const sc = 0.32 + 0.68 * ease;
        d.mesh.scale.set(sc, 1, sc);
        d.mat.opacity = d.maxOpacity * (0.45 + 0.55 * ease);
      } else if (d.age >= d.duration - fadeDuration) {
        d.mesh.scale.set(1, 1, 1);
        const remain = Math.max(0, d.duration - d.age) / fadeDuration;
        d.mat.opacity = d.maxOpacity * remain;
      } else {
        d.mesh.scale.set(1, 1, 1);
        d.mat.opacity = d.maxOpacity;
      }
    }
  }

  private updateSeveredLimbs(dt: number) {
    for (let i = this.severedLimbChunks.length - 1; i >= 0; i--) {
      const c = this.severedLimbChunks[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.scene.remove(c.group);
        c.dispose();
        this.severedLimbChunks.splice(i, 1);
        continue;
      }

      if (!c.grounded) {
        c.vy -= 20.5 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.z += c.vz * dt;
        c.rx += c.vrx * dt;
        c.ry += c.vry * dt;
        c.rz += c.vrz * dt;

        if (c.bleedTimer > 0 && Math.random() < 0.7) {
          c.bleedTimer -= dt;
          this.spawnBloodDroplet(
            c.x,
            c.y,
            c.z,
            c.vx * 0.25 + (Math.random() - 0.5) * 1.5,
            c.vy * 0.25 + (Math.random() - 0.5) * 1.3,
            c.vz * 0.25 + (Math.random() - 0.5) * 1.5,
            0.55,
            0.3,
          );
        }

        const gy = groundHeightAt(c.x, c.z) + 0.11;
        if (c.y <= gy) {
          c.y = gy;
          if (Math.abs(c.vy) > 2.4) {
            c.vy = -c.vy * 0.34;
            c.vx *= 0.52;
            c.vz *= 0.52;
            c.vrx *= 0.48;
            c.vry *= 0.48;
            c.vrz *= 0.48;
            this.spawnBloodDecal(c.x, c.z, 0.44 + Math.random() * 0.22, 0.85, 0.22, 34);
          } else {
            c.vy = 0;
            c.vx = 0;
            c.vz = 0;
            c.grounded = true;
            this.spawnBloodDecal(c.x, c.z, 0.56 + Math.random() * 0.2, 0.88, 0.35, 38);
          }
        }

        c.group.position.set(c.x, c.y, c.z);
        c.group.rotation.set(c.rx, c.ry, c.rz);
      } else if (c.life < 1.5) {
        const fade = Math.max(0.01, c.life / 1.5);
        c.group.scale.setScalar(fade);
      }
    }
  }

  private updatePlaying(dt: number) {
    this.survivalTime += dt;
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.flareBufferTimer = Math.max(0, this.flareBufferTimer - dt);
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.hurtFlashTimer = Math.max(0, this.hurtFlashTimer - dt);
    this.recoilTimer = Math.max(0, this.recoilTimer - dt);
    this.meleeTimer = Math.max(0, this.meleeTimer - dt);
    this.manualCameraCooldown = Math.max(0, this.manualCameraCooldown - dt);
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.9);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        if (this.weapon === 'pistol' && this.pistolReserveAmmo > 0) {
          const needed = this.pistolMaxAmmo - this.pistolAmmo;
          const take = Math.min(needed, this.pistolReserveAmmo);
          this.pistolAmmo += take;
          this.pistolReserveAmmo -= take;
        } else if (this.weapon === 'rifle' && this.rifleReserveAmmo > 0) {
          const needed = this.rifleMaxAmmo - this.rifleAmmo;
          const take = Math.min(needed, this.rifleReserveAmmo);
          this.rifleAmmo += take;
          this.rifleReserveAmmo -= take;
        }
      }
    }

    // Continuous camera rotation from mobile touch camera buttons
    if (this.virtualCamVelYaw !== 0 || this.virtualCamVelPitch !== 0) {
      const rate = this.isAiming ? 1.55 : 2.35;
      this.rotateCameraBy(this.virtualCamVelYaw * rate * dt, this.virtualCamVelPitch * rate * dt);
    }

    // 1. Camera-relative WASD + Virtual Mobile Movement input
    let forwardIn = this.virtualMoveY;
    let rightIn = this.virtualMoveX;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) forwardIn += 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) forwardIn -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) rightIn += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) rightIn -= 1;

    forwardIn = THREE.MathUtils.clamp(forwardIn, -1, 1);
    rightIn = THREE.MathUtils.clamp(rightIn, -1, 1);
    const inputMag = Math.min(1, Math.hypot(forwardIn, rightIn));

    const fwdX = -Math.sin(this.camYaw);
    const fwdZ = -Math.cos(this.camYaw);
    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    let moveX = fwdX * forwardIn + rightX * rightIn;
    let moveZ = fwdZ * forwardIn + rightZ * rightIn;
    const moveLen = Math.hypot(moveX, moveZ);
    if (moveLen > 0) {
      moveX = (moveX / moveLen) * inputMag;
      moveZ = (moveZ / moveLen) * inputMag;
    }

    const aimActiveInput = this.aimHeld || this.virtualAim || this.heldKeys.has('KeyV');
    const sprintHeld =
      (this.heldKeys.has('ShiftLeft') ||
        this.heldKeys.has('ShiftRight') ||
        this.virtualSprint) &&
      inputMag > 0.15 &&
      !aimActiveInput;
    if (sprintHeld && this.isCrouching) {
      this.isCrouching = false;
    }

    this.isAiming = aimActiveInput;
    this.crouchFactor = THREE.MathUtils.damp(
      this.crouchFactor,
      this.isCrouching ? 1 : 0,
      14,
      dt,
    );

    const unarmedBonus = this.weapon === 'unarmed' ? 0.6 : 0;
    const moveSpeed = this.isCrouching
      ? 2.85 + unarmedBonus * 0.55
      : sprintHeld
        ? 9.2 + unarmedBonus
        : this.isAiming
          ? 4.0
          : 5.5 + unarmedBonus;

    const targetVx = moveX * moveSpeed;
    const targetVz = moveZ * moveSpeed;
    const accel = 1 - Math.exp(-(this.grounded ? 15 : 6) * dt);
    this.pvx += (targetVx - this.pvx) * accel;
    this.pvz += (targetVz - this.pvz) * accel;

    this.px += this.pvx * dt;
    this.pz += this.pvz * dt;

    // Colliders & playable radius
    const cfPos = this.getCampfirePos();
    const campDx = this.px - cfPos.x;
    const campDz = this.pz - cfPos.z;
    const campDist = Math.hypot(campDx, campDz);
    if (campDist < 1.35 && campDist > 0.001) {
      this.px = cfPos.x + (campDx / campDist) * 1.35;
      this.pz = cfPos.z + (campDz / campDist) * 1.35;
    }
    for (let i = 0; i < this.worldEnv.colliders.length; i++) {
      const c = this.worldEnv.colliders[i];
      const dx = this.px - c.x;
      const dz = this.pz - c.z;
      const dist = Math.hypot(dx, dz);
      const minD = c.radius + 0.55;
      if (dist < minD && dist > 0.001) {
        this.px = c.x + (dx / dist) * minD;
        this.pz = c.z + (dz / dist) * minD;
      }
    }
    const r = Math.hypot(this.px, this.pz);
    if (r > ARENA_PLAYABLE_RADIUS) {
      this.px = (this.px / r) * ARENA_PLAYABLE_RADIUS;
      this.pz = (this.pz / r) * ARENA_PLAYABLE_RADIUS;
    }

    // 2. Jump Impulse Anticipation & Vertical Physics
    const groundY = groundHeightAt(this.px, this.pz);
    if (this.grounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && this.jumpWindupTimer <= 0) {
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.isCrouching = false;
      this.jumpWindupTimer = this.jumpWindupDuration;
      this.squashY = 0.86;
    }

    if (this.jumpWindupTimer > 0) {
      this.jumpWindupTimer -= dt;
      if (this.jumpWindupTimer <= 0) {
        this.jumpWindupTimer = 0;
        this.grounded = false;
        this.pvy = 8.1;
        this.pvx *= 1.07;
        this.pvz *= 1.07;
        this.squashY = 1.18;
        this.audio.playJump();
        this.spawnBurst(this.px, groundY + 0.1, this.pz, 6, 0.7, 0.72, 0.76, 3.2);
      }
    }

    if (!this.grounded) {
      this.pvy -= 21.0 * dt;
      this.py += this.pvy * dt;
      if (this.py <= groundY) {
        this.py = groundY;
        this.pvy = 0;
        this.grounded = true;
        this.squashY = 0.78;
      }
    } else {
      this.py = groundY;
    }

    const horizSpeed = Math.hypot(this.pvx, this.pvz);
    if (!this.grounded) this.stance = 'jump';
    else if (this.isCrouching) this.stance = 'crouch';
    else if (sprintHeld && horizSpeed > 5.8) this.stance = 'run';
    else if (horizSpeed > 0.6) this.stance = 'walk';
    else this.stance = 'idle';

    this.playerRig.root.position.set(this.px, this.py, this.pz);
    this.playerShadow.position.set(this.px, groundY + 0.025, this.pz);
    const heightAboveGround = Math.max(0, this.py - groundY);
    this.playerShadow.scale.setScalar(Math.max(0.45, 1 - heightAboveGround * 0.18));

    // 3. Free Over-the-Shoulder Camera Update BEFORE raycasting crosshair
    this.updateFreeCamera(dt);

    // 4. Raycast exact 3D aim point directly under the center crosshair (prioritizing zombie limbs)
    this.raycaster.setFromCamera(_vec3B.set(0, 0, 0) as unknown as THREE.Vector2, this.camera);
    const ray = this.raycaster.ray;
    _aimPlane.constant = -groundY;
    if (ray.intersectPlane(_aimPlane, _rayHit)) {
      const distToHit = _rayHit.distanceTo(this.camera.position);
      if (distToHit > 2.5 && distToHit < 45) {
        this.aimPoint.copy(_rayHit);
        this.aimPoint.y += 0.9;
      } else {
        this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, 26);
      }
    } else {
      this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, 26);
    }

    let bestAimT = 44;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const roughDist = Math.hypot(e.x - this.px, e.z - this.pz);
      if (roughDist > 42) continue;
      const ey = groundHeightAt(e.x, e.z);
      _vec3.set(e.x, ey + 1.0, e.z);
      const approxPerpSq = ray.distanceSqToPoint(_vec3);
      if (approxPerpSq > (e.radius + 1.5) * (e.radius + 1.5)) continue;

      const vols = this.getEnemyLimbHitVolumes(e);
      for (let v = 0; v < vols.length; v++) {
        const vol = vols[v];
        _vec3.set(vol.x, vol.y, vol.z);
        const effR = vol.radius * 1.15;
        const dSq = ray.distanceSqToPoint(_vec3);
        if (dSq <= effR * effR) {
          const projT = _vec3B.copy(_vec3).sub(ray.origin).dot(ray.direction);
          if (projT > 1.0 && projT < bestAimT) {
            bestAimT = projT;
            this.aimPoint.copy(ray.origin).addScaledVector(ray.direction, projT);
          }
        }
      }
    }

    const aimYaw = Math.atan2(this.aimPoint.x - this.px, this.aimPoint.z - this.pz);
    const isFiring = this.fireHeld || this.virtualFire;

    // Body orientation: faces aim when aiming/firing, or movement direction when free-running
    const targetBodyYaw =
      this.isAiming || isFiring || this.recoilTimer > 0
        ? aimYaw
        : horizSpeed > 0.5
          ? Math.atan2(this.pvx, this.pvz)
          : aimYaw;
    const bodyDiff = Math.atan2(
      Math.sin(targetBodyYaw - this.pyaw),
      Math.cos(targetBodyYaw - this.pyaw),
    );
    this.pyaw += bodyDiff * (1 - Math.exp(-14 * dt));
    this.playerRig.root.rotation.y = this.pyaw;

    // Chase-cam alignment: gently follows behind the player while moving unless manually orbiting or backpedaling
    if (this.recenterCamTimer > 0) {
      this.recenterCamTimer = Math.max(0, this.recenterCamTimer - dt);
      const behindYaw = this.pyaw + Math.PI;
      const err = Math.atan2(Math.sin(behindYaw - this.camYaw), Math.cos(behindYaw - this.camYaw));
      this.camYaw += err * (1 - Math.exp(-12 * dt));
      this.camPitch = THREE.MathUtils.damp(this.camPitch, this.cameraSettings.normalPitch, 9, dt);
    } else if (
      !this.isAiming &&
      !isFiring &&
      this.manualCameraCooldown <= 0 &&
      horizSpeed > 0.7 &&
      forwardIn >= -0.15
    ) {
      const behindYaw = this.pyaw + Math.PI;
      const yawErr = Math.atan2(
        Math.sin(behindYaw - this.camYaw),
        Math.cos(behindYaw - this.camYaw),
      );
      const followLambda = sprintHeld
        ? 3.6 + Math.abs(rightIn) * 2.2
        : 2.4 + Math.abs(rightIn) * 1.8;
      this.camYaw += yawErr * (1 - Math.exp(-followLambda * dt));
    }

    // Head tracking: smoothly rotates toward where the camera aims
    const rawHeadYaw = Math.atan2(Math.sin(aimYaw - this.pyaw), Math.cos(aimYaw - this.pyaw));
    const targetHeadYaw = THREE.MathUtils.clamp(rawHeadYaw, -1.05, 1.05);
    const targetHeadPitch = THREE.MathUtils.clamp(-this.camPitch * 0.85, -0.55, 0.55);
    this.headYawOffset = THREE.MathUtils.damp(this.headYawOffset, targetHeadYaw, 15, dt);
    this.headPitchOffset = THREE.MathUtils.damp(this.headPitchOffset, targetHeadPitch, 15, dt);

    // 5. Shoot Pistol / Rifle or Silent Melee when Unarmed
    if (isFiring && this.strikeCooldown <= 0 && this.reloadTimer <= 0) {
      if (this.weapon === 'unarmed') {
        this.performUnarmedStrike();
      } else {
        this.fireEquippedWeapon();
      }
    }

    // 6. Thermobaric Grenade
    if (this.flareBufferTimer > 0 && this.flareCharge >= 100) {
      this.flareBufferTimer = 0;
      this.triggerThermobaricGrenade();
    }

    // 7. Central Burn Barrel safe zone healing & recharge
    const distToCamp = Math.hypot(this.px - cfPos.x, this.pz - cfPos.z);
    const nearCamp = distToCamp <= CAMPFIRE_SAFE_RADIUS;
    if (nearCamp) {
      this.flareCharge = Math.min(100, this.flareCharge + dt * 6.5);
      this.hp = Math.min(this.maxHp, this.hp + dt * 2.5);
      if (this.wood > 0 && distToCamp <= 3.0) {
        const spent = this.wood;
        this.wood = 0;
        this.hp = Math.min(this.maxHp, this.hp + spent * 10);
        this.campfireWarmth = Math.min(100, this.campfireWarmth + spent * 18);
        this.score += spent * 120;
        this.audio.playStoke();
        this.spawnBurst(
          cfPos.x,
          groundHeightAt(cfPos.x, cfPos.z) + 1.5,
          cfPos.z,
          16,
          1.0,
          0.72,
          0.16,
          7,
        );
      }
    } else {
      this.campfireWarmth = Math.max(25, this.campfireWarmth - dt * 1.1);
    }

    this.updatePlayerAnimation(dt, horizSpeed, sprintHeld);
    this.updateEffects(dt);
    this.updateHarvestNodes(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateEnemies(dt);
    this.updateDyingEnemies(dt);
    this.updateSurvivalPopulation(dt);

    this.hudSyncTimer -= dt;
    const targetHudInterval = this.hurtFlashTimer > 0 ? 0.025 : 0.05;
    if (this.hudSyncTimer <= 0) {
      this.hudSyncTimer = targetHudInterval;
      this.emitHud();
    }
  }

  private performUnarmedStrike() {
    this.strikeCooldown = 0.42;
    this.meleeTimer = 0.24;
    this.meleeHandSign *= -1;
    this.audio.playChop();

    const fwdX = Math.sin(this.pyaw);
    const fwdZ = Math.cos(this.pyaw);
    let landed = false;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - this.px;
      const dz = e.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist <= e.radius + 1.55 && dist > 0.001) {
        const dot = (dx / dist) * fwdX + (dz / dist) * fwdZ;
        if (dot > 0.3) {
          this.damageEnemy(e, 18, (dx / dist) * 11, (dz / dist) * 11);
          landed = true;
        }
      }
    }

    if (!landed) {
      for (let k = 0; k < this.worldEnv.harvestNodes.length; k++) {
        const n = this.worldEnv.harvestNodes[k];
        if (n.hp > 0 && Math.hypot(n.x - this.px, n.z - this.pz) <= 2.0) {
          this.damageSupplyNode(n, 18);
          break;
        }
      }
    }
  }

  private fireEquippedWeapon() {
    if (this.weapon === 'pistol') {
      if (this.pistolAmmo <= 0) {
        this.startReload();
        return;
      }
      this.pistolAmmo -= 1;
      this.strikeCooldown = 0.23;
      this.audio.playPistolShot();
      if (this.pistolAmmo === 0) this.startReload();
    } else if (this.weapon === 'rifle') {
      if (this.rifleAmmo <= 0) {
        this.startReload();
        return;
      }
      this.rifleAmmo -= 1;
      this.strikeCooldown = 0.12;
      this.audio.playRifleShot();
      if (this.rifleAmmo === 0) this.startReload();
    } else {
      return;
    }

    this.recoilTimer = 0.12;
    this.shakeTrauma = Math.min(0.4, this.shakeTrauma + (this.weapon === 'pistol' ? 0.1 : 0.08));

    this.playerRig.root.updateMatrixWorld(true);
    const muzzleObj =
      this.weapon === 'rifle' ? this.playerRig.rifleMuzzle : this.playerRig.pistolMuzzle;
    muzzleObj.getWorldPosition(_vec3);
    const muzzleX = Number.isFinite(_vec3.x) ? _vec3.x : this.px + Math.sin(this.pyaw) * 0.85;
    const muzzleY = Number.isFinite(_vec3.y)
      ? _vec3.y
      : this.py + (1.32 - this.crouchFactor * 0.42);
    const muzzleZ = Number.isFinite(_vec3.z) ? _vec3.z : this.pz + Math.cos(this.pyaw) * 0.85;

    this.muzzleFlashTimer = 0.05;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.position.set(muzzleX, muzzleY, muzzleZ);
    this.muzzleFlashMesh.scale.setScalar(this.weapon === 'rifle' ? 1.15 : 0.85);
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;

    const dx = this.aimPoint.x - muzzleX;
    const dy = this.aimPoint.y - muzzleY;
    const dz = this.aimPoint.z - muzzleZ;
    const len = Math.max(0.001, Math.hypot(dx, dy, dz));
    const dirX = dx / len;
    const dirY = dy / len;
    const dirZ = dz / len;

    const bulletDmg = this.weapon === 'pistol' ? 30 : 24;
    const boltSpeed = this.weapon === 'rifle' ? 48 : 40;
    const spreadBase = this.isAiming ? 0.008 : 0.036;
    const baseYaw = Math.atan2(dirX, dirZ);
    const jitter = (Math.random() - 0.5) * spreadBase;
    const yaw = baseYaw + jitter;
    const horizSpeed = Math.hypot(dirX, dirZ);

    this.spawnProjectile(
      true,
      muzzleX,
      muzzleY,
      muzzleZ,
      Math.sin(yaw) * horizSpeed * boltSpeed,
      dirY * boltSpeed,
      Math.cos(yaw) * horizSpeed * boltSpeed,
      bulletDmg,
      0.95,
      0.34,
      yaw,
    );

    // Gunshot alerts nearby zombies (FAL is much louder than pistol; wakes resting daytime zombies too)
    this.alertNearbyZombies(this.weapon === 'pistol' ? 9.0 : 18.0);
  }

  private triggerZombieSpotAnim(e: EnemyEntity) {
    const clipDur = e.bundle.clips?.['habilidad1']?.getClip().duration ?? 0.9;
    e.alertTimer = Math.max(e.alertTimer, THREE.MathUtils.clamp(clipDur * 0.9, 0.72, 1.35));
  }

  private alertNearbyZombies(radius: number) {
    const outerRadius = radius * 1.65;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const dist = Math.hypot(e.x - this.px, e.z - this.pz);
      if ((e.state === 'wander' || e.state === 'investigate') && dist <= radius) {
        e.state = 'chase';
        e.provoked = true;
        e.suspicion = 1;
        e.aggroTimer = 6.5;
        e.squash = 1.1;
        this.triggerZombieSpotAnim(e);
      } else if (e.state === 'wander' && dist <= outerRadius) {
        e.state = 'investigate';
        e.suspicion = Math.max(e.suspicion, 0.6);
        e.investigateX = this.px;
        e.investigateZ = this.pz;
        e.investigateTimer = 4.2;
      }
    }
  }

  private triggerThermobaricGrenade() {
    this.flareCharge = 0;
    const radius = 9.0;
    const damage = 85;

    this.audio.playFlare();
    this.hitstopTimer = 0.058;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.78);
    this.invulnTimer = Math.max(this.invulnTimer, 0.45);

    const groundY = groundHeightAt(this.px, this.pz);
    this.flareWaveTimer = 0.4;
    this.flareWaveMesh.visible = true;
    this.flareWaveMesh.position.set(this.px, groundY + 0.2, this.pz);
    this.flareWaveMesh.scale.setScalar(1);
    (this.flareWaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;

    this.spawnBurst(this.px, groundY + 0.8, this.pz, 40, 1.0, 0.56, 0.14, 14);
    this.alertNearbyZombies(21.0);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dx = e.x - this.px;
      const dz = e.z - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const nz = dist > 0.01 ? dz / dist : 0;
        this.damageEnemy(e, damage, nx * 16, nz * 16);
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.fromPlayer && Math.hypot(p.x - this.px, p.z - this.pz) <= radius) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private spawnProjectile(
    fromPlayer: boolean,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    damage: number,
    life: number,
    radius: number,
    yaw = 0,
  ) {
    const mesh = new THREE.Mesh(
      fromPlayer ? this.playerBoltGeo : this.enemyBoltGeo,
      fromPlayer ? this.playerBoltMat : this.enemyBoltMat,
    );
    if (fromPlayer) {
      const trail = new THREE.Mesh(this.playerBoltTrailGeo, this.playerBoltTrailMat);
      mesh.add(trail);
    }
    mesh.position.set(x, y, z);
    if (Math.hypot(vx, vy, vz) > 0.001) {
      mesh.lookAt(x + vx, y + vy, z + vz);
    } else {
      mesh.rotation.y = yaw;
    }
    this.scene.add(mesh);
    this.projectiles.push({
      active: true,
      fromPlayer,
      x,
      y,
      z,
      prevX: x,
      prevY: y,
      prevZ: z,
      vx,
      vy,
      vz,
      damage,
      life,
      radius,
      mesh,
    });
  }

  private spawnInitialSurvivalLoot() {
    const spots: { kind: LootKind; x: number; z: number }[] = [
      { kind: 'bandage', x: -4.2, z: 8.8 },
      { kind: 'food', x: 4.5, z: -7.5 },
      { kind: 'fal_ammo', x: -6.8, z: 0.4 },
      { kind: 'pistol_ammo', x: 6.8, z: 0.6 },
      { kind: 'bandage', x: -16.2, z: -12.8 },
      { kind: 'fal_ammo', x: 16.5, z: -12.5 },
      { kind: 'food', x: -17.2, z: 13.8 },
      { kind: 'pistol_ammo', x: 17.0, z: 13.5 },
      { kind: 'fal_ammo', x: 0, z: -22.5 },
      { kind: 'bandage', x: -24.5, z: 1.5 },
    ];
    spots.forEach((s) => this.spawnPickup(s.kind, s.x, s.z));
  }

  private pickRandomSurvivalLootKind(): Exclude<LootKind, 'ember' | 'wood'> {
    const r = Math.random();
    if (r < 0.28) return 'fal_ammo';
    if (r < 0.54) return 'pistol_ammo';
    if (r < 0.79) return 'bandage';
    return 'food';
  }

  private spawnPickup(kind: LootKind, x: number, z: number) {
    let mesh: THREE.Object3D;
    let disposeMesh: (() => void) | undefined;
    if (kind === 'ember') {
      const m = new THREE.Mesh(this.emberGeo, this.emberMat);
      m.castShadow = true;
      mesh = m;
    } else if (kind === 'wood') {
      const m = new THREE.Mesh(this.woodGeo, this.woodMat);
      m.castShadow = true;
      mesh = m;
    } else {
      const built = buildLootMeshGroup(kind);
      mesh = built.group;
      disposeMesh = built.dispose;
    }
    const y = groundHeightAt(x, z) + 0.5;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.pickups.push({
      active: true,
      kind,
      x,
      y,
      z,
      vy: 3.5,
      life: kind === 'ember' || kind === 'wood' ? 24 : 45,
      mesh,
      disposeMesh,
    });
  }

  private pickWanderTarget(fromX: number, fromZ: number): { x: number; z: number } {
    const cf = this.getCampfirePos();
    for (let attempt = 0; attempt < 20; attempt++) {
      // Roam freely along active arena sector
      const a = Math.random() * Math.PI * 2;
      const r = 13.5 + Math.random() * (ARENA_PLAYABLE_RADIUS - 16.0);
      const tx = Math.cos(a) * r;
      const tz = Math.sin(a) * r;
      if (Math.hypot(tx - fromX, tz - fromZ) < 5.0) continue;
      if (Math.hypot(tx - cf.x, tz - cf.z) < 4.5) continue;
      const blocked = this.worldEnv.colliders.some(
        (c) => Math.hypot(c.x - tx, c.z - tz) < c.radius + 1.35,
      );
      if (!blocked) {
        return { x: tx, z: tz };
      }
    }
    const fallbackAngle = Math.atan2(fromZ, fromX) || Math.PI / 4;
    const fr = 24.0;
    return { x: Math.cos(fallbackAngle) * fr, z: Math.sin(fallbackAngle) * fr };
  }

  private spawnEnemy(kind: EnemyKind, onPerimeter = true, preferredSlotId?: string) {
    let x = 21;
    let z = 22;
    const cf = this.getCampfirePos();
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = onPerimeter
        ? ARENA_PLAYABLE_RADIUS - 2.0 - Math.random() * 6.0
        : 17.5 + Math.random() * (ARENA_PLAYABLE_RADIUS - 20.0);
      const cx = Math.cos(angle) * dist;
      const cz = Math.sin(angle) * dist;
      if (Math.hypot(cx - this.px, cz - this.pz) < 12.5) continue;
      if (Math.hypot(cx - cf.x, cz - cf.z) < 6.0) continue;
      const blocked = this.worldEnv.colliders.some(
        (c) => Math.hypot(c.x - cx, c.z - cz) < c.radius + 1.35,
      );
      if (!blocked) {
        x = cx;
        z = cz;
        break;
      }
    }

    const diffScale =
      this.difficulty === 'pilgrim' ? 0.85 : this.difficulty === 'warden' ? 1.0 : 1.25;

    const enemyId = this.nextEnemyId++;
    let chosenSlotId = preferredSlotId;
    let chosenTemplate =
      chosenSlotId && this.customZombieTemplates.has(chosenSlotId)
        ? (this.customZombieTemplates.get(chosenSlotId) ?? null)
        : null;
    if (!chosenTemplate) {
      const picked = this.pickCustomZombieSlotAndTemplate(kind, enemyId);
      chosenSlotId = picked.slotId;
      chosenTemplate = picked.template;
    }

    const bundle = buildEnemyMesh(kind, chosenTemplate);
    bundle.group.position.set(x, groundHeightAt(x, z), z);
    this.scene.add(bundle.group);

    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    const shadowScale = kind === 'brute' ? 1.65 : 1.0;
    shadow.scale.setScalar(shadowScale);
    shadow.position.set(x, groundHeightAt(x, z) + 0.025, z);
    this.scene.add(shadow);

    const stats =
      kind === 'brute'
        ? { hp: 130, speed: 2.35, radius: 1.05, damage: 24, score: 240 }
        : kind === 'spitter'
          ? { hp: 52, speed: 2.85, radius: 0.7, damage: 14, score: 140 }
          : { hp: 44, speed: 3.55, radius: 0.65, damage: 14, score: 100 };

    const maxHp = Math.round(stats.hp * diffScale);
    const wanderTarget = this.pickWanderTarget(x, z);
    const initialYaw = Math.atan2(wanderTarget.x - x, wanderTarget.z - z);

    const walkStyle: 'orco' | 'inestable' =
      kind === 'brute' ? 'orco' : ((enemyId ^ (enemyId >> 1)) & 1) === 0 ? 'orco' : 'inestable';
    const gaitSpeedMult = walkStyle === 'orco' ? 0.86 : 0.96;

    this.enemies.push({
      id: enemyId,
      kind,
      x,
      z,
      vx: 0,
      vz: 0,
      yaw: initialYaw,
      hp: maxHp,
      maxHp,
      speed: stats.speed * gaitSpeedMult,
      radius: stats.radius,
      damage: Math.round(stats.damage * diffScale),
      scoreValue: stats.score,
      state: 'wander',
      stateTimer: 0,
      attackDuration: 0.46,
      hasHitThisAttack: false,
      attackCooldown: 0.5 + Math.random() * 0.5,
      wanderX: wanderTarget.x,
      wanderZ: wanderTarget.z,
      wanderWait: Math.random() * 1.4,
      investigateX: wanderTarget.x,
      investigateZ: wanderTarget.z,
      investigateTimer: 0,
      suspicion: 0,
      aggroTimer: 0,
      alertTimer: 0,
      provoked: false,
      walkStyle,
      lungeDx: 0,
      lungeDz: 0,
      hitFlashTimer: 0,
      squash: 1,
      walkPhase: Math.random() * 6.28,
      customSlotId: chosenSlotId,
      limbHits: {
        head: 0,
        leftShoulder: 0,
        leftElbow: 0,
        rightShoulder: 0,
        rightElbow: 0,
        leftHip: 0,
        leftKnee: 0,
        rightHip: 0,
        rightKnee: 0,
      },
      severedLimbs: new Set<LimbId>(),
      bleedTimers: {
        head: 0,
        leftShoulder: 0,
        leftElbow: 0,
        rightShoulder: 0,
        rightElbow: 0,
        leftHip: 0,
        leftKnee: 0,
        rightHip: 0,
        rightKnee: 0,
      },
      stumpMeshes: {},
      crawlFactor: 0,
      bundle,
      shadow,
    });
  }

  private enemyHasLegLoss(e: EnemyEntity): boolean {
    return (
      e.severedLimbs.has('leftKnee') ||
      e.severedLimbs.has('leftHip') ||
      e.severedLimbs.has('rightKnee') ||
      e.severedLimbs.has('rightHip')
    );
  }

  private getEnemyLimbBoneNode(bundle: EnemyMeshBundle, limb: LimbId): THREE.Object3D | null {
    const b = bundle.bones;
    switch (limb) {
      case 'head':
        return b.head?.node ?? null;
      case 'leftShoulder':
        return b.leftArm?.node ?? null;
      case 'leftElbow':
        return b.leftForeArm?.node ?? null;
      case 'rightShoulder':
        return b.rightArm?.node ?? null;
      case 'rightElbow':
        return b.rightForeArm?.node ?? null;
      case 'leftHip':
        return b.leftUpLeg?.node ?? null;
      case 'leftKnee':
        return b.leftLeg?.node ?? null;
      case 'rightHip':
        return b.rightUpLeg?.node ?? null;
      case 'rightKnee':
        return b.rightLeg?.node ?? null;
    }
  }

  private getEnemyLimbHitVolumes(e: EnemyEntity): LimbHitVolume[] {
    const ey = groundHeightAt(e.x, e.z);
    const scaleH = e.kind === 'brute' ? 1.38 : e.kind === 'spitter' ? 1.05 : 1.0;
    const scaleW = e.kind === 'brute' ? 1.48 : e.kind === 'spitter' ? 1.12 : 1.0;
    const cf = e.crawlFactor;
    const crawlDrop = cf * 0.72;
    const cosY = Math.cos(e.yaw);
    const sinY = Math.sin(e.yaw);
    const rx = -cosY;
    const rz = sinY;
    const fwdShift = cf * 0.55;

    const volumes: LimbHitVolume[] = [];
    const { bones } = e.bundle;
    e.bundle.group.updateMatrixWorld(true);

    if (!e.severedLimbs.has('head')) {
      if (bones.head) {
        bones.head.node.getWorldPosition(_vec3);
        volumes.push({
          limb: 'head',
          x: _vec3.x,
          y: _vec3.y + 0.1 * scaleH,
          z: _vec3.z,
          radius: 0.26 * scaleW,
        });
      } else {
        volumes.push({
          limb: 'head',
          x: e.x + sinY * fwdShift,
          y: ey + 1.58 * scaleH - crawlDrop * 1.15,
          z: e.z + cosY * fwdShift,
          radius: 0.26 * scaleW,
        });
      }
    }

    // Left Arm: Shoulder (upper arm) & Elbow (forearm/hand)
    if (!e.severedLimbs.has('leftShoulder')) {
      if (bones.leftArm && bones.leftForeArm) {
        bones.leftArm.node.getWorldPosition(_vec3);
        bones.leftForeArm.node.getWorldPosition(_vec3B);
        volumes.push({
          limb: 'leftShoulder',
          x: _vec3.x * 0.58 + _vec3B.x * 0.42,
          y: _vec3.y * 0.58 + _vec3B.y * 0.42,
          z: _vec3.z * 0.58 + _vec3B.z * 0.42,
          radius: 0.21 * scaleW,
        });
      } else {
        volumes.push({
          limb: 'leftShoulder',
          x: e.x - rx * 0.34 * scaleW + sinY * fwdShift * 0.7,
          y: ey + 1.24 * scaleH - crawlDrop,
          z: e.z - rz * 0.34 * scaleW + cosY * fwdShift * 0.7,
          radius: 0.21 * scaleW,
        });
      }

      if (!e.severedLimbs.has('leftElbow')) {
        if (bones.leftForeArm) {
          bones.leftForeArm.node.getWorldPosition(_vec3);
          if (bones.leftHand) {
            bones.leftHand.getWorldPosition(_vec3B);
            volumes.push({
              limb: 'leftElbow',
              x: (_vec3.x + _vec3B.x) * 0.5,
              y: (_vec3.y + _vec3B.y) * 0.5,
              z: (_vec3.z + _vec3B.z) * 0.5,
              radius: 0.21 * scaleW,
            });
          } else {
            volumes.push({
              limb: 'leftElbow',
              x: _vec3.x + sinY * 0.1 * scaleW,
              y: _vec3.y - 0.14 * scaleH * (1 - cf * 0.65),
              z: _vec3.z + cosY * 0.1 * scaleW,
              radius: 0.21 * scaleW,
            });
          }
        } else {
          volumes.push({
            limb: 'leftElbow',
            x: e.x - rx * 0.36 * scaleW + sinY * (0.2 + fwdShift),
            y: ey + 0.96 * scaleH - crawlDrop * 0.95,
            z: e.z - rz * 0.36 * scaleW + cosY * (0.2 + fwdShift),
            radius: 0.21 * scaleW,
          });
        }
      }
    }

    // Right Arm: Shoulder (upper arm) & Elbow (forearm/hand)
    if (!e.severedLimbs.has('rightShoulder')) {
      if (bones.rightArm && bones.rightForeArm) {
        bones.rightArm.node.getWorldPosition(_vec3);
        bones.rightForeArm.node.getWorldPosition(_vec3B);
        volumes.push({
          limb: 'rightShoulder',
          x: _vec3.x * 0.58 + _vec3B.x * 0.42,
          y: _vec3.y * 0.58 + _vec3B.y * 0.42,
          z: _vec3.z * 0.58 + _vec3B.z * 0.42,
          radius: 0.21 * scaleW,
        });
      } else {
        volumes.push({
          limb: 'rightShoulder',
          x: e.x + rx * 0.34 * scaleW + sinY * fwdShift * 0.7,
          y: ey + 1.24 * scaleH - crawlDrop,
          z: e.z + rz * 0.34 * scaleW + cosY * fwdShift * 0.7,
          radius: 0.21 * scaleW,
        });
      }

      if (!e.severedLimbs.has('rightElbow')) {
        if (bones.rightForeArm) {
          bones.rightForeArm.node.getWorldPosition(_vec3);
          if (bones.rightHand) {
            bones.rightHand.getWorldPosition(_vec3B);
            volumes.push({
              limb: 'rightElbow',
              x: (_vec3.x + _vec3B.x) * 0.5,
              y: (_vec3.y + _vec3B.y) * 0.5,
              z: (_vec3.z + _vec3B.z) * 0.5,
              radius: 0.21 * scaleW,
            });
          } else {
            volumes.push({
              limb: 'rightElbow',
              x: _vec3.x + sinY * 0.1 * scaleW,
              y: _vec3.y - 0.14 * scaleH * (1 - cf * 0.65),
              z: _vec3.z + cosY * 0.1 * scaleW,
              radius: 0.21 * scaleW,
            });
          }
        } else {
          volumes.push({
            limb: 'rightElbow',
            x: e.x + rx * 0.36 * scaleW + sinY * (0.2 + fwdShift),
            y: ey + 0.96 * scaleH - crawlDrop * 0.95,
            z: e.z + rz * 0.36 * scaleW + cosY * (0.2 + fwdShift),
            radius: 0.21 * scaleW,
          });
        }
      }
    }

    // Left Leg: Hip (thigh) & Knee (shin/foot)
    if (!e.severedLimbs.has('leftHip')) {
      if (bones.leftUpLeg && bones.leftLeg) {
        bones.leftUpLeg.node.getWorldPosition(_vec3);
        bones.leftLeg.node.getWorldPosition(_vec3B);
        volumes.push({
          limb: 'leftHip',
          x: (_vec3.x + _vec3B.x) * 0.5,
          y: (_vec3.y + _vec3B.y) * 0.5,
          z: (_vec3.z + _vec3B.z) * 0.5,
          radius: 0.23 * scaleW,
        });
      } else if (bones.leftUpLeg) {
        bones.leftUpLeg.node.getWorldPosition(_vec3);
        volumes.push({
          limb: 'leftHip',
          x: _vec3.x,
          y: _vec3.y - 0.16 * scaleH,
          z: _vec3.z,
          radius: 0.23 * scaleW,
        });
      } else {
        volumes.push({
          limb: 'leftHip',
          x: e.x - rx * 0.18 * scaleW,
          y: ey + 0.64 * scaleH - crawlDrop * 0.4,
          z: e.z - rz * 0.18 * scaleW,
          radius: 0.23 * scaleW,
        });
      }

      if (!e.severedLimbs.has('leftKnee')) {
        if (bones.leftLeg) {
          bones.leftLeg.node.getWorldPosition(_vec3);
          if (bones.leftFoot) {
            bones.leftFoot.node.getWorldPosition(_vec3B);
            volumes.push({
              limb: 'leftKnee',
              x: (_vec3.x + _vec3B.x) * 0.5,
              y: (_vec3.y + _vec3B.y) * 0.5,
              z: (_vec3.z + _vec3B.z) * 0.5,
              radius: 0.22 * scaleW,
            });
          } else {
            volumes.push({
              limb: 'leftKnee',
              x: _vec3.x - sinY * cf * 0.16,
              y: _vec3.y - 0.18 * scaleH * (1 - cf * 0.7),
              z: _vec3.z - cosY * cf * 0.16,
              radius: 0.22 * scaleW,
            });
          }
        } else {
          volumes.push({
            limb: 'leftKnee',
            x: e.x - rx * 0.18 * scaleW - sinY * cf * 0.35,
            y: ey + 0.28 * scaleH * (1 - cf * 0.45),
            z: e.z - rz * 0.18 * scaleW - cosY * cf * 0.35,
            radius: 0.22 * scaleW,
          });
        }
      }
    }

    // Right Leg: Hip (thigh) & Knee (shin/foot)
    if (!e.severedLimbs.has('rightHip')) {
      if (bones.rightUpLeg && bones.rightLeg) {
        bones.rightUpLeg.node.getWorldPosition(_vec3);
        bones.rightLeg.node.getWorldPosition(_vec3B);
        volumes.push({
          limb: 'rightHip',
          x: (_vec3.x + _vec3B.x) * 0.5,
          y: (_vec3.y + _vec3B.y) * 0.5,
          z: (_vec3.z + _vec3B.z) * 0.5,
          radius: 0.23 * scaleW,
        });
      } else if (bones.rightUpLeg) {
        bones.rightUpLeg.node.getWorldPosition(_vec3);
        volumes.push({
          limb: 'rightHip',
          x: _vec3.x,
          y: _vec3.y - 0.16 * scaleH,
          z: _vec3.z,
          radius: 0.23 * scaleW,
        });
      } else {
        volumes.push({
          limb: 'rightHip',
          x: e.x + rx * 0.18 * scaleW,
          y: ey + 0.64 * scaleH - crawlDrop * 0.4,
          z: e.z + rz * 0.18 * scaleW,
          radius: 0.23 * scaleW,
        });
      }

      if (!e.severedLimbs.has('rightKnee')) {
        if (bones.rightLeg) {
          bones.rightLeg.node.getWorldPosition(_vec3);
          if (bones.rightFoot) {
            bones.rightFoot.node.getWorldPosition(_vec3B);
            volumes.push({
              limb: 'rightKnee',
              x: (_vec3.x + _vec3B.x) * 0.5,
              y: (_vec3.y + _vec3B.y) * 0.5,
              z: (_vec3.z + _vec3B.z) * 0.5,
              radius: 0.22 * scaleW,
            });
          } else {
            volumes.push({
              limb: 'rightKnee',
              x: _vec3.x - sinY * cf * 0.16,
              y: _vec3.y - 0.18 * scaleH * (1 - cf * 0.7),
              z: _vec3.z - cosY * cf * 0.16,
              radius: 0.22 * scaleW,
            });
          }
        } else {
          volumes.push({
            limb: 'rightKnee',
            x: e.x + rx * 0.18 * scaleW - sinY * cf * 0.35,
            y: ey + 0.28 * scaleH * (1 - cf * 0.45),
            z: e.z + rz * 0.18 * scaleW - cosY * cf * 0.35,
            radius: 0.22 * scaleW,
          });
        }
      }
    }

    if (bones.spine) {
      bones.spine.node.getWorldPosition(_vec3);
      volumes.push({
        limb: 'torso',
        x: _vec3.x,
        y: _vec3.y + 0.14 * scaleH * (1 - cf * 0.55),
        z: _vec3.z,
        radius: e.radius * 0.54,
      });
    } else {
      volumes.push({
        limb: 'torso',
        x: e.x + sinY * fwdShift * 0.4,
        y: ey + 1.02 * scaleH - crawlDrop * 0.9,
        z: e.z + cosY * fwdShift * 0.4,
        radius: e.radius * 0.54,
      });
    }

    return volumes;
  }

  private detectProjectileLimbHit(
    e: EnemyEntity,
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    projRadius: number,
  ): { limb: LimbTarget; hitX: number; hitY: number; hitZ: number } | null {
    const segDx = x1 - x0;
    const segDy = y1 - y0;
    const segDz = z1 - z0;
    const segLenSq = segDx * segDx + segDy * segDy + segDz * segDz;
    const vols = this.getEnemyLimbHitVolumes(e);

    let bestHit: { limb: LimbTarget; hitX: number; hitY: number; hitZ: number } | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < vols.length; i++) {
      const v = vols[i];
      const t =
        segLenSq > 1e-6
          ? THREE.MathUtils.clamp(
              ((v.x - x0) * segDx + (v.y - y0) * segDy + (v.z - z0) * segDz) / segLenSq,
              0,
              1,
            )
          : 1;
      const cx = x0 + segDx * t;
      const cy = y0 + segDy * t;
      const cz = z0 + segDz * t;
      const dSq = (v.x - cx) * (v.x - cx) + (v.y - cy) * (v.y - cy) + (v.z - cz) * (v.z - cz);
      const hitR = v.radius + projRadius * 0.45;
      if (dSq <= hitR * hitR) {
        // Prefer headshots and limb joints over torso overlap
        const priorityBias = v.limb === 'head' ? -0.02 : v.limb === 'torso' ? 0.36 : 0;
        const score = t + priorityBias;
        if (score < bestScore) {
          bestScore = score;
          bestHit = { limb: v.limb, hitX: cx, hitY: cy, hitZ: cz };
        }
      }
    }

    return bestHit;
  }

  private applySeveredLimbPose(
    bundle: EnemyMeshBundle,
    severedLimbs: Set<LimbId>,
    stumpMeshes: Partial<Record<LimbId, { mesh: THREE.Mesh; dispose: () => void }>>,
    bleedTimers?: Record<LimbId, number>,
    dt = 0,
    isSpitter = false,
  ) {
    if (severedLimbs.size === 0) return;
    bundle.bodyPivot.updateMatrixWorld(true);

    severedLimbs.forEach((limb) => {
      const boneNode = this.getEnemyLimbBoneNode(bundle, limb);
      if (boneNode) {
        boneNode.scale.setScalar(0.0001);
        boneNode.updateMatrixWorld(true);
        boneNode.getWorldPosition(_vec3);
        const stump = stumpMeshes[limb];
        if (stump) {
          if (stump.mesh.parent !== bundle.bodyPivot) {
            bundle.bodyPivot.add(stump.mesh);
          }
          _vec3B.copy(_vec3);
          bundle.bodyPivot.worldToLocal(_vec3B);
          stump.mesh.position.copy(_vec3B);
        }
        if (bleedTimers && dt > 0 && bleedTimers[limb] > 0) {
          bleedTimers[limb] = Math.max(0, bleedTimers[limb] - dt);
          if (Math.random() < (limb === 'head' ? 0.78 : 0.48)) {
            this.spawnBloodDroplet(
              _vec3.x + (Math.random() - 0.5) * 0.05,
              _vec3.y,
              _vec3.z + (Math.random() - 0.5) * 0.05,
              (Math.random() - 0.5) * 2.1,
              (limb === 'head' ? 3.2 : 1.4) + Math.random() * 2.2,
              (Math.random() - 0.5) * 2.1,
              0.46 + Math.random() * 0.48,
              0.26,
              isSpitter,
            );
          }
        }
      }
    });
  }

  private severEnemyLimb(
    e: EnemyEntity,
    limb: LimbId,
    hitPos?: { x: number; y: number; z: number },
    shotDir?: { x: number; y: number; z: number },
  ) {
    if (e.severedLimbs.has(limb)) return;
    if (limb === 'leftElbow' && e.severedLimbs.has('leftShoulder')) return;
    if (limb === 'rightElbow' && e.severedLimbs.has('rightShoulder')) return;
    if (limb === 'leftKnee' && e.severedLimbs.has('leftHip')) return;
    if (limb === 'rightKnee' && e.severedLimbs.has('rightHip')) return;

    const hadLegLossBefore = this.enemyHasLegLoss(e);

    const distalMap: Partial<Record<LimbId, LimbId>> = {
      leftShoulder: 'leftElbow',
      rightShoulder: 'rightElbow',
      leftHip: 'leftKnee',
      rightHip: 'rightKnee',
    };
    const distalLimb = distalMap[limb];
    const distalAlreadyGone = distalLimb ? e.severedLimbs.has(distalLimb) : false;

    if (distalLimb) {
      e.severedLimbs.add(distalLimb);
      e.bleedTimers[distalLimb] = 0;
      const oldDistalStump = e.stumpMeshes[distalLimb];
      if (oldDistalStump) {
        oldDistalStump.mesh.parent?.remove(oldDistalStump.mesh);
        oldDistalStump.dispose();
        delete e.stumpMeshes[distalLimb];
      }
    }

    e.severedLimbs.add(limb);
    e.bleedTimers[limb] = limb === 'head' ? 1.8 : 4.0;

    e.bundle.group.updateMatrixWorld(true);
    const boneNode = this.getEnemyLimbBoneNode(e.bundle, limb);
    let sx = hitPos?.x ?? e.x;
    let sy = hitPos?.y ?? groundHeightAt(e.x, e.z) + 1.1;
    let sz = hitPos?.z ?? e.z;
    if (boneNode) {
      boneNode.getWorldPosition(_vec3);
      sx = _vec3.x;
      sy = _vec3.y;
      sz = _vec3.z;
    }

    const scaleMult = e.kind === 'brute' ? 1.38 : e.kind === 'spitter' ? 1.04 : 1.0;
    const stumpRadius =
      (limb === 'head'
        ? 0.056
        : limb === 'leftHip' || limb === 'rightHip'
          ? 0.048
          : limb === 'leftKnee' || limb === 'rightKnee'
            ? 0.04
            : limb === 'leftShoulder' || limb === 'rightShoulder'
              ? 0.036
              : 0.03) * scaleMult;
    const stump = buildBloodStumpMesh(stumpRadius);
    e.bundle.bodyPivot.add(stump.mesh);
    e.stumpMeshes[limb] = stump;

    // Launch tumbling severed limb piece
    const chunkBuilt = buildSeveredLimbMesh(limb, e.kind, distalAlreadyGone);
    const outDirX = (shotDir?.x ?? sx - this.px) * 0.72 + (Math.random() - 0.5) * 0.9;
    const outDirZ = (shotDir?.z ?? sz - this.pz) * 0.72 + (Math.random() - 0.5) * 0.9;
    const outLen = Math.max(0.01, Math.hypot(outDirX, outDirZ));
    const launchSpd = (limb === 'head' ? 5.2 : 4.2) + Math.random() * 2.5;

    chunkBuilt.group.position.set(sx, sy, sz);
    chunkBuilt.group.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.scene.add(chunkBuilt.group);
    this.severedLimbChunks.push({
      group: chunkBuilt.group,
      dispose: chunkBuilt.dispose,
      x: sx,
      y: sy,
      z: sz,
      vx: (outDirX / outLen) * launchSpd,
      vy: (limb === 'head' ? 5.6 : 4.2) + Math.random() * 2.2,
      vz: (outDirZ / outLen) * launchSpd,
      rx: chunkBuilt.group.rotation.x,
      ry: chunkBuilt.group.rotation.y,
      rz: chunkBuilt.group.rotation.z,
      vrx: (Math.random() - 0.5) * 14,
      vry: (Math.random() - 0.5) * 14,
      vrz: (Math.random() - 0.5) * 14,
      grounded: false,
      life: 11.5,
      bleedTimer: 1.5,
    });

    // Launch 2-3 small flesh/bone gore fragments ("en pedazos")
    const goreCount = limb === 'head' ? 3 : 2;
    for (let g = 0; g < goreCount; g++) {
      const gore = buildGoreChunkMesh(scaleMult * (0.85 + Math.random() * 0.45));
      const gSpd = 3.2 + Math.random() * 3.2;
      const gx = outDirX / outLen + (Math.random() - 0.5) * 1.1;
      const gz = outDirZ / outLen + (Math.random() - 0.5) * 1.1;
      const gLen = Math.max(0.01, Math.hypot(gx, gz));
      gore.group.position.set(sx, sy, sz);
      gore.group.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(gore.group);
      this.severedLimbChunks.push({
        group: gore.group,
        dispose: gore.dispose,
        x: sx + (Math.random() - 0.5) * 0.1,
        y: sy + (Math.random() - 0.5) * 0.1,
        z: sz + (Math.random() - 0.5) * 0.1,
        vx: (gx / gLen) * gSpd,
        vy: 3.4 + Math.random() * 3.0,
        vz: (gz / gLen) * gSpd,
        rx: gore.group.rotation.x,
        ry: gore.group.rotation.y,
        rz: gore.group.rotation.z,
        vrx: (Math.random() - 0.5) * 18,
        vry: (Math.random() - 0.5) * 18,
        vrz: (Math.random() - 0.5) * 18,
        grounded: false,
        life: 9.0,
        bleedTimer: 1.0,
      });
    }

    const isSpitter = e.kind === 'spitter';
    this.spawnBloodSpray(
      sx,
      sy,
      sz,
      outDirX / outLen,
      0.55,
      outDirZ / outLen,
      limb === 'head' ? 34 : 26,
      7.8,
      1.05,
      0.46,
      isSpitter,
    );
    this.spawnBloodDecal(e.x, e.z, 0.58 + Math.random() * 0.25, 0.85, 0.35, 38, isSpitter);

    // Tactical combat effects on the zombie
    if (limb === 'head') {
      e.hp = 0;
    } else if (
      limb === 'leftShoulder' ||
      limb === 'rightShoulder' ||
      limb === 'leftElbow' ||
      limb === 'rightElbow'
    ) {
      const dmgMult = limb === 'leftShoulder' || limb === 'rightShoulder' ? 0.72 : 0.84;
      e.damage = Math.max(4, Math.round(e.damage * dmgMult));
      if (e.state === 'windup' || e.state === 'lunge') {
        e.state = 'recover';
        e.stateTimer = 0.35;
      }
    } else if (
      limb === 'leftHip' ||
      limb === 'rightHip' ||
      limb === 'leftKnee' ||
      limb === 'rightKnee'
    ) {
      const leftLegLost = e.severedLimbs.has('leftKnee') || e.severedLimbs.has('leftHip');
      const rightLegLost = e.severedLimbs.has('rightKnee') || e.severedLimbs.has('rightHip');
      const legsLost = (leftLegLost ? 1 : 0) + (rightLegLost ? 1 : 0);
      e.walkStyle = 'inestable';
      e.speed = legsLost >= 2 ? Math.min(e.speed, 0.78) : Math.min(e.speed, 1.08);
      e.squash = 0.72;
      if (!hadLegLossBefore) {
        // Immediate knock-down onto the floor when losing first leg!
        e.crawlFactor = Math.max(e.crawlFactor, 0.35);
        e.vx *= 0.2;
        e.vz *= 0.2;
        if (e.state === 'windup' || e.state === 'lunge' || e.state === 'attack') {
          e.state = 'recover';
          e.stateTimer = 0.48;
        }
        this.spawnBloodDecal(e.x, e.z, 0.68, 0.86, 0.32, 42, isSpitter);
      }
    }

    this.applySeveredLimbPose(e.bundle, e.severedLimbs, e.stumpMeshes);
  }

  private damageEnemy(
    e: EnemyEntity,
    amount: number,
    knockVx: number,
    knockVz: number,
    hitLimb: LimbTarget = 'torso',
    hitPos?: { x: number; y: number; z: number },
    shotDir?: { x: number; y: number; z: number },
  ) {
    const isHeadshot = hitLimb === 'head';
    const effectiveDmg = isHeadshot ? Math.round(amount * 2.2) : amount;

    // Zombies survive body/limb shots until hit in the head; headshot kills immediately
    if (isHeadshot) {
      e.hp = 0;
    } else {
      e.hp = Math.max(1, e.hp - effectiveDmg);
    }
    e.hitFlashTimer = 0.075;
    e.squash = 1.18;
    e.vx += knockVx;
    e.vz += knockVz;

    // Taking damage immediately provokes & alerts the zombie to chase the player
    e.provoked = true;
    e.suspicion = 1;
    if (e.state === 'wander' || e.state === 'investigate') {
      e.state = 'chase';
      this.triggerZombieSpotAnim(e);
    }
    e.aggroTimer = 12.0;

    const ey = groundHeightAt(e.x, e.z) + 1.1;
    const bx = hitPos?.x ?? e.x;
    const by = hitPos?.y ?? ey;
    const bz = hitPos?.z ?? e.z;
    const isSpitter = e.kind === 'spitter';

    this.spawnBloodSpray(
      bx,
      by,
      bz,
      shotDir?.x ?? knockVx * 0.15,
      shotDir?.y ?? 0.35,
      shotDir?.z ?? knockVz * 0.15,
      isHeadshot ? 24 : 14,
      isHeadshot ? 7.2 : 5.6,
      0.95,
      0.34,
      isSpitter,
    );

    // Limb dismemberment occurs on the 3rd shot to the same limb sector
    if (hitLimb !== 'torso' && hitLimb !== 'head' && !e.severedLimbs.has(hitLimb)) {
      e.limbHits[hitLimb] += 1;
      if (e.limbHits[hitLimb] >= 3) {
        this.severEnemyLimb(e, hitLimb, hitPos, shotDir);
      }
    }

    const hpRatio = Math.max(0, e.hp / Math.max(1, e.maxHp));
    e.bundle.hpFillMesh.scale.x = Math.max(0.001, hpRatio);
    e.bundle.hpFillMat.color.setHex(
      hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xf59e0b : 0xef4444,
    );

    if (e.hp <= 0) {
      const idx = this.enemies.indexOf(e);
      if (idx !== -1) this.enemies.splice(idx, 1);

      // Transition into procedural death collapse animation instead of popping out
      e.bundle.hpBarGroup.visible = false;
      e.bundle.awarenessIcon.visible = false;
      e.bundle.telegraphRing.visible = false;
      e.bundle.group.scale.setScalar(1);
      for (let m = 0; m < e.bundle.bodyMaterials.length; m++) {
        const mat = e.bundle.bodyMaterials[m];
        if (!mat.emissive) continue;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }

      const fwdX = Math.sin(e.yaw);
      const fwdZ = Math.cos(e.yaw);
      const knockDot = knockVx * fwdX + knockVz * fwdZ;
      const fallDir = Math.abs(knockDot) > 0.5 ? (knockDot >= 0 ? -1 : 1) : Math.random() < 0.5 ? -1 : 1;

      let deathDuration = e.kind === 'brute' ? 1.05 : 0.82;
      if (e.bundle.clips?.['death']) {
        e.bundle.playClip?.('death', 0.12, 1.0);
        const clipDur = e.bundle.clips['death'].getClip().duration || 1.2;
        deathDuration = Math.max(0.95, Math.min(2.6, clipDur + 0.3));
      }

      this.dyingEnemies.push({
        bundle: e.bundle,
        shadow: e.shadow,
        x: e.x,
        y: groundHeightAt(e.x, e.z),
        z: e.z,
        yaw: e.yaw,
        baseShadowScale: e.kind === 'brute' ? 1.65 : 1.0,
        fallDir,
        timer: 0,
        duration: deathDuration,
        severedLimbs: new Set(e.severedLimbs),
        stumpMeshes: e.stumpMeshes,
        crawlFactor: e.crawlFactor,
      });

      const heavy = e.kind === 'brute';
      this.audio.playShatter(heavy);
      if (heavy) {
        this.hitstopTimer = 0.048;
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.42);
      } else {
        this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.12);
      }

      // Arterial death burst + expanding persistent blood pool decal on the ground
      this.spawnBloodSpray(
        bx,
        by,
        bz,
        shotDir?.x ?? 0,
        0.55,
        shotDir?.z ?? 0,
        heavy ? 46 : 32,
        heavy ? 8.6 : 6.8,
        1.35,
        0.5,
        isSpitter,
      );
      this.spawnBloodDecal(
        e.x,
        e.z,
        heavy ? 1.85 : 1.28,
        0.92,
        1.45,
        55,
        isSpitter,
      );

      this.kills += 1;
      this.combo = Math.min(8, this.combo + 1);
      this.comboTimer = 4.2;
      this.score += e.scoreValue * this.combo;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(this.bestScore));
        } catch {
          // Ignore storage write errors
        }
      }

      this.flareCharge = Math.min(100, this.flareCharge + (heavy ? 18 : 10));
      this.spawnPickup('ember', e.x, e.z);
      if (Math.random() < (heavy ? 0.9 : 0.56)) {
        this.spawnPickup(this.pickRandomSurvivalLootKind(), e.x + 0.35, e.z + 0.25);
      }
      if (heavy) {
        this.spawnPickup('ember', e.x + 0.5, e.z - 0.3);
        this.spawnPickup('wood', e.x - 0.4, e.z + 0.4);
      }
    } else {
      this.audio.playHit(this.combo);
    }
  }

  private hurtPlayer(damage: number) {
    if (this.invulnTimer > 0 || this.gameState !== 'PLAYING') return;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnTimer = 0.75;
    this.hurtFlashTimer = 0.55;
    this.combo = 1;
    this.comboTimer = 0;
    this.hitstopTimer = 0.055;
    this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.65);
    this.audio.playHurt();
    this.spawnBurst(this.px, this.py + 0.9, this.pz, 16, 0.95, 0.18, 0.18, 7);

    if (this.hp <= 0) {
      this.gameState = 'GAME_OVER';
      this.deathAnimTimer = 0;
      this.deathOrbitTimer = 0;
      this.deathFallDir = Math.random() < 0.5 ? 1 : -1;
      const dx = this.camera.position.x - this.px;
      const dz = this.camera.position.z - this.pz;
      this.deathCamStartDist = Math.max(1.6, Math.hypot(dx, dz));
      this.deathCamStartHeight = Math.max(1.2, this.camera.position.y - this.py);
      this.camYaw = Math.atan2(dx, dz);
      this.isAiming = false;
      this.reloadTimer = 0;
      this.muzzleFlashMesh.visible = false;
      this.heldKeys.clear();
      this.clearVirtualControls();
      this.exitPointerLockSafe();
      for (let i = 0; i < this.enemies.length; i++) {
        this.enemies[i].bundle.awarenessIcon.visible = false;
      }
    }
    this.emitHud();
  }

  private updateEffects(dt: number) {
    if (this.flareWaveTimer > 0) {
      this.flareWaveTimer -= dt;
      const p = 1 - Math.max(0, this.flareWaveTimer) / 0.4;
      this.flareWaveMesh.scale.setScalar(1 + p * 9.0);
      (this.flareWaveMesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.92;
      if (this.flareWaveTimer <= 0) this.flareWaveMesh.visible = false;
    }

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.visible = false;
      }
    }
  }

  private updateHarvestNodes(dt: number) {
    for (let i = 0; i < this.worldEnv.harvestNodes.length; i++) {
      const n = this.worldEnv.harvestNodes[i];
      if (n.hp <= 0) {
        n.respawnTimer -= dt;
        if (n.respawnTimer <= 0) {
          n.hp = n.maxHp;
          n.group.visible = true;
        }
        continue;
      }
      if (n.hitFlash > 0) {
        n.hitFlash -= dt;
        const jiggle = 1 + Math.sin(n.hitFlash * 55) * 0.08;
        n.group.scale.set(jiggle, 2 - jiggle, jiggle);
      } else {
        n.group.scale.setScalar(1);
      }
    }
  }

  private damageSupplyNode(n: (typeof this.worldEnv.harvestNodes)[number], dmg: number) {
    n.hp -= dmg;
    n.hitFlash = 0.1;
    this.audio.playChop();
    this.spawnBurst(
      n.x,
      groundHeightAt(n.x, n.z) + 0.7,
      n.z,
      7,
      n.kind === 'sunstone' ? 1.0 : 0.72,
      n.kind === 'sunstone' ? 0.68 : 0.54,
      0.24,
      4.5,
    );
    if (n.hp <= 0) {
      n.respawnTimer = 18;
      n.group.visible = false;
      if (n.kind === 'timber') {
        this.spawnPickup('wood', n.x, n.z);
        this.spawnPickup(this.pickRandomSurvivalLootKind(), n.x + 0.4, n.z);
      } else {
        this.spawnPickup('ember', n.x - 0.3, n.z);
        this.spawnPickup(
          Math.random() < 0.5 ? 'fal_ammo' : 'bandage',
          n.x + 0.35,
          n.z,
        );
        this.flareCharge = Math.min(100, this.flareCharge + 16);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (!p.fromPlayer) {
        p.mesh.rotation.y += dt * 8;
      } else if (Math.random() < 0.45) {
        this.spawnParticle(
          p.x + (Math.random() - 0.5) * 0.08,
          p.y + (Math.random() - 0.5) * 0.08,
          p.z + (Math.random() - 0.5) * 0.08,
          (Math.random() - 0.5) * 0.4,
          0.15 + Math.random() * 0.25,
          (Math.random() - 0.5) * 0.4,
          0.14,
          0.45,
          0,
          1.0,
          0.65,
          0.12,
        );
      }

      const gy = groundHeightAt(p.x, p.z);
      let remove = p.life <= 0 || Math.hypot(p.x, p.z) > ARENA_PLAYABLE_RADIUS + 8;

      if (!remove) {
        const cf = this.getCampfirePos();
        if (
          Math.hypot(p.x - cf.x, p.z - cf.z) <= 0.68 &&
          p.y <= groundHeightAt(cf.x, cf.z) + 1.32
        ) {
          this.spawnBurst(p.x, p.y, p.z, 4, 1.0, 0.7, 0.28, 3.5);
          remove = true;
        } else {
          for (let cIdx = 0; cIdx < this.worldEnv.colliders.length; cIdx++) {
            const c = this.worldEnv.colliders[cIdx];
            const cDist = Math.hypot(c.x - p.x, c.z - p.z);
            if (cDist <= c.radius * 0.9 + p.radius * 0.4) {
              const baseY = groundHeightAt(c.x, c.z);
              if (p.y >= baseY - 0.1 && p.y <= baseY + c.height) {
                if (p.fromPlayer) {
                  this.spawnBurst(p.x, p.y, p.z, 4, 0.95, 0.85, 0.6, 3.2);
                } else {
                  this.spawnBurst(p.x, p.y, p.z, 5, 0.55, 0.88, 0.22, 3.4);
                }
                remove = true;
                break;
              }
            }
          }
        }
      }

      if (!remove && p.fromPlayer) {
        const midX = (p.prevX + p.x) * 0.5;
        const midZ = (p.prevZ + p.z) * 0.5;
        const stepHalf = Math.hypot(p.x - p.prevX, p.z - p.prevZ) * 0.5;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(e.x - midX, e.z - midZ) > e.radius + p.radius + stepHalf + 0.6) {
            continue;
          }
          const hit = this.detectProjectileLimbHit(
            e,
            p.prevX,
            p.prevY,
            p.prevZ,
            p.x,
            p.y,
            p.z,
            p.radius,
          );
          if (hit) {
            const spd = Math.max(0.01, Math.hypot(p.vx, p.vy, p.vz));
            this.damageEnemy(
              e,
              p.damage,
              p.vx * 0.08,
              p.vz * 0.08,
              hit.limb,
              { x: hit.hitX, y: hit.hitY, z: hit.hitZ },
              { x: p.vx / spd, y: p.vy / spd, z: p.vz / spd },
            );
            remove = true;
            break;
          }
        }
        if (!remove && p.y < gy - 0.1) {
          remove = true;
        }
        if (!remove) {
          for (let k = 0; k < this.worldEnv.harvestNodes.length; k++) {
            const n = this.worldEnv.harvestNodes[k];
            if (n.hp > 0 && Math.hypot(n.x - p.x, n.z - p.z) <= 0.85) {
              this.damageSupplyNode(n, 18);
              remove = true;
              break;
            }
          }
        }
      } else if (!remove && !p.fromPlayer) {
        if (p.y < gy - 0.1) {
          remove = true;
        } else if (
          Math.hypot(this.px - p.x, this.pz - p.z) <= 0.65 + p.radius &&
          Math.abs(p.y - (this.py + 1.0 - this.crouchFactor * 0.35)) <= 1.15
        ) {
          this.hurtPlayer(p.damage);
          remove = true;
        }
      }

      if (remove) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number) {
    const magnetRange = 5.4;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      const gy = groundHeightAt(pk.x, pk.z);
      pk.vy -= 14 * dt;
      pk.y += pk.vy * dt;
      if (pk.y < gy + 0.45) {
        pk.y = gy + 0.45;
        pk.vy = 0;
      }

      const dx = this.px - pk.x;
      const dz = this.pz - pk.z;
      const dist = Math.hypot(dx, dz);
      if (dist < magnetRange && dist > 0.01) {
        const pull = 12 * dt;
        pk.x += (dx / dist) * pull;
        pk.z += (dz / dist) * pull;
      }

      pk.mesh.position.set(pk.x, pk.y + Math.sin(this.elapsed * 4 + i) * 0.08, pk.z);
      pk.mesh.rotation.y += dt * 2.4;

      if (dist <= 1.15) {
        this.audio.playPickup(this.combo);
        if (pk.kind === 'ember') {
          this.flareCharge = Math.min(100, this.flareCharge + 12);
          this.score += 45 * this.combo;
        } else if (pk.kind === 'wood') {
          this.wood += 1;
          this.hp = Math.min(this.maxHp, this.hp + 10);
          this.score += 35;
        } else if (pk.kind === 'bandage') {
          this.bandages += 1;
          this.score += 50;
        } else if (pk.kind === 'food') {
          this.food += 1;
          this.score += 45;
        } else if (pk.kind === 'fal_ammo') {
          this.rifleReserveAmmo += 20;
          this.score += 40;
        } else if (pk.kind === 'pistol_ammo') {
          this.pistolReserveAmmo += 15;
          this.score += 35;
        }
        this.scene.remove(pk.mesh);
        pk.disposeMesh?.();
        this.pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        this.scene.remove(pk.mesh);
        pk.disposeMesh?.();
        this.pickups.splice(i, 1);
      }
    }
  }

  private hasLineOfSightToPlayer(ex: number, ez: number): boolean {
    const segDx = this.px - ex;
    const segDz = this.pz - ez;
    const segLenSq = segDx * segDx + segDz * segDz;
    if (segLenSq < 0.01) return true;

    for (let i = 0; i < this.worldEnv.colliders.length; i++) {
      const c = this.worldEnv.colliders[i];
      const t = THREE.MathUtils.clamp(
        ((c.x - ex) * segDx + (c.z - ez) * segDz) / segLenSq,
        0,
        1,
      );
      const closestX = ex + t * segDx;
      const closestZ = ez + t * segDz;
      const distSq = (c.x - closestX) * (c.x - closestX) + (c.z - closestZ) * (c.z - closestZ);
      const blockR = c.radius * 0.85;
      if (distSq < blockR * blockR) return false;
    }
    return true;
  }

  private canZombieSeePlayer(e: EnemyEntity, dx: number, dz: number, dist: number): boolean {
    const playerSpeed = Math.hypot(this.pvx, this.pvz);
    const unarmedMult = this.weapon === 'unarmed' ? 0.82 : 1.0;
    const sightRange =
      (this.isCrouching ? 5.2 : playerSpeed > 6.5 ? 13.0 : 10.6) * unarmedMult;
    if (dist > sightRange) return false;

    const closeAwareness = this.isCrouching ? (this.weapon === 'unarmed' ? 0.95 : 1.15) : 2.1;
    if (dist <= closeAwareness) return this.hasLineOfSightToPlayer(e.x, e.z);

    const invD = 1 / Math.max(0.001, dist);
    const fx = Math.sin(e.yaw);
    const fz = Math.cos(e.yaw);
    const dot = fx * (dx * invD) + fz * (dz * invD);
    // Narrowed vision cone (~58 deg standing, ~46 deg in stealth crouch)
    const minCos = this.isCrouching ? 0.92 : 0.87;
    if (dot < minCos) return false;
    return this.hasLineOfSightToPlayer(e.x, e.z);
  }

  private updateEnemies(dt: number) {
    const isDay = this.isCurrentlyDaytime();
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
      e.alertTimer = Math.max(0, e.alertTimer - dt);
      e.squash += (1 - e.squash) * (1 - Math.exp(-14 * dt));

      const dx = this.px - e.x;
      const dz = this.pz - e.z;
      const dist = Math.hypot(dx, dz);
      const nx = dist > 0.001 ? dx / dist : 0;
      const nz = dist > 0.001 ? dz / dist : 1;

      const telMat = e.bundle.telegraphRing.material as THREE.MeshBasicMaterial;
      let desiredYaw = Math.atan2(nx, nz);

      if (e.state === 'wander') {
        telMat.opacity = 0;
        const playerSpeed = Math.hypot(this.pvx, this.pvz);
        const canSee = this.canZombieSeePlayer(e, dx, dz, dist);

        if (isDay && !e.provoked) {
          // Modo reposo diurno: no atacan a menos que los molestes muy de cerca o hagas ruido fuerte
          const bumpRadius = this.isCrouching ? 0.85 : 1.45;
          if (dist < bumpRadius) {
            e.provoked = true;
            e.suspicion = 1;
            e.state = 'chase';
            e.aggroTimer = 5.5;
            e.squash = 1.1;
            this.triggerZombieSpotAnim(e);
          } else if (!this.isCrouching && dist < 3.4 && playerSpeed > 2.2) {
            e.suspicion = Math.min(1, e.suspicion + dt * 0.9);
            if (e.suspicion >= 0.4) {
              e.state = 'investigate';
              e.investigateX = this.px;
              e.investigateZ = this.pz;
              e.investigateTimer = 2.8;
            }
          } else {
            e.suspicion = Math.max(0, e.suspicion - dt * 0.5);
            e.vx *= Math.exp(-8 * dt);
            e.vz *= Math.exp(-8 * dt);
            desiredYaw = e.yaw;
          }
        } else if (canSee) {
          if (this.isCrouching && dist > 2.3) {
            // In stealth, zombies investigate glimpsed movement before fully locking on
            e.suspicion = Math.min(1, e.suspicion + dt * (dist < 4.0 ? 1.45 : 0.85));
            e.investigateX = this.px;
            e.investigateZ = this.pz;
            if (e.suspicion >= 1.0) {
              e.state = 'chase';
              e.provoked = true;
              e.aggroTimer = 3.8;
              e.squash = 1.12;
              this.triggerZombieSpotAnim(e);
            } else if (e.suspicion >= 0.25) {
              e.state = 'investigate';
              e.investigateTimer = 3.4;
            }
          } else if (!this.isCrouching && dist > 6.8 && playerSpeed <= 6.2) {
            // Far edge of sight when walking normally: quick investigate before aggro
            e.suspicion = Math.min(1, e.suspicion + dt * 2.6);
            e.investigateX = this.px;
            e.investigateZ = this.pz;
            if (e.suspicion >= 0.95) {
              e.state = 'chase';
              e.provoked = true;
              e.aggroTimer = 5.5;
              e.squash = 1.12;
              this.triggerZombieSpotAnim(e);
            } else {
              e.state = 'investigate';
              e.investigateTimer = 3.5;
            }
          } else {
            e.state = 'chase';
            e.provoked = true;
            e.suspicion = 1;
            e.aggroTimer = this.isCrouching ? 3.5 : 5.5;
            e.squash = 1.12;
            this.triggerZombieSpotAnim(e);
          }
        } else {
          // Peripheral / acoustic awareness relative to player stealth
          const noiseRadius = this.isCrouching
            ? 2.2
            : playerSpeed > 6.4
              ? 8.8
              : playerSpeed > 1.2
                ? 4.6
                : 2.6;
          if (dist < noiseRadius && this.hasLineOfSightToPlayer(e.x, e.z)) {
            e.suspicion = Math.min(1, e.suspicion + dt * (this.isCrouching ? 0.55 : 1.55));
            e.investigateX = this.px;
            e.investigateZ = this.pz;
            if (e.suspicion >= 0.35) {
              e.state = 'investigate';
              e.investigateTimer = 3.5;
            }
          } else {
            e.suspicion = Math.max(0, e.suspicion - dt * 0.45);
          }

          if (e.state === 'wander') {
            // Ensure wandering waypoints stay in the forest ring outside the central clearing
            if (Math.hypot(e.wanderX, e.wanderZ) < 15.0) {
              const nextPt = this.pickWanderTarget(e.x, e.z);
              e.wanderX = nextPt.x;
              e.wanderZ = nextPt.z;
            }
            if (e.wanderWait > 0) {
              e.wanderWait -= dt;
              e.vx *= Math.exp(-9 * dt);
              e.vz *= Math.exp(-9 * dt);
              desiredYaw = e.yaw + Math.sin(this.elapsed * 0.75 + e.id) * 0.22;
            } else {
              const wdx = e.wanderX - e.x;
              const wdz = e.wanderZ - e.z;
              const wdist = Math.hypot(wdx, wdz);
              if (wdist < 1.35) {
                const nextPt = this.pickWanderTarget(e.x, e.z);
                e.wanderX = nextPt.x;
                e.wanderZ = nextPt.z;
                e.wanderWait = 1.2 + Math.random() * 2.0;
              } else {
                const roamSpeed = e.speed * 0.34;
                const wnx = wdx / wdist;
                const wnz = wdz / wdist;
                e.vx += (wnx * roamSpeed - e.vx) * (1 - Math.exp(-6 * dt));
                e.vz += (wnz * roamSpeed - e.vz) * (1 - Math.exp(-6 * dt));
                desiredYaw = Math.atan2(wnx, wnz);
              }
            }
          }
        }
      } else if (e.state === 'investigate') {
        telMat.opacity = 0;
        e.investigateTimer -= dt;
        const playerSpeed = Math.hypot(this.pvx, this.pvz);
        const canSee = this.canZombieSeePlayer(e, dx, dz, dist);

        if (canSee) {
          e.investigateX = this.px;
          e.investigateZ = this.pz;
          if (!this.isCrouching || dist <= 2.35) {
            e.state = 'chase';
            e.provoked = true;
            e.suspicion = 1;
            e.aggroTimer = this.isCrouching ? 3.5 : 5.5;
            e.squash = 1.12;
            this.triggerZombieSpotAnim(e);
          } else {
            e.suspicion = Math.min(1, e.suspicion + dt * (dist < 4.2 ? 1.55 : 0.85));
            e.investigateTimer = Math.max(e.investigateTimer, 2.2);
            if (e.suspicion >= 1.0) {
              e.state = 'chase';
              e.provoked = true;
              e.aggroTimer = 3.8;
              e.squash = 1.12;
              this.triggerZombieSpotAnim(e);
            }
          }
        } else if (!this.isCrouching && dist < (playerSpeed > 6.4 ? 9.0 : 4.8)) {
          e.investigateX = this.px;
          e.investigateZ = this.pz;
          e.suspicion = Math.min(1, e.suspicion + dt * 0.9);
          e.investigateTimer = Math.max(e.investigateTimer, 2.4);
          if (e.suspicion >= 1.0) {
            e.state = 'chase';
            e.provoked = true;
            e.aggroTimer = 5.0;
            this.triggerZombieSpotAnim(e);
          }
        } else {
          e.suspicion = Math.max(0, e.suspicion - dt * (this.isCrouching ? 0.36 : 0.2));
        }

        if (e.state === 'investigate') {
          const idx = e.investigateX - e.x;
          const idz = e.investigateZ - e.z;
          const idist = Math.hypot(idx, idz);
          if (idist > 1.15) {
            const invSpeed = e.speed * 0.56;
            const inx = idx / idist;
            const inz = idz / idist;
            e.vx += (inx * invSpeed - e.vx) * (1 - Math.exp(-6 * dt));
            e.vz += (inz * invSpeed - e.vz) * (1 - Math.exp(-6 * dt));
            desiredYaw = Math.atan2(inx, inz);
          } else {
            e.vx *= Math.exp(-8 * dt);
            e.vz *= Math.exp(-8 * dt);
            desiredYaw = e.yaw + Math.sin(this.elapsed * 2.4 + e.id) * 0.7;
          }

          if (e.investigateTimer <= 0 && e.suspicion <= 0.15) {
            e.state = 'wander';
            e.provoked = false;
            e.suspicion = 0;
            const nextPt = this.pickWanderTarget(e.x, e.z);
            e.wanderX = nextPt.x;
            e.wanderZ = nextPt.z;
            e.wanderWait = 0.8;
          }
        }
      } else if (e.state === 'chase') {
        telMat.opacity = 0;

        const keepSightRange = this.isCrouching ? 7.2 : 13.8;
        if (dist <= keepSightRange && this.hasLineOfSightToPlayer(e.x, e.z)) {
          e.aggroTimer = this.isCrouching ? 3.2 : 5.5;
          e.investigateX = this.px;
          e.investigateZ = this.pz;
        } else {
          const decayRate = this.isCrouching ? 2.6 : 1.5;
          e.aggroTimer -= dt * decayRate;
          const loseDist = this.isCrouching ? 6.0 : 11.0;
          if (e.aggroTimer <= 0 && (!this.hasLineOfSightToPlayer(e.x, e.z) || dist > loseDist)) {
            e.state = 'investigate';
            e.provoked = false;
            e.alertTimer = 0;
            e.suspicion = 0.65;
            e.investigateTimer = 3.0;
          }
        }

        if (e.state === 'chase') {
          if (e.alertTimer > 0.2) {
            e.vx *= Math.exp(-9 * dt);
            e.vz *= Math.exp(-9 * dt);
          } else {
            const desiredDist = e.kind === 'spitter' ? 9.5 : 0;
            if (e.kind === 'spitter' && dist < desiredDist - 1.5) {
              e.vx += (-nx * e.speed * 0.7 - e.vx) * (1 - Math.exp(-8 * dt));
              e.vz += (-nz * e.speed * 0.7 - e.vz) * (1 - Math.exp(-8 * dt));
            } else if (dist > desiredDist) {
              e.vx += (nx * e.speed - e.vx) * (1 - Math.exp(-8 * dt));
              e.vz += (nz * e.speed - e.vz) * (1 - Math.exp(-8 * dt));
            } else {
              e.vx *= Math.exp(-8 * dt);
              e.vz *= Math.exp(-8 * dt);
            }
          }

          const triggerRange = e.kind === 'spitter' ? 14.5 : e.kind === 'brute' ? 3.9 : 4.5;
          if (
            e.alertTimer <= 0.1 &&
            dist <= triggerRange &&
            e.attackCooldown <= 0 &&
            this.hasLineOfSightToPlayer(e.x, e.z)
          ) {
            e.state = 'windup';
            e.attackDuration = e.kind === 'brute' ? 0.95 : e.kind === 'spitter' ? 0.78 : 0.46;
            e.stateTimer = e.attackDuration;
            e.hasHitThisAttack = false;
            e.lungeDx = nx;
            e.lungeDz = nz;
          }
        }
      } else if (e.state === 'windup') {
        e.stateTimer -= dt;
        e.vx *= Math.exp(-12 * dt);
        e.vz *= Math.exp(-12 * dt);
        e.lungeDx = nx;
        e.lungeDz = nz;

        const maxDur = Math.max(0.1, e.attackDuration);
        const progress = 1 - Math.max(0, e.stateTimer) / maxDur;
        telMat.opacity = 0.35 + progress * 0.6;
        const ringScale =
          e.kind === 'brute' ? 1.1 + progress * 2.8 : 0.8 + progress * 0.7;
        e.bundle.telegraphRing.scale.setScalar(ringScale);

        if (e.stateTimer <= 0) {
          telMat.opacity = 0;

          if (e.kind === 'stalker') {
            e.state = 'lunge';
            e.attackDuration = 0.28;
            e.stateTimer = e.attackDuration;
            const lungeMult = this.enemyHasLegLoss(e) ? 0.32 : 1.0;
            e.vx = e.lungeDx * 10.6 * lungeMult;
            e.vz = e.lungeDz * 10.6 * lungeMult;
            e.squash = 0.82;
          } else if (e.kind === 'spitter') {
            const spawnY = groundHeightAt(e.x, e.z) + 1.35;
            const aimTargetY = this.py + 0.95 - this.crouchFactor * 0.35;
            const dAimY = aimTargetY - spawnY;
            const horizD = Math.max(1, dist);
            const spitSpeed = 12.2;
            const invHoriz = 1 / horizD;
            this.spawnProjectile(
              false,
              e.x + e.lungeDx * 0.4,
              spawnY,
              e.z + e.lungeDz * 0.4,
              e.lungeDx * spitSpeed,
              THREE.MathUtils.clamp(dAimY * invHoriz * spitSpeed, -4.5, 4.5),
              e.lungeDz * spitSpeed,
              e.damage,
              2.6,
              0.32,
            );
            this.spawnBurst(
              e.x + e.lungeDx * 0.45,
              spawnY,
              e.z + e.lungeDz * 0.45,
              6,
              0.62,
              0.92,
              0.22,
              3.5,
            );
            e.state = 'attack';
            e.attackDuration = 0.28;
            e.stateTimer = e.attackDuration;
            e.squash = 1.12;
          } else {
            e.state = 'attack';
            e.attackDuration = 0.34;
            e.stateTimer = e.attackDuration;
            e.squash = 0.74;
            this.spawnBurst(
              e.x + e.lungeDx * 0.75,
              groundHeightAt(e.x, e.z) + 0.25,
              e.z + e.lungeDz * 0.75,
              20,
              0.95,
              0.32,
              0.2,
              8.5,
            );
            this.shakeTrauma = Math.min(1, this.shakeTrauma + 0.32);
            if (!e.hasHitThisAttack && dist <= 4.1 && this.py - groundHeightAt(this.px, this.pz) < 1.25) {
              this.hurtPlayer(e.damage);
              e.hasHitThisAttack = true;
            }
          }
        }
      } else if (e.state === 'lunge') {
        e.stateTimer -= dt;
        desiredYaw = Math.atan2(e.lungeDx, e.lungeDz);
        if (
          !e.hasHitThisAttack &&
          dist <= e.radius + 0.88 &&
          this.py - groundHeightAt(this.px, this.pz) < 1.3
        ) {
          this.hurtPlayer(e.damage);
          e.hasHitThisAttack = true;
        }
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = 0.42;
          e.attackCooldown = 1.35;
        }
      } else if (e.state === 'attack') {
        e.stateTimer -= dt;
        desiredYaw = Math.atan2(e.lungeDx, e.lungeDz);
        e.vx *= Math.exp(-10 * dt);
        e.vz *= Math.exp(-10 * dt);
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = e.kind === 'brute' ? 0.65 : 0.42;
          e.attackCooldown = e.kind === 'brute' ? 2.3 : 2.0;
        }
      } else {
        e.stateTimer -= dt;
        e.vx *= Math.exp(-10 * dt);
        e.vz *= Math.exp(-10 * dt);
        if (e.stateTimer <= 0) e.state = 'chase';
      }

      for (let j = i + 1; j < this.enemies.length; j++) {
        const o = this.enemies[j];
        const sdx = e.x - o.x;
        const sdz = e.z - o.z;
        const sdist = Math.hypot(sdx, sdz);
        const minSep = e.radius + o.radius;
        if (sdist < minSep && sdist > 0.001) {
          const push = ((minSep - sdist) * 0.5) / sdist;
          e.x += sdx * push;
          e.z += sdz * push;
          o.x -= sdx * push;
          o.z -= sdz * push;
        }
      }

      e.x += e.vx * dt;
      e.z += e.vz * dt;

      // Keep roaming zombies inside playable perimeter & around colliders
      const er = Math.hypot(e.x, e.z);
      if (er > ARENA_PLAYABLE_RADIUS - 0.8 && er > 0.001) {
        e.x = (e.x / er) * (ARENA_PLAYABLE_RADIUS - 0.8);
        e.z = (e.z / er) * (ARENA_PLAYABLE_RADIUS - 0.8);
      }
      for (let cIdx = 0; cIdx < this.worldEnv.colliders.length; cIdx++) {
        const c = this.worldEnv.colliders[cIdx];
        const cdx = e.x - c.x;
        const cdz = e.z - c.z;
        const cdist = Math.hypot(cdx, cdz);
        const minD = c.radius + e.radius;
        if (cdist < minD && cdist > 0.001) {
          e.x = c.x + (cdx / cdist) * minD;
          e.z = c.z + (cdz / cdist) * minD;
        }
      }

      if (
        e.state === 'chase' &&
        e.attackCooldown <= 0 &&
        Math.hypot(this.px - e.x, this.pz - e.z) <= e.radius + 0.58 &&
        this.py - groundHeightAt(this.px, this.pz) < 1.3
      ) {
        this.hurtPlayer(e.damage);
        e.attackCooldown = 0.9;
      }

      const ey = groundHeightAt(e.x, e.z);
      e.bundle.group.position.set(e.x, ey, e.z);
      e.shadow.position.set(e.x, ey + 0.025, e.z);

      const yawTurnRate = e.state === 'wander' ? 4.5 : e.state === 'investigate' ? 6.5 : 10;
      const yDiff = Math.atan2(Math.sin(desiredYaw - e.yaw), Math.cos(desiredYaw - e.yaw));
      e.yaw += yDiff * (1 - Math.exp(-yawTurnRate * dt));
      e.bundle.group.rotation.y = e.yaw;
      e.bundle.group.scale.set(2 - e.squash, e.squash, 2 - e.squash);

      // Billboard 3D health bar toward camera (only when visible)
      if (e.bundle.hpBarGroup.visible) {
        _euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        e.bundle.hpBarGroup.rotation.set(_euler.x, _euler.y - e.yaw, 0, 'YXZ');
      }

      const anyLegLost = this.enemyHasLegLoss(e);
      e.crawlFactor = THREE.MathUtils.damp(e.crawlFactor, anyLegLost ? 1 : 0, 10, dt);

      // Context-aware '?' / '!' overhead awareness icon relative to player's stealth state
      this.updateEnemyAwarenessIcon(e, dist);

      // Procedural zombie skeletal & bodyPivot animation (zero default GLB animation)
      this.animateEnemyProcedural(e, dt);

      // Enforce collapsed severed bones, sync bloody stump caps, and emit arterial droplets
      this.applySeveredLimbPose(
        e.bundle,
        e.severedLimbs,
        e.stumpMeshes,
        e.bleedTimers,
        dt,
        e.kind === 'spitter',
      );

      for (let m = 0; m < e.bundle.bodyMaterials.length; m++) {
        const mat = e.bundle.bodyMaterials[m];
        if (!mat.emissive) continue;
        if (e.hitFlashTimer > 0) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 1.4;
        } else if (!e.bundle.isCustomGlb && m === 2) {
          mat.emissive.setHex(e.kind === 'spitter' ? 0x84cc16 : 0xe11d48);
          mat.emissiveIntensity = isDay && !e.provoked ? 0.25 : 1.9;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    }
  }

  private updateEnemyAwarenessIcon(e: EnemyEntity, dist: number) {
    const icon = e.bundle.awarenessIcon;
    const mat = icon.material as THREE.SpriteMaterial;
    const showMaxDist = e.state === 'wander' ? 25 : 31;

    if (this.gameState !== 'PLAYING' || this.editorMode || dist > showMaxDist) {
      icon.visible = false;
      return;
    }

    const icons = getAwarenessIconTextures();
    const isAttacking =
      e.state === 'chase' ||
      e.state === 'windup' ||
      e.state === 'lunge' ||
      e.state === 'attack' ||
      e.state === 'recover';
    const isInvestigating = e.state === 'investigate';
    const stealth = this.isCrouching;

    const targetMap = isAttacking ? icons.exclamation : icons.question;
    if (mat.map !== targetMap) {
      mat.map = targetMap;
      mat.needsUpdate = true;
    }

    let size = 0.35;
    let bob = 0;
    let opacity = 1.0;

    if (isAttacking) {
      const striking =
        e.state === 'windup' || e.state === 'lunge' || e.state === 'attack' || e.alertTimer > 0;
      if (stealth) {
        mat.color.setHex(striking ? 0xef4444 : 0xf97316);
      } else {
        mat.color.setHex(striking ? 0xff2d46 : 0xef4444);
      }
      size = striking ? 0.56 + Math.sin(this.elapsed * 14 + e.id) * 0.04 : 0.48;
      bob = Math.sin(this.elapsed * 9 + e.id) * 0.035;
      opacity = 1.0;
    } else if (isInvestigating) {
      mat.color.setHex(stealth ? 0xfbbf24 : 0xfb923c);
      size = 0.45 + Math.sin(this.elapsed * 7 + e.id) * 0.03;
      bob = Math.sin(this.elapsed * 5 + e.id) * 0.03;
      opacity = 0.96;
    } else {
      // Idle ('wander')
      mat.color.setHex(stealth ? 0x34d399 : 0x7dd3fc);
      size = 0.34;
      bob = Math.sin(this.elapsed * 2.2 + e.id) * 0.025;
      const distFade = 1 - THREE.MathUtils.smoothstep(dist, 18, 25);
      opacity = 0.78 * distFade;
    }

    icon.visible = opacity > 0.03;
    icon.position.y = e.bundle.awarenessBaseY + bob;
    icon.scale.set(size, size, 1);
    mat.opacity = opacity;
  }

  private animateEnemyProcedural(e: EnemyEntity, dt: number) {
    const zSpd = Math.hypot(e.vx, e.vz);
    const isAttacking = e.state === 'windup' || e.state === 'lunge' || e.state === 'attack';

    if (e.crawlFactor >= 0.35 && e.bundle.mixer) {
      e.bundle.resetClips?.();
    } else if (e.bundle.mixer && e.bundle.clips && Object.keys(e.bundle.clips).length > 0) {
      const clips = e.bundle.clips;
      if (isAttacking) {
        const chosen = ['habilidad3', 'run', 'walk'].find((k) => Boolean(clips[k]));
        if (chosen) {
          e.bundle.playClip?.(chosen, 0.12, 1.15);
          e.bundle.mixer.update(dt);
          e.bundle.bodyPivot.position.set(0, -e.crawlFactor * 0.72, 0);
          e.bundle.bodyPivot.rotation.set(e.crawlFactor * 1.15, 0, 0);
          return;
        }
      } else if (e.alertTimer > 0) {
        const chosen = ['habilidad1', 'habilidad3', 'run', 'walk'].find((k) => Boolean(clips[k]));
        if (chosen) {
          e.bundle.playClip?.(chosen, 0.14, 1.08);
          e.bundle.mixer.update(dt);
          e.bundle.bodyPivot.position.set(0, -e.crawlFactor * 0.72, 0);
          e.bundle.bodyPivot.rotation.set(e.crawlFactor * 1.15, 0, 0);
          return;
        }
      } else if (zSpd < 0.25) {
        // Resting in place: stop walking/casual stroll clips and settle into procedural idle stance
        e.bundle.resetClips?.();
      } else {
        const walkChoices =
          e.bundle.preferWalkClip === 'errante' && clips['errante']
            ? ['errante', 'walk', 'inestable', 'orco']
            : e.walkStyle === 'orco'
              ? ['orco', 'errante', 'walk', 'inestable']
              : ['inestable', 'errante', 'walk', 'orco'];
        const candidates = [...walkChoices, 'run'];
        const chosen = candidates.find((k) => Boolean(clips[k]));
        if (chosen) {
          const tScale =
            chosen === 'errante'
              ? e.state === 'wander'
                ? 0.9
                : e.state === 'investigate'
                  ? 0.96
                  : 1.04
              : e.walkStyle === 'orco'
                ? e.state === 'wander' || e.state === 'investigate'
                  ? 0.85
                  : 1.0
                : e.state === 'wander' || e.state === 'investigate'
                  ? 0.92
                  : 1.08;
          e.bundle.playClip?.(chosen, 0.16, tScale);
          e.bundle.mixer.update(dt);
          e.bundle.bodyPivot.position.set(0, -e.crawlFactor * 0.72, 0);
          e.bundle.bodyPivot.rotation.set(e.crawlFactor * 1.15, 0, 0);
          e.bundle.group.updateMatrixWorld(true);
          return;
        }
      }
    }

    const cf = e.crawlFactor;
    const isOrco = e.walkStyle === 'orco';
    const isUnstable = e.walkStyle === 'inestable';
    const phaseRate = cf > 0.3 ? 1.8 + zSpd * 3.1 : isOrco ? 1.15 + zSpd * 1.18 : 1.45 + zSpd * 1.55;
    e.walkPhase += dt * phaseRate;
    const moveRatio = THREE.MathUtils.clamp(zSpd / Math.max(0.1, e.speed), 0, 1.3);

    const rawSwing = isUnstable
      ? Math.sin(e.walkPhase) + 0.36 * Math.sin(e.walkPhase * 2 + 0.7)
      : Math.sin(e.walkPhase);
    const swing = rawSwing * (isOrco ? 0.54 : 0.68) * moveRatio;
    const swingR = isUnstable
      ? -(Math.sin(e.walkPhase - 0.32) * 0.56) * moveRatio
      : -swing;
    const bounce = Math.abs(Math.sin(e.walkPhase)) * (isOrco ? 0.11 : 0.075) * moveRatio;
    const sway = isUnstable
      ? Math.sin(e.walkPhase * 0.85 + e.id) * 0.16 * moveRatio
      : Math.cos(e.walkPhase * 0.5) * (isOrco ? 0.11 : 0.08) * moveRatio;

    const isWander = e.state === 'wander' || e.state === 'investigate';
    const isWindup = e.state === 'windup';
    const isLunge = e.state === 'lunge';
    const isAttack = e.state === 'attack';
    const isRecover = e.state === 'recover';
    const isAlerting = e.alertTimer > 0 && !isWindup && !isLunge && !isAttack;
    const atkDur = Math.max(0.1, e.attackDuration);
    const atkP = THREE.MathUtils.clamp(1 - e.stateTimer / atkDur, 0, 1);
    const strikeCurve = Math.sin(atkP * Math.PI);

    let torsoLean = (isWander ? 0.1 : 0.24 + moveRatio * 0.12) + (isOrco ? 0.14 * moveRatio : 0);
    let torsoYaw = sway * (isUnstable ? 0.95 : 0.65);
    let headPitch = (isWander ? 0.06 : -0.14) + (isUnstable ? Math.sin(e.walkPhase * 1.6) * 0.09 * moveRatio : 0);
    let bodyDrop = bounce;
    let leftArmPitch = (isWander ? -0.18 : -1.12) + (isUnstable ? 0.18 * moveRatio : 0);
    let rightArmPitch = (isWander ? -0.18 : -1.12) - (isUnstable ? 0.22 * moveRatio : 0);
    let leftArmRoll = (isWander ? 0.08 : 0.04) + (isOrco ? 0.14 : 0);
    let rightArmRoll = (isWander ? -0.08 : -0.04) - (isOrco ? 0.14 : 0);
    let leftArmYaw = isWander ? -0.04 : -0.1;
    let rightArmYaw = isWander ? 0.04 : 0.1;
    let leftElbow =
      (isWander ? -0.42 : -0.34) +
      (isOrco ? -0.18 : 0) +
      Math.sin(e.walkPhase * 1.1) * 0.14 * moveRatio;
    let rightElbow =
      (isWander ? -0.42 : -0.34) +
      (isOrco ? -0.18 : isUnstable ? -0.25 : 0) -
      Math.sin(e.walkPhase * 1.1) * 0.14 * moveRatio;

    const armClaw = Math.sin(e.walkPhase * 0.9) * (isWander ? 0.16 : 0.22) * (0.15 + 0.85 * Math.min(1, moveRatio));
    leftArmPitch += armClaw;
    rightArmPitch -= armClaw;

    if (isAlerting) {
      torsoLean = -0.26;
      headPitch = -0.38;
      leftArmPitch = -1.65;
      rightArmPitch = -1.65;
      leftArmRoll = 0.45;
      rightArmRoll = -0.45;
      leftElbow = -0.75;
      rightElbow = -0.75;
    } else if (isWindup) {
      if (e.kind === 'brute') {
        torsoLean = -0.32 * atkP;
        headPitch = -0.24 * atkP;
        leftArmPitch = -1.2 - 1.65 * atkP;
        rightArmPitch = -1.2 - 1.65 * atkP;
        leftArmRoll = 0.22 * atkP;
        rightArmRoll = -0.22 * atkP;
        leftElbow = -0.48;
        rightElbow = -0.48;
        bodyDrop = -0.04 * atkP;
      } else if (e.kind === 'spitter') {
        torsoLean = -0.38 * atkP;
        headPitch = -0.42 * atkP;
        leftArmPitch = -0.4 + 0.55 * atkP;
        rightArmPitch = -0.4 + 0.55 * atkP;
        leftArmRoll = 0.32 * atkP;
        rightArmRoll = -0.32 * atkP;
        leftElbow = -0.95;
        rightElbow = -0.95;
      } else {
        torsoLean = -0.26 * atkP;
        bodyDrop = -0.14 * atkP;
        leftArmPitch = -1.1 + 0.9 * atkP;
        rightArmPitch = -1.1 + 0.9 * atkP;
        leftArmRoll = 0.36 * atkP;
        rightArmRoll = -0.36 * atkP;
        leftElbow = -1.05;
        rightElbow = -1.05;
      }
    } else if (isLunge) {
      // Stalker double claw swipe + lunge forward
      const slash = Math.sin(atkP * Math.PI);
      const sweep = (atkP - 0.5) * 1.8;
      torsoLean = 0.52 + slash * 0.18;
      torsoYaw = Math.sin(atkP * Math.PI * 2) * 0.24;
      headPitch = -0.25;
      bodyDrop = 0.08 * slash;
      leftArmPitch = -2.2 + sweep * 0.95;
      rightArmPitch = -1.75 + sweep * 1.15;
      leftArmYaw = 0.48 * slash;
      rightArmYaw = -0.48 * slash;
      leftArmRoll = 0.15;
      rightArmRoll = -0.15;
      leftElbow = -0.22;
      rightElbow = -0.22;
    } else if (isAttack) {
      if (e.kind === 'brute') {
        // Heavy two-handed overhead ground slam
        const slam = Math.min(1, atkP * 2.2);
        torsoLean = 0.78 * slam;
        headPitch = 0.25 * slam;
        bodyDrop = -0.22 * slam;
        leftArmPitch = -2.6 + slam * 2.25;
        rightArmPitch = -2.6 + slam * 2.25;
        leftArmRoll = 0.06;
        rightArmRoll = -0.06;
        leftElbow = -0.14;
        rightElbow = -0.14;
      } else {
        // Spitter forward spit snap & arm flare
        torsoLean = 0.44 * strikeCurve;
        headPitch = 0.42 * strikeCurve;
        leftArmPitch = -1.15 - strikeCurve * 0.3;
        rightArmPitch = -1.15 - strikeCurve * 0.3;
        leftArmRoll = 0.58 * strikeCurve;
        rightArmRoll = -0.58 * strikeCurve;
        leftElbow = -0.24;
        rightElbow = -0.24;
      }
    } else if (isRecover) {
      torsoLean = 0.16;
      leftArmPitch = -0.75;
      rightArmPitch = -0.75;
      leftElbow = -0.55;
      rightElbow = -0.55;
    }

    // Ground-crawl posture blend when one or both legs are severed
    const crawlPullL = Math.sin(e.walkPhase) * (0.25 + 0.75 * Math.min(1, moveRatio));
    const crawlPullR = -crawlPullL;
    if (cf > 0.02) {
      torsoLean = THREE.MathUtils.lerp(torsoLean, -0.22 + Math.sin(e.walkPhase * 2) * 0.05, cf);
      torsoYaw = THREE.MathUtils.lerp(torsoYaw, crawlPullL * 0.26, cf);
      headPitch = THREE.MathUtils.lerp(headPitch, -0.78, cf);
      leftArmPitch = THREE.MathUtils.lerp(leftArmPitch, -1.55 + crawlPullL * 0.65, cf);
      rightArmPitch = THREE.MathUtils.lerp(rightArmPitch, -1.55 + crawlPullR * 0.65, cf);
      leftArmRoll = THREE.MathUtils.lerp(leftArmRoll, 0.24, cf);
      rightArmRoll = THREE.MathUtils.lerp(rightArmRoll, -0.24, cf);
      leftElbow = THREE.MathUtils.lerp(leftElbow, -0.45 + Math.max(0, -crawlPullL) * 0.4, cf);
      rightElbow = THREE.MathUtils.lerp(rightElbow, -0.45 + Math.max(0, -crawlPullR) * 0.4, cf);
    }

    const scaleH = e.kind === 'brute' ? 1.38 : e.kind === 'spitter' ? 1.05 : 1.0;
    const crawlDrop = cf * 0.76 * scaleH;

    const { bones, bodyPivot, isCustomGlb } = e.bundle;
    bodyPivot.position.y = THREE.MathUtils.damp(
      bodyPivot.position.y,
      bodyDrop * (1 - cf * 0.7) - crawlDrop,
      14,
      dt,
    );
    bodyPivot.rotation.z = THREE.MathUtils.damp(
      bodyPivot.rotation.z,
      THREE.MathUtils.lerp(sway, crawlPullL * 0.1, cf),
      10,
      dt,
    );

    const hasSkeleton = Boolean(bones.spine || bones.leftUpLeg || bones.rightUpLeg);
    if (!hasSkeleton) {
      bodyPivot.rotation.x = THREE.MathUtils.damp(
        bodyPivot.rotation.x,
        torsoLean * 0.7 * (1 - cf) + cf * 1.18,
        14,
        dt,
      );
      return;
    }
    bodyPivot.rotation.x = THREE.MathUtils.damp(bodyPivot.rotation.x, cf * 1.18, 14, dt);

    if (bones.hips) {
      bones.hips.node.position.x = THREE.MathUtils.damp(bones.hips.node.position.x, bones.hips.restPos.x, 12, dt);
      bones.hips.node.position.y = THREE.MathUtils.damp(bones.hips.node.position.y, bones.hips.restPos.y, 12, dt);
      bones.hips.node.position.z = THREE.MathUtils.damp(bones.hips.node.position.z, bones.hips.restPos.z, 12, dt);
      dampBoneRot(bones.hips, 0, 0, 0, 12, dt);
    }
    if (bones.neck) {
      dampBoneRot(bones.neck, 0, 0, 0, 12, dt);
    }

    const animLambda = isLunge || isAttack || isWindup ? 22 : 12;
    dampBoneRot(bones.spine, torsoLean, torsoYaw, isUnstable ? sway * 0.45 : 0, animLambda, dt);
    dampBoneRot(
      bones.head,
      headPitch + Math.sin(e.walkPhase * 0.5) * 0.06,
      sway * 1.1 + (isWander ? Math.sin(this.elapsed * 0.8 + e.id) * 0.2 : 0),
      isUnstable ? sway * 1.55 + Math.sin(e.walkPhase * 1.7) * 0.1 * moveRatio : sway,
      animLambda,
      dt,
    );

    const legCoil = isWindup ? -0.25 * atkP : isLunge ? -0.35 : 0;
    const legCrawlFactor = 1 - cf * 0.82;
    dampBoneRot(
      bones.leftUpLeg,
      (swing + legCoil) * legCrawlFactor + cf * 0.16,
      0,
      isOrco ? 0.08 : cf * 0.08,
      14,
      dt,
    );
    dampBoneRot(
      bones.rightUpLeg,
      (swingR + (isLunge ? 0.45 : legCoil)) * legCrawlFactor + cf * 0.16,
      0,
      isOrco ? -0.08 : -cf * 0.08,
      14,
      dt,
    );

    const kneeFlexL =
      ((Math.max(0, -Math.sin(e.walkPhase - 0.35)) * 0.78 +
        Math.max(0, Math.sin(e.walkPhase + 0.6)) * 0.18) *
        moveRatio +
        (isWindup ? 0.35 * atkP : 0)) *
      legCrawlFactor;
    const kneeFlexR =
      ((Math.max(0, Math.sin(e.walkPhase - 0.35)) * (isUnstable ? 0.45 : 0.78) +
        Math.max(0, -Math.sin(e.walkPhase + 0.6)) * 0.18) *
        moveRatio +
        (isWindup ? 0.35 * atkP : 0)) *
      legCrawlFactor;
    dampBoneRot(bones.leftLeg, kneeFlexL + cf * 0.12, 0, 0, 14, dt);
    dampBoneRot(bones.rightLeg, kneeFlexR + cf * 0.12, 0, 0, 14, dt);

    dampBoneRot(
      bones.leftFoot,
      Math.sin(e.walkPhase - 0.5) * 0.32 * moveRatio * legCrawlFactor + cf * 0.35,
      0,
      0,
      14,
      dt,
    );
    dampBoneRot(
      bones.rightFoot,
      -Math.sin(e.walkPhase - 0.5) * 0.32 * moveRatio * legCrawlFactor + cf * 0.35,
      0,
      0,
      14,
      dt,
    );

    if (isCustomGlb && bones.leftArm && bones.leftForeArm && bones.rightArm && bones.rightForeArm) {
      const zCos = Math.cos(e.yaw);
      const zSin = Math.sin(e.yaw);
      _weaponFwd.set(zSin, 0, zCos);
      _weaponRight.set(-zCos, 0, zSin);

      let fwdComp = isWander ? 0.24 : 0.94;
      let upComp = isWander ? -0.94 : -0.18;
      let outComp = isWander ? 0.24 : 0.14;
      let foreFwd = isWander ? 0.45 : 0.96;
      let foreUp = isWander ? -0.82 : 0.05;
      let leftExtraFwd = armClaw * 0.25;
      let rightExtraFwd = -armClaw * 0.25;

      if (isAlerting) {
        fwdComp = 0.42;
        upComp = 0.68;
        outComp = 0.55;
        foreFwd = 0.65;
        foreUp = 0.55;
      } else if (isWindup) {
        if (e.kind === 'brute') {
          fwdComp = 0.28;
          upComp = 0.95;
          outComp = 0.22;
          foreFwd = 0.4;
          foreUp = 0.85;
        } else if (e.kind === 'spitter') {
          fwdComp = -0.38;
          upComp = -0.45;
          outComp = 0.35;
          foreFwd = 0.2;
          foreUp = -0.6;
        } else {
          fwdComp = -0.45;
          upComp = 0.32;
          outComp = 0.34;
          foreFwd = 0.35;
          foreUp = 0.25;
        }
      } else if (isLunge) {
        const swipe = (atkP - 0.5) * 0.7;
        fwdComp = 0.95;
        upComp = 0.15 - swipe;
        outComp = 0.06;
        foreFwd = 0.98;
        foreUp = -0.25 - swipe * 0.5;
        leftExtraFwd = 0.18;
        rightExtraFwd = -0.12;
      } else if (isAttack) {
        if (e.kind === 'brute') {
          fwdComp = 0.65;
          upComp = -0.88;
          outComp = 0.1;
          foreFwd = 0.55;
          foreUp = -0.9;
        } else {
          fwdComp = 0.78;
          upComp = 0.08;
          outComp = 0.56 * strikeCurve + 0.12;
          foreFwd = 0.85;
          foreUp = 0.18;
        }
      } else if (isRecover) {
        fwdComp = 0.52;
        upComp = -0.68;
        outComp = 0.18;
        foreFwd = 0.65;
        foreUp = -0.42;
      }

      if (cf > 0.02) {
        fwdComp = THREE.MathUtils.lerp(fwdComp, 0.86, cf);
        upComp = THREE.MathUtils.lerp(upComp, -0.35, cf);
        outComp = THREE.MathUtils.lerp(outComp, 0.22, cf);
        foreFwd = THREE.MathUtils.lerp(foreFwd, 0.95, cf);
        foreUp = THREE.MathUtils.lerp(foreUp, -0.18, cf);
        leftExtraFwd = THREE.MathUtils.lerp(leftExtraFwd, crawlPullL * 0.38, cf);
        rightExtraFwd = THREE.MathUtils.lerp(rightExtraFwd, crawlPullR * 0.38, cf);
      }

      _vec3
        .copy(_weaponFwd)
        .multiplyScalar(fwdComp + leftExtraFwd)
        .addScaledVector(_weaponRight, -outComp);
      _vec3.y = upComp + (isLunge || isAttack || isAlerting ? 0 : armClaw * 0.15);
      orientBoneSegmentToWorldDir(bones.leftArm.node, bones.leftForeArm.node, _vec3, dt, animLambda);
      if (bones.leftHand) {
        _vec3B.copy(_weaponFwd).multiplyScalar(foreFwd).addScaledVector(_weaponRight, -0.06);
        _vec3B.y = foreUp;
        orientBoneSegmentToWorldDir(bones.leftForeArm.node, bones.leftHand, _vec3B, dt, animLambda);
      }

      _vec3
        .copy(_weaponFwd)
        .multiplyScalar(fwdComp + rightExtraFwd)
        .addScaledVector(_weaponRight, outComp);
      _vec3.y = upComp - (isLunge || isAttack || isAlerting ? 0 : armClaw * 0.15);
      orientBoneSegmentToWorldDir(bones.rightArm.node, bones.rightForeArm.node, _vec3, dt, animLambda);
      if (bones.rightHand) {
        _vec3B.copy(_weaponFwd).multiplyScalar(foreFwd).addScaledVector(_weaponRight, 0.06);
        _vec3B.y = foreUp;
        orientBoneSegmentToWorldDir(bones.rightForeArm.node, bones.rightHand, _vec3B, dt, animLambda);
      }
    } else {
      dampBoneRot(bones.leftArm, leftArmPitch, leftArmYaw, leftArmRoll, animLambda, dt);
      dampBoneRot(bones.rightArm, rightArmPitch, rightArmYaw, rightArmRoll, animLambda, dt);
      dampBoneRot(bones.leftForeArm, leftElbow, 0, 0, animLambda, dt);
      dampBoneRot(bones.rightForeArm, rightElbow, 0, 0, animLambda, dt);
    }
  }

  private updateDyingEnemies(dt: number) {
    for (let i = this.dyingEnemies.length - 1; i >= 0; i--) {
      const d = this.dyingEnemies[i];
      d.timer += dt;
      const t = Math.min(1, d.timer / d.duration);
      const fall = 1 - Math.pow(1 - t, 2.5);

      const { bodyPivot, bones, isCustomGlb, mixer, clips } = d.bundle;
      if (mixer && clips?.['death'] && d.crawlFactor < 0.35) {
        d.bundle.playClip?.('death', 0.12, 1.0);
        mixer.update(dt);
        bodyPivot.rotation.set(0, 0, 0);
        bodyPivot.position.set(0, 0, 0);
      } else {
        const startPitch = d.crawlFactor * 1.18;
        const targetPitch = d.crawlFactor > 0.35 ? 1.48 : d.fallDir * 1.44;
        bodyPivot.rotation.x = THREE.MathUtils.lerp(startPitch, targetPitch, fall);
        bodyPivot.rotation.z = d.fallDir * 0.18 * fall;
        bodyPivot.position.y = THREE.MathUtils.lerp(-d.crawlFactor * 0.76, d.crawlFactor > 0.35 ? -0.62 : 0.15, fall);

        if (bones.spine) {
          dampBoneRot(bones.spine, d.fallDir * 0.22 * fall, 0, d.fallDir * 0.14 * fall, 16, dt);
        }
        if (bones.head) {
          dampBoneRot(bones.head, -d.fallDir * 0.35 * fall, 0.25 * fall, 0.18 * d.fallDir * fall, 16, dt);
        }
        dampBoneRot(bones.leftUpLeg, -0.18 * fall, 0, 0.24 * fall, 16, dt);
        dampBoneRot(bones.rightUpLeg, 0.12 * fall, 0, -0.28 * fall, 16, dt);
        dampBoneRot(bones.leftLeg, 0.42 * fall, 0, 0, 16, dt);
        dampBoneRot(bones.rightLeg, 0.56 * fall, 0, 0, 16, dt);

        if (!isCustomGlb) {
          dampBoneRot(bones.leftArm, -0.55 * fall, 0, 0.48 * fall, 16, dt);
          dampBoneRot(bones.rightArm, -0.38 * fall, 0, -0.56 * fall, 16, dt);
          dampBoneRot(bones.leftForeArm, -0.35 * fall, 0, 0, 16, dt);
          dampBoneRot(bones.rightForeArm, -0.45 * fall, 0, 0, 16, dt);
        }
      }

      d.bundle.group.position.set(d.x, d.y, d.z);
      d.bundle.group.rotation.y = d.yaw;

      this.applySeveredLimbPose(d.bundle, d.severedLimbs, d.stumpMeshes);

      const fadeStart = 0.72;
      const fadeScale = t > fadeStart ? Math.max(0.01, 1 - (t - fadeStart) / (1 - fadeStart)) : 1;
      d.bundle.group.scale.setScalar(fadeScale);
      d.shadow.scale.setScalar(d.baseShadowScale * (1 + fall * 0.25) * fadeScale);

      if (d.timer >= d.duration) {
        this.scene.remove(d.bundle.group, d.shadow);
        Object.values(d.stumpMeshes).forEach((s) => s?.dispose());
        d.bundle.dispose();
        this.dyingEnemies.splice(i, 1);
      }
    }
  }

  private animatePlayerDeath(dt: number) {
    this.deathAnimTimer = Math.min(1.4, this.deathAnimTimer + dt);
    const t = Math.min(1, this.deathAnimTimer / 0.88);
    const buckle = Math.min(1, t / 0.36);
    const fall = THREE.MathUtils.clamp((t - 0.14) / 0.86, 0, 1);
    const fallEase = 1 - Math.pow(1 - fall, 2.6);

    const { bones, bodyPivot, isCustomGlb, mixer, clips } = this.playerRig;
    const gy = groundHeightAt(this.px, this.pz);
    if (this.py > gy) {
      this.pvy -= 21 * dt;
      this.py = Math.max(gy, this.py + this.pvy * dt);
      this.playerRig.root.position.set(this.px, this.py, this.pz);
      this.playerShadow.position.set(this.px, gy + 0.025, this.pz);
    }

    if (mixer && clips?.['death']) {
      this.playerRig.playClip?.('death', 0.14, 1.0);
      mixer.update(dt);
      bodyPivot.rotation.set(0, 0, 0);
      bodyPivot.position.set(0, 0, 0);
      this.playerShadow.scale.setScalar(1 + fallEase * 0.32);
    } else {
      bodyPivot.rotation.x = this.deathFallDir * 1.44 * fallEase;
      bodyPivot.rotation.z = this.deathFallDir * 0.22 * fallEase;
      bodyPivot.position.y = -0.18 * buckle + 0.32 * fallEase;
      this.playerShadow.scale.setScalar(1 + fallEase * 0.32);

      if (bones.hips) {
        const pelvisScale = Math.max(0.5, bones.hips.restPos.y / 0.86);
        bones.hips.node.position.y = THREE.MathUtils.damp(
          bones.hips.node.position.y,
          bones.hips.restPos.y - 0.24 * buckle * pelvisScale,
          16,
          dt,
        );
        dampBoneRot(bones.hips, 0, 0.14 * this.deathFallDir * fallEase, 0, 14, dt);
      }

      dampBoneRot(bones.spine, 0.24 * buckle + this.deathFallDir * 0.18 * fallEase, 0, 0.14 * this.deathFallDir * fallEase, 14, dt);
      dampBoneRot(bones.head, -this.deathFallDir * 0.34 * fallEase, 0.28 * this.deathFallDir * fallEase, 0, 14, dt);

      dampBoneRot(bones.leftUpLeg, -0.58 * buckle + 0.35 * fallEase, 0, 0.18 * fallEase, 16, dt);
      dampBoneRot(bones.rightUpLeg, -0.44 * buckle + 0.22 * fallEase, 0, -0.22 * fallEase, 16, dt);
      dampBoneRot(bones.leftLeg, 1.15 * buckle * (1 - fallEase * 0.55), 0, 0, 16, dt);
      dampBoneRot(bones.rightLeg, 0.98 * buckle * (1 - fallEase * 0.45), 0, 0, 16, dt);

      if (!isCustomGlb) {
        dampBoneRot(bones.leftArm, -0.35 * fallEase, 0, 0.62 * fallEase, 14, dt);
        dampBoneRot(bones.rightArm, -0.28 * fallEase, 0, -0.68 * fallEase, 14, dt);
        dampBoneRot(bones.leftForeArm, -0.38 * fallEase, 0, 0, 14, dt);
        dampBoneRot(bones.rightForeArm, -0.45 * fallEase, 0, 0, 14, dt);
      }
    }

    // Smooth continuous orbit & gradual pull-out focused on the fallen player
    this.deathOrbitTimer += dt;
    const orbitSpeed = 0.28 + 0.08 * Math.min(1, this.deathOrbitTimer / 1.5);
    this.camYaw += dt * orbitSpeed;

    const pullBlend = 1 - Math.exp(-this.deathOrbitTimer * 0.22);
    const riseBlend = 1 - Math.exp(-this.deathOrbitTimer * 0.2);
    const targetDist = Math.max(this.deathCamStartDist + 7.5, 11.5);
    const targetRelHeight = Math.max(this.deathCamStartHeight + 3.4, 5.6);

    const camR = THREE.MathUtils.lerp(this.deathCamStartDist, targetDist, pullBlend);
    const camRelY = THREE.MathUtils.lerp(this.deathCamStartHeight, targetRelHeight, riseBlend);

    const desiredX = this.px + Math.sin(this.camYaw) * camR;
    const desiredZ = this.pz + Math.cos(this.camYaw) * camR;
    const desiredY = Math.max(groundHeightAt(desiredX, desiredZ) + 0.9, this.py + camRelY);
    const alpha = 1 - Math.exp(-5 * dt);
    this.camera.position.x += (desiredX - this.camera.position.x) * alpha;
    this.camera.position.y += (desiredY - this.camera.position.y) * alpha;
    this.camera.position.z += (desiredZ - this.camera.position.z) * alpha;

    const focusY = this.py + THREE.MathUtils.lerp(1.15, 0.42, fallEase);
    this.camera.lookAt(this.px, focusY, this.pz);

    const targetDeathFov = Math.max(this.cameraSettings.normalFov, 56);
    if (Math.abs(this.camera.fov - targetDeathFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetDeathFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private updateSurvivalPopulation(dt: number) {
    const targetCount = this.getTargetZombieCount();
    if (this.enemies.length >= targetCount) return;

    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.spawnEnemyForActivePopulation(true);
      this.respawnTimer =
        this.difficulty === 'pilgrim' ? 3.2 : this.difficulty === 'warden' ? 2.4 : 1.7;
    }
  }

  private alignHandMinusYToWorldDir(
    handNode: THREE.Object3D,
    worldForward: THREE.Vector3,
    dt: number,
    lambda = 34,
  ) {
    if (!handNode.parent || worldForward.lengthSq() < 0.0001) return;
    // On procedural survivor, hand -Y points forward along fingers/weapon barrel and +Z points up
    _basisY.copy(worldForward).normalize().negate();
    _basisX.crossVectors(_basisY, _worldUp);
    if (_basisX.lengthSq() < 0.0001) _basisX.set(1, 0, 0);
    else _basisX.normalize();
    _basisZ.crossVectors(_basisX, _basisY).normalize();

    _alignMat.makeBasis(_basisX, _basisY, _basisZ);
    _ikWorldQ.setFromRotationMatrix(_alignMat);
    handNode.parent.getWorldQuaternion(_ikParentQ).invert();
    _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
    handNode.quaternion.slerp(_ikLocalQ, 1 - Math.exp(-lambda * dt));
  }

  private alignObjectForwardToWorldDir(
    obj: THREE.Object3D,
    worldForward: THREE.Vector3,
    dt: number,
    lambda = 32,
  ) {
    if (!obj.parent || worldForward.lengthSq() < 0.0001) return;
    _basisZ.copy(worldForward).normalize();
    _basisX.crossVectors(_worldUp, _basisZ);
    if (_basisX.lengthSq() < 0.0001) _basisX.set(1, 0, 0);
    else _basisX.normalize();
    _basisY.crossVectors(_basisZ, _basisX).normalize();

    _alignMat.makeBasis(_basisX, _basisY, _basisZ);
    _ikWorldQ.setFromRotationMatrix(_alignMat);
    obj.parent.getWorldQuaternion(_ikParentQ).invert();
    _ikLocalQ.copy(_ikParentQ).multiply(_ikWorldQ);
    obj.quaternion.slerp(_ikLocalQ, 1 - Math.exp(-lambda * dt));
  }

  private poseCustomArmDirs(
    upperArm: THREE.Object3D,
    foreArm: THREE.Object3D,
    handNode: THREE.Object3D | null,
    upperDir: THREE.Vector3,
    foreDir: THREE.Vector3,
    dt: number,
    lambda = 18,
  ) {
    orientBoneSegmentToWorldDir(upperArm, foreArm, upperDir, dt, lambda);
    if (handNode) {
      orientBoneSegmentToWorldDir(foreArm, handNode, foreDir, dt, lambda);
    }
  }

  private updatePlayerAnimation(dt: number, speed: number, isRunning: boolean) {
    this.squashY += (1 - this.squashY) * (1 - Math.exp(-14 * dt));
    const xzScale = 1 + (1 - this.squashY) * 0.45;
    this.playerRig.root.scale.set(xzScale, this.squashY, xzScale);

    const rig = this.playerRig;
    const { bones, bodyPivot, isCustomGlb } = rig;
    const isMoving = speed > 0.45;
    const moveRatio = THREE.MathUtils.clamp(speed / 6.2, 0, 1.35);
    const animRate = isRunning ? speed * 1.72 : speed * 1.5;
    this.walkPhase += dt * (isMoving ? animRate : 2.1);

    const windupRatio =
      this.jumpWindupTimer > 0
        ? Math.sin((1 - Math.max(0, this.jumpWindupTimer) / this.jumpWindupDuration) * Math.PI * 0.85)
        : 0;

    const movingBlend = THREE.MathUtils.clamp(speed / 1.8, 0, 1);
    const crouchHold = this.crouchFactor * (1 - movingBlend * 0.82);
    const sneakWalk = this.crouchFactor * movingBlend;

    const strideAmp = !this.grounded ? 0.5 : isRunning ? 1.08 : isMoving ? (this.isCrouching ? 0.48 : 0.66) : 0;
    const stride = Math.sin(this.walkPhase) * strideAmp;
    const landingBend = Math.max(0, 1 - this.squashY) * 1.45;
    const sneakHip = -sneakWalk * 0.66 - landingBend * 0.42 - windupRatio * 0.36;
    const sneakKnee = sneakWalk * 1.24 + landingBend * 0.85 + windupRatio * 0.9;
    const sneakAnkle = -sneakWalk * 0.48 - landingBend * 0.36 - windupRatio * 0.38;
    const breath = Math.sin(this.elapsed * 2.3) * 0.024;
    const bob =
      this.grounded && isMoving && windupRatio <= 0.01
        ? Math.abs(Math.sin(this.walkPhase)) * (isRunning ? 0.115 : this.isCrouching ? 0.025 : 0.05)
        : Math.sin(this.walkPhase) * 0.008;

    const aimingActive =
      ((this.gameState === 'PLAYING' &&
        (this.isAiming || this.fireHeld || this.virtualFire || this.recoilTimer > 0)) ||
        (this.cameraPreviewActive && this.cameraPreviewAim)) &&
      this.weapon !== 'unarmed';
    const recoilKick = this.recoilTimer > 0 ? THREE.MathUtils.clamp(this.recoilTimer / 0.12, 0, 1) * 0.2 : 0;
    const reloadTilt = this.reloadTimer > 0 ? 0.48 : 0;
    const sprintLean = !this.grounded
      ? this.pvy > 1.2
        ? 0.06
        : 0.18
      : isRunning
        ? 0.43 + Math.abs(Math.sin(this.walkPhase)) * 0.045
        : isMoving
          ? 0.07
          : 0;
    const crouchLean = crouchHold * 0.24 + sneakWalk * 0.34 + windupRatio * 0.28;

    const cosY = Math.cos(this.pyaw);
    const sinY = Math.sin(this.pyaw);
    // Character local forward (+Z -> world) and anatomical right (-X -> world)
    _weaponFwd.set(sinY, 0, cosY);
    _weaponRight.set(-cosY, 0, sinY);

    // 0. If custom Player .glb includes Meshy locomotion clips (walk/run/sprint) AND player is actively moving,
    // drive locomotion via AnimationMixer combined with crouch posture; when resting, never play walk or idle stroll.
    let skipBodyToArms = false;
    if (isMoving && rig.mixer && rig.clips && Object.keys(rig.clips).length > 0) {
      const candidates = !this.grounded
        ? ['sprint', 'run', 'walk']
        : isRunning
          ? ['sprint', 'run', 'walk']
          : this.isCrouching || this.isAiming || speed < 4.5
            ? ['walk', 'run']
            : ['run', 'walk', 'sprint'];
      const chosenClip = candidates.find((k) => Boolean(rig.clips![k]));
      if (chosenClip) {
        const overrideArms =
          this.weapon !== 'unarmed' || this.meleeTimer > 0 || this.reloadTimer > 0;
        if (overrideArms) {
          if (bones.rightArm) _savedRArmQ.copy(bones.rightArm.node.quaternion);
          if (bones.rightForeArm) _savedRForeQ.copy(bones.rightForeArm.node.quaternion);
          if (bones.rightHand) _savedRHandQ.copy(bones.rightHand.quaternion);
          if (bones.leftArm) _savedLArmQ.copy(bones.leftArm.node.quaternion);
          if (bones.leftForeArm) _savedLForeQ.copy(bones.leftForeArm.node.quaternion);
          if (bones.leftHand) _savedLHandQ.copy(bones.leftHand.quaternion);
        }

        const timeScale = !this.grounded
          ? 0.45
          : isRunning
            ? THREE.MathUtils.clamp(speed / 8.8, 0.85, 1.25)
            : THREE.MathUtils.clamp(speed / 4.2, 0.72, 1.2);
        rig.playClip?.(chosenClip, 0.16, timeScale);
        rig.mixer.update(dt);
        rig.root.updateMatrixWorld(true);

        const cf = this.crouchFactor;
        if (cf > 0.02) {
          if (bones.hips) {
            const pelvisScale = Math.max(0.5, bones.hips.restPos.y / 0.86);
            bones.hips.node.position.y -= cf * 0.25 * pelvisScale;
            bones.hips.node.updateMatrixWorld(true);
          }
          if (bones.spine) addWorldAxisRotation(bones.spine.node, _weaponRight, -0.34 * cf);
          if (bones.leftUpLeg) addWorldAxisRotation(bones.leftUpLeg.node, _weaponRight, 0.56 * cf);
          if (bones.rightUpLeg) addWorldAxisRotation(bones.rightUpLeg.node, _weaponRight, 0.56 * cf);
          if (bones.leftLeg) addWorldAxisRotation(bones.leftLeg.node, _weaponRight, -1.04 * cf);
          if (bones.rightLeg) addWorldAxisRotation(bones.rightLeg.node, _weaponRight, -1.04 * cf);
          if (bones.leftFoot) addWorldAxisRotation(bones.leftFoot.node, _weaponRight, 0.48 * cf);
          if (bones.rightFoot) addWorldAxisRotation(bones.rightFoot.node, _weaponRight, 0.48 * cf);
        }

        bodyPivot.position.y = THREE.MathUtils.damp(
          bodyPivot.position.y,
          (bones.hips ? 0 : -cf * 0.42) - windupRatio * 0.16 + (this.grounded ? 0 : 0.08),
          14,
          dt,
        );
        bodyPivot.rotation.set(0, 0, 0);

        if (bones.head) {
          addWorldAxisRotation(bones.head.node, _worldUp, this.headYawOffset * 0.8);
          addWorldAxisRotation(
            bones.head.node,
            _weaponRight,
            -this.headPitchOffset * 0.8 + 0.26 * cf,
          );
        }

        if (overrideArms) {
          if (bones.rightArm) bones.rightArm.node.quaternion.copy(_savedRArmQ);
          if (bones.rightForeArm) bones.rightForeArm.node.quaternion.copy(_savedRForeQ);
          if (bones.rightHand) bones.rightHand.quaternion.copy(_savedRHandQ);
          if (bones.leftArm) bones.leftArm.node.quaternion.copy(_savedLArmQ);
          if (bones.leftForeArm) bones.leftForeArm.node.quaternion.copy(_savedLForeQ);
          if (bones.leftHand) bones.leftHand.quaternion.copy(_savedLHandQ);
          skipBodyToArms = true;
        } else {
          if (rig.visorMat) {
            rig.visorMat.emissive.setHex(this.hurtFlashTimer > 0 ? 0xff2244 : 0xf59e0b);
          }
          return;
        }
      } else {
        rig.resetClips?.();
      }
    } else {
      rig.resetClips?.();
    }

    if (!skipBodyToArms) {
      // 1. Head & neck track camera aim smoothly (compensating for forward sprint/crouch lean)
      const headPitchComp = -sprintLean * 0.62 - crouchLean * 0.42 - windupRatio * 0.22;
      if (bones.neck && bones.head) {
        dampBoneRot(
          bones.neck,
          this.headPitchOffset * 0.35 + headPitchComp * 0.45 + breath * 0.4,
          this.headYawOffset * 0.35,
          0,
          16,
          dt,
        );
        dampBoneRot(
          bones.head,
          this.headPitchOffset * 0.65 + headPitchComp * 0.55,
          this.headYawOffset * 0.65,
          0,
          16,
          dt,
        );
      } else if (bones.head) {
        dampBoneRot(
          bones.head,
          this.headPitchOffset + headPitchComp + breath * 0.5,
          this.headYawOffset,
          0,
          16,
          dt,
        );
      }

      // 2. Subtle whole-body lateral weight shift & fallback crouch for static unrigged .glb
      const hasLegBones = Boolean(bones.leftUpLeg && bones.rightUpLeg);
      bodyPivot.position.y = THREE.MathUtils.damp(
        bodyPivot.position.y,
        (hasLegBones ? 0 : bob - this.crouchFactor * 0.42 - windupRatio * 0.2) +
          (this.grounded ? 0 : 0.08),
        15,
        dt,
      );
      bodyPivot.rotation.x = THREE.MathUtils.damp(bodyPivot.rotation.x, 0, 15, dt);
      bodyPivot.rotation.z = THREE.MathUtils.damp(
        bodyPivot.rotation.z,
        isMoving && this.grounded && windupRatio <= 0.01
          ? Math.cos(this.walkPhase) * (isRunning ? 0.048 : 0.032)
          : 0,
        12,
        dt,
      );

      // 3. Natural human pelvis bob, hip yaw twist, lateral weight shift & one-knee-down drop
      const hipYaw =
        isMoving && this.grounded && windupRatio <= 0.01
          ? Math.sin(this.walkPhase) * (isRunning ? 0.22 : this.isCrouching ? 0.1 : 0.165)
          : crouchHold * -0.14;
      const hipTilt =
        isMoving && this.grounded && windupRatio <= 0.01
          ? Math.cos(this.walkPhase) * (isRunning ? 0.075 : this.isCrouching ? 0.035 : 0.058)
          : 0;
      const pelvisUnitScale = bones.hips ? Math.max(0.5, bones.hips.restPos.y / 0.86) : 1;
      const crouchPelvisDrop =
        (crouchHold * (isCustomGlb ? 0.35 : 0.37) + sneakWalk * (isCustomGlb ? 0.25 : 0.28)) *
        pelvisUnitScale;

      if (bones.hips) {
        bones.hips.node.position.y = THREE.MathUtils.damp(
          bones.hips.node.position.y,
          bones.hips.restPos.y -
            crouchPelvisDrop -
            (landingBend * 0.08 + windupRatio * 0.22 - bob) * pelvisUnitScale,
          18,
          dt,
        );
        bones.hips.node.position.x = THREE.MathUtils.damp(
          bones.hips.node.position.x,
          bones.hips.restPos.x +
            (isMoving && this.grounded && windupRatio <= 0.01
              ? Math.cos(this.walkPhase) * (isRunning ? 0.042 : 0.032)
              : 0),
          14,
          dt,
        );
        bones.hips.node.position.z = THREE.MathUtils.damp(
          bones.hips.node.position.z,
          bones.hips.restPos.z,
          14,
          dt,
        );
        dampBoneRot(bones.hips, 0, hipYaw, hipTilt, 16, dt);
      }

      // 4. Flexible Legs, Knees & Ankles (one-knee-down tactical crouch + stealth walk + sprint)
      if (bones.leftUpLeg && bones.rightUpLeg) {
        if (!this.grounded) {
          const rising = this.pvy > 1.2;
          dampBoneRot(bones.leftUpLeg, rising ? -0.86 : -0.36, 0, 0.04, 16, dt);
          dampBoneRot(bones.rightUpLeg, rising ? 0.44 : 0.16, 0, -0.04, 16, dt);
          dampBoneRot(bones.leftLeg, rising ? 1.28 : 0.56, 0, 0, 16, dt);
          dampBoneRot(bones.rightLeg, rising ? 0.36 : 0.44, 0, 0, 16, dt);
          dampBoneRot(bones.leftFoot, rising ? -0.32 : -0.14, 0, 0, 16, dt);
          dampBoneRot(bones.rightFoot, rising ? 0.52 : 0.22, 0, 0, 16, dt);
        } else if (windupRatio > 0.02) {
          // Pre-jump spring coil anticipation
          dampBoneRot(bones.leftUpLeg, sneakHip - windupRatio * 0.55, 0, 0.03, 28, dt);
          dampBoneRot(bones.rightUpLeg, sneakHip - windupRatio * 0.55, 0, -0.03, 28, dt);
          dampBoneRot(bones.leftLeg, sneakKnee, 0, 0, 28, dt);
          dampBoneRot(bones.rightLeg, sneakKnee, 0, 0, 28, dt);
          dampBoneRot(bones.leftFoot, sneakAnkle, 0, 0, 28, dt);
          dampBoneRot(bones.rightFoot, sneakAnkle, 0, 0, 28, dt);
        } else {
          const fwdBias = isRunning ? 0.24 : 0.08;
          const rawL = stride + Math.cos(this.walkPhase) * strideAmp * 0.16;
          const rawR = -stride - Math.cos(this.walkPhase) * strideAmp * 0.16;
          const legLeadL = rawL < 0 ? rawL * (1 + fwdBias) : rawL * 0.9;
          const legLeadR = rawR < 0 ? rawR * (1 + fwdBias) : rawR * 0.9;

          const swingGain = isRunning ? 1.48 : 0.98;
          const tuckGain = isRunning ? 0.44 : 0.1;
          const swingKneeL = Math.max(0, -Math.sin(this.walkPhase - 0.35)) * swingGain * moveRatio;
          const tuckKneeL = Math.max(0, Math.sin(this.walkPhase + 0.15)) * tuckGain * moveRatio;
          const loadKneeL =
            Math.max(0, Math.sin(this.walkPhase + 0.78)) * (isRunning ? 0.34 : 0.22) * moveRatio;

          const swingKneeR = Math.max(0, Math.sin(this.walkPhase - 0.35)) * swingGain * moveRatio;
          const tuckKneeR = Math.max(0, -Math.sin(this.walkPhase + 0.15)) * tuckGain * moveRatio;
          const loadKneeR =
            Math.max(0, -Math.sin(this.walkPhase + 0.78)) * (isRunning ? 0.34 : 0.22) * moveRatio;

          const pushOffAmp = (isRunning ? 0.72 : 0.36) * moveRatio;
          const heelLiftAmp = (isRunning ? 0.44 : 0.28) * moveRatio;
          const walkAnkleL =
            sneakAnkle +
            Math.max(0, Math.sin(this.walkPhase - 0.85)) * pushOffAmp -
            Math.max(0, Math.sin(this.walkPhase + 0.95)) * heelLiftAmp;
          const walkAnkleR =
            sneakAnkle +
            Math.max(0, -Math.sin(this.walkPhase - 0.85)) * pushOffAmp -
            Math.max(0, -Math.sin(this.walkPhase + 0.95)) * heelLiftAmp;

          // One-knee-down tactical crouch pose: left foot planted flat forward, right knee on the ground
          const upL = THREE.MathUtils.lerp(legLeadL + sneakHip, -1.38, crouchHold);
          const upR = THREE.MathUtils.lerp(legLeadR + sneakHip, 0.16, crouchHold);
          const knL = THREE.MathUtils.lerp(sneakKnee + swingKneeL + tuckKneeL + loadKneeL, 1.44, crouchHold);
          const knR = THREE.MathUtils.lerp(sneakKnee + swingKneeR + tuckKneeR + loadKneeR, 1.36, crouchHold);
          const ftL = THREE.MathUtils.lerp(walkAnkleL, -0.06, crouchHold);
          const ftR = THREE.MathUtils.lerp(walkAnkleR, -0.35, crouchHold);

          dampBoneRot(bones.leftUpLeg, upL, 0, crouchHold * 0.08, 18, dt);
          dampBoneRot(bones.rightUpLeg, upR, 0, -crouchHold * 0.05, 18, dt);
          dampBoneRot(bones.leftLeg, knL, 0, 0, 20, dt);
          dampBoneRot(bones.rightLeg, knR, 0, 0, 20, dt);
          dampBoneRot(bones.leftFoot, ftL, 0, 0, 20, dt);
          dampBoneRot(bones.rightFoot, ftR, 0, 0, 20, dt);
        }
      }

      // 5. Torso twist & lean: negative Y turns Left shoulder forward & Right shoulder back for shooting
      if (bones.spine) {
        const counterTwist =
          isMoving && this.grounded && windupRatio <= 0.01
            ? -hipYaw * (aimingActive ? 0.95 : isRunning ? 1.65 : 1.5)
            : 0;
        const torsoRoll =
          isMoving && this.grounded && windupRatio <= 0.01
            ? -Math.cos(this.walkPhase) * (isRunning ? 0.055 : 0.036)
            : 0;
        const weaponTwist =
          this.weapon === 'rifle'
            ? aimingActive
              ? -0.32
              : isRunning
                ? -0.14
                : -0.22
            : this.weapon === 'pistol'
              ? aimingActive
                ? -0.12
                : -0.02
              : crouchHold * 0.12;
        dampBoneRot(
          bones.spine,
          sprintLean + crouchLean + breath - recoilKick * 0.28,
          counterTwist + weaponTwist,
          torsoRoll,
          15,
          dt,
        );
      }
    }

    // 6. Flexible Arms, Elbows, Wrists & Clean IK Weapon / Unarmed Positioning
    if (bones.rightArm && bones.leftArm) {
      const cosY = Math.cos(this.pyaw);
      const sinY = Math.sin(this.pyaw);
      // Character local forward (+Z -> world) and anatomical right (-X -> world)
      _weaponFwd.set(sinY, 0, cosY);
      _weaponRight.set(-cosY, 0, sinY);

      const idleSway = !isMoving ? Math.sin(this.elapsed * 1.9) * 0.018 : 0;

      if (this.reloadTimer > 0 && this.weapon !== 'unarmed') {
        if (isCustomGlb && bones.rightForeArm && bones.leftForeArm) {
          _vec3.copy(_weaponFwd).multiplyScalar(0.45).addScaledVector(_weaponRight, -0.15);
          _vec3.y = -0.82;
          _vec3B.copy(_weaponFwd).multiplyScalar(0.86).addScaledVector(_weaponRight, -0.35);
          _vec3B.y = 0.25 + reloadTilt * 0.2;
          this.poseCustomArmDirs(bones.rightArm.node, bones.rightForeArm.node, bones.rightHand, _vec3, _vec3B, dt, 18);

          _vec3.copy(_weaponFwd).multiplyScalar(0.45).addScaledVector(_weaponRight, 0.2);
          _vec3.y = -0.82;
          _vec3B.copy(_weaponFwd).multiplyScalar(0.86).addScaledVector(_weaponRight, 0.35);
          _vec3B.y = 0.28;
          this.poseCustomArmDirs(bones.leftArm.node, bones.leftForeArm.node, bones.leftHand, _vec3, _vec3B, dt, 18);
        } else {
          dampBoneRot(bones.rightArm, -0.35 + reloadTilt * 0.4, 0.12, 0, 16, dt);
          dampBoneRot(bones.rightForeArm, -0.95, 0, 0, 16, dt);
          dampBoneRot(bones.leftArm, -0.22 + reloadTilt * 0.4, -0.12, 0, 16, dt);
          dampBoneRot(bones.leftForeArm, -0.82, 0, 0, 16, dt);
          dampBoneRot(bones.rightHandRest, 0.2, 0, 0, 16, dt);
          dampBoneRot(bones.leftHandRest, -0.18, 0, 0, 16, dt);
        }
      } else if (windupRatio > 0.05 && !aimingActive) {
        if (isCustomGlb && bones.rightForeArm && bones.leftForeArm) {
          _vec3.copy(_weaponFwd).multiplyScalar(-0.45).addScaledVector(_weaponRight, 0.22);
          _vec3.y = -0.86;
          _vec3B.copy(_weaponFwd).multiplyScalar(0.32).addScaledVector(_weaponRight, 0.1);
          _vec3B.y = -0.92;
          this.poseCustomArmDirs(bones.rightArm.node, bones.rightForeArm.node, bones.rightHand, _vec3, _vec3B, dt, 24);

          _vec3.copy(_weaponFwd).multiplyScalar(-0.45).addScaledVector(_weaponRight, -0.22);
          _vec3.y = -0.86;
          _vec3B.copy(_weaponFwd).multiplyScalar(0.32).addScaledVector(_weaponRight, -0.1);
          _vec3B.y = -0.92;
          this.poseCustomArmDirs(bones.leftArm.node, bones.leftForeArm.node, bones.leftHand, _vec3, _vec3B, dt, 24);
        } else {
          dampBoneRot(bones.rightArm, 0.48 * windupRatio, 0, 0, 24, dt);
          dampBoneRot(bones.rightForeArm, -0.65 * windupRatio, 0, 0, 24, dt);
          dampBoneRot(bones.leftArm, 0.48 * windupRatio, 0, 0, 24, dt);
          dampBoneRot(bones.leftForeArm, -0.65 * windupRatio, 0, 0, 24, dt);
          dampBoneRot(bones.rightHandRest, 0, 0, 0, 20, dt);
          dampBoneRot(bones.leftHandRest, 0, 0, 0, 20, dt);
        }
      } else if (this.weapon === 'unarmed') {
        if (this.meleeTimer > 0) {
          const punchProg = Math.sin((this.meleeTimer / 0.24) * Math.PI);
          const rightPunch = this.meleeHandSign > 0;
          if (isCustomGlb && bones.rightForeArm && bones.leftForeArm) {
            const pArm = rightPunch ? bones.rightArm.node : bones.leftArm.node;
            const pFore = rightPunch ? bones.rightForeArm.node : bones.leftForeArm.node;
            const pHand = rightPunch ? bones.rightHand : bones.leftHand;
            const gArm = rightPunch ? bones.leftArm.node : bones.rightArm.node;
            const gFore = rightPunch ? bones.leftForeArm.node : bones.rightForeArm.node;
            const gHand = rightPunch ? bones.leftHand : bones.rightHand;

            _vec3.copy(_weaponFwd).multiplyScalar(0.95).addScaledVector(_weaponRight, rightPunch ? -0.12 : 0.12);
            _vec3.y = 0.08 * punchProg;
            this.poseCustomArmDirs(pArm, pFore, pHand, _vec3, _vec3, dt, 34);

            _vec3B.copy(_weaponFwd).multiplyScalar(0.25).addScaledVector(_weaponRight, rightPunch ? -0.25 : 0.25);
            _vec3B.y = -0.85;
            _ikT.copy(_weaponFwd).multiplyScalar(0.85);
            _ikT.y = 0.35;
            this.poseCustomArmDirs(gArm, gFore, gHand, _vec3B, _ikT, dt, 24);
          } else {
            const pArm = rightPunch ? bones.rightArm : bones.leftArm;
            const pFore = rightPunch ? bones.rightForeArm : bones.leftForeArm;
            const pHand = rightPunch ? bones.rightHandRest : bones.leftHandRest;
            const gArm = rightPunch ? bones.leftArm : bones.rightArm;
            const gFore = rightPunch ? bones.leftForeArm : bones.rightForeArm;
            const gHand = rightPunch ? bones.leftHandRest : bones.rightHandRest;

            dampBoneRot(pArm, -1.45 * punchProg, 0, 0, 34, dt);
            dampBoneRot(pFore, -0.22, 0, 0, 34, dt);
            dampBoneRot(pHand, 0, 0, 0, 26, dt);

            dampBoneRot(gArm, -0.45, 0, 0, 24, dt);
            dampBoneRot(gFore, -1.25, 0, 0, 24, dt);
            dampBoneRot(gHand, 0, 0, 0, 20, dt);
          }
        } else if (isCustomGlb && bones.rightForeArm && bones.leftForeArm) {
          // World-space natural arms for custom GLB (immune to T/A-pose local bone axes)
          const rSwing = !this.grounded ? -0.42 : isRunning ? stride * 0.88 : stride * 0.65;
          const lSwing = !this.grounded ? 0.35 : isRunning ? -stride * 0.88 : -stride * 0.65;
          const crouchArm = this.crouchFactor * 0.28;

          _vec3.copy(_weaponFwd).multiplyScalar(-rSwing + crouchArm).addScaledVector(_weaponRight, 0.16);
          _vec3.y = -0.92;
          _vec3B.copy(_weaponFwd).multiplyScalar(isRunning ? 0.85 : 0.42 + Math.max(0, -rSwing) * 0.45 + crouchArm * 0.8);
          _vec3B.y = isRunning ? 0.18 : -0.68;
          this.poseCustomArmDirs(bones.rightArm.node, bones.rightForeArm.node, bones.rightHand, _vec3, _vec3B, dt, 18);

          _vec3.copy(_weaponFwd).multiplyScalar(-lSwing + crouchArm).addScaledVector(_weaponRight, -0.16);
          _vec3.y = -0.92;
          _vec3B.copy(_weaponFwd).multiplyScalar(isRunning ? 0.85 : 0.42 + Math.max(0, -lSwing) * 0.45 + crouchArm * 0.8);
          _vec3B.y = isRunning ? 0.18 : -0.68;
          this.poseCustomArmDirs(bones.leftArm.node, bones.leftForeArm.node, bones.leftHand, _vec3, _vec3B, dt, 18);
        } else {
          // Procedural survivor unarmed natural swing, stealth poise, and athletic sprint pump
          if (isRunning && this.grounded) {
            dampBoneRot(bones.rightArm, 0.18 + stride * 0.82, 0, 0.06, 18, dt);
            dampBoneRot(bones.rightForeArm, -1.42 - Math.max(0, -stride) * 0.26, 0, 0, 18, dt);
            dampBoneRot(bones.leftArm, 0.18 - stride * 0.82, 0, -0.06, 18, dt);
            dampBoneRot(bones.leftForeArm, -1.42 - Math.max(0, stride) * 0.26, 0, 0, 18, dt);
            dampBoneRot(bones.rightHandRest, 0, 0, 0, 16, dt);
            dampBoneRot(bones.leftHandRest, 0, 0, 0, 16, dt);
          } else {
            const jumpSpread = !this.grounded ? 0.26 : 0;
            const jumpFwd = !this.grounded ? -0.45 : 0;
            const stealthLift = crouchHold * -0.22 - sneakWalk * 0.18;
            const stealthBend = crouchHold * -0.68 - sneakWalk * 0.52;
            const rSwing = stride * 0.68;
            const lSwing = -stride * 0.68;

            dampBoneRot(bones.rightArm, rSwing + jumpFwd + stealthLift + idleSway, 0, 0.07 + jumpSpread, 16, dt);
            dampBoneRot(bones.rightForeArm, -0.26 - Math.max(0, -rSwing) * 0.35 + stealthBend, 0, 0, 16, dt);
            dampBoneRot(bones.leftArm, lSwing + jumpFwd + stealthLift - idleSway, 0, -0.07 - jumpSpread, 16, dt);
            dampBoneRot(bones.leftForeArm, -0.26 - Math.max(0, -lSwing) * 0.35 + stealthBend, 0, 0, 16, dt);
            dampBoneRot(bones.rightHandRest, 0, 0, 0, 16, dt);
            dampBoneRot(bones.leftHandRest, 0, 0, 0, 16, dt);
          }
        }
      } else if (this.weapon === 'pistol') {
        if (isRunning && !aimingActive && this.grounded) {
          if (isCustomGlb && bones.rightForeArm && bones.leftForeArm) {
            _vec3.copy(_weaponFwd).multiplyScalar(-stride * 0.72).addScaledVector(_weaponRight, 0.16);
            _vec3.y = -0.88;
            _vec3B.copy(_weaponFwd).multiplyScalar(0.88);
            _vec3B.y = 0.18;
            this.poseCustomArmDirs(bones.rightArm.node, bones.rightForeArm.node, bones.rightHand, _vec3, _vec3B, dt, 18);

            _vec3.copy(_weaponFwd).multiplyScalar(stride * 0.85).addScaledVector(_weaponRight, -0.16);
            _vec3.y = -0.88;
            _vec3B.copy(_weaponFwd).multiplyScalar(0.88);
            _vec3B.y = 0.2;
            this.poseCustomArmDirs(bones.leftArm.node, bones.leftForeArm.node, bones.leftHand, _vec3, _vec3B, dt, 18);
          } else {
            const shoulderPumpR = 0.22 + stride * 0.66;
            const shoulderPumpL = 0.16 - stride * 0.84;
            dampBoneRot(bones.rightArm, shoulderPumpR, 0, 0.05, 18, dt);
            dampBoneRot(bones.rightForeArm, -1.42 - Math.max(0, -stride) * 0.26, 0, 0, 18, dt);
            dampBoneRot(bones.rightHandRest, 0.08, 0, 0, 18, dt);

            dampBoneRot(bones.leftArm, shoulderPumpL, 0, -0.05, 18, dt);
            dampBoneRot(bones.leftForeArm, -1.48 - Math.max(0, stride) * 0.26, 0, 0, 18, dt);
            dampBoneRot(bones.leftHandRest, 0.1, 0, 0, 18, dt);
          }
        } else {
          if (bones.rightForeArm && bones.rightHand) {
            rig.root.updateMatrixWorld(true);
            bones.rightArm.node.getWorldPosition(_rightShoulderPos);
            bones.leftArm.node.getWorldPosition(_leftShoulderPos);
            _chestCenter.copy(_rightShoulderPos).add(_leftShoulderPos).multiplyScalar(0.5);

            const gripRightOff = aimingActive ? 0.14 : 0.2;
            const gripUpOff = aimingActive
              ? -0.02 - Math.sin(this.camPitch) * 0.14 + recoilKick * 0.08
              : -0.16 + bob * 0.4 + idleSway;
            const gripFwdOff = (aimingActive ? 0.4 : 0.28 + stride * 0.05) - recoilKick * 0.12;

            _rightGripTarget
              .copy(_chestCenter)
              .addScaledVector(_weaponRight, gripRightOff)
              .addScaledVector(_weaponFwd, gripFwdOff);
            _rightGripTarget.y += gripUpOff;

            _ikPoleR
              .copy(_weaponRight)
              .multiplyScalar(0.45)
              .addScaledVector(_weaponFwd, -0.2);
            _ikPoleR.y -= 0.9;
            _ikPoleR.normalize();

            solveTwoBoneArmIK(
              bones.rightArm.node,
              bones.rightForeArm.node,
              bones.rightHand,
              _rightGripTarget,
              _ikPoleR,
              dt,
              40,
            );

            rig.root.updateMatrixWorld(true);
            if (aimingActive && this.gameState === 'PLAYING') {
              rig.pistolMesh.getWorldPosition(_vec3);
              _weaponAimDir.copy(this.aimPoint).sub(_vec3);
              if (_weaponAimDir.lengthSq() < 0.01) _weaponAimDir.copy(_weaponFwd);
              else _weaponAimDir.normalize();
              _weaponAimDir.y += recoilKick * 0.35;
            } else {
              _weaponAimDir.copy(_weaponFwd);
              _weaponAimDir.y = -0.12 + idleSway * 0.5;
            }
            _weaponAimDir.normalize();

            if (isCustomGlb) {
              this.alignObjectForwardToWorldDir(rig.pistolMesh, _weaponAimDir, dt, 34);
            } else {
              this.alignHandMinusYToWorldDir(bones.rightHand, _weaponAimDir, dt, 36);
            }
          }

          if (aimingActive && bones.leftForeArm && bones.leftHand) {
            rig.root.updateMatrixWorld(true);
            bones.rightHand!.getWorldPosition(_vec3);
            _vec3.addScaledVector(_weaponAimDir, -0.02);
            _vec3.y -= 0.02;
            _ikPole
              .copy(_weaponRight)
              .multiplyScalar(-0.55)
              .addScaledVector(_weaponFwd, -0.2);
            _ikPole.y -= 0.88;
            _ikPole.normalize();
            solveTwoBoneArmIK(
              bones.leftArm.node,
              bones.leftForeArm.node,
              bones.leftHand,
              _vec3,
              _ikPole,
              dt,
              42,
            );
            if (!isCustomGlb) {
              this.alignHandMinusYToWorldDir(bones.leftHand, _weaponAimDir, dt, 32);
            }
          } else if (isCustomGlb && bones.leftForeArm) {
            _vec3.copy(_weaponFwd).multiplyScalar(-stride * 0.65).addScaledVector(_weaponRight, -0.16);
            _vec3.y = -0.92;
            _vec3B.copy(_weaponFwd).multiplyScalar(0.45 + Math.max(0, stride) * 0.4);
            _vec3B.y = -0.7;
            this.poseCustomArmDirs(bones.leftArm.node, bones.leftForeArm.node, bones.leftHand, _vec3, _vec3B, dt, 16);
          } else {
            const jumpArm = !this.grounded ? -0.45 : 0;
            dampBoneRot(bones.leftArm, -stride * 0.72 + jumpArm + crouchHold * -0.18, 0, -0.06, 16, dt);
            dampBoneRot(
              bones.leftForeArm,
              -0.48 - Math.max(0, -stride) * 0.35 - crouchHold * 0.45 - (!this.grounded ? 0.45 : 0),
              0,
              0,
              16,
              dt,
            );
            dampBoneRot(bones.leftHandRest, 0.1 * Math.sin(this.walkPhase), 0, 0, 16, dt);
          }
        }
      } else {
        // Two-handed FAL Rifle Stance: Right Palm holds grip tucked into shoulder pocket, Left Palm locks onto handguard/foregrip
        if (bones.rightForeArm && bones.rightHand) {
          rig.root.updateMatrixWorld(true);
          bones.rightArm.node.getWorldPosition(_rightShoulderPos);
          bones.leftArm.node.getWorldPosition(_leftShoulderPos);
          _chestCenter.copy(_rightShoulderPos).add(_leftShoulderPos).multiplyScalar(0.5);

          const sprintPump = isRunning && !aimingActive ? Math.sin(this.walkPhase) : 0;
          const gripRightOff = aimingActive
            ? 0.145
            : isRunning
              ? 0.12 + sprintPump * 0.035
              : 0.16;
          const gripUpOff =
            (aimingActive
              ? 0.015
              : isRunning
                ? -0.135 + Math.abs(sprintPump) * 0.035
                : -0.085) -
            (aimingActive ? Math.sin(this.camPitch) * 0.09 : 0) +
            bob * (aimingActive ? 0.25 : 0.35) +
            idleSway * 0.38;
          // Target is the wrist; palm/rifle grip sits ~0.042m ahead along the hand
          const gripFwdOff =
            (aimingActive ? 0.205 : isRunning ? 0.19 : 0.215) - recoilKick * 0.1;

          _rightGripTarget
            .copy(_chestCenter)
            .addScaledVector(_weaponRight, gripRightOff)
            .addScaledVector(_weaponFwd, gripFwdOff);
          _rightGripTarget.y += gripUpOff;

          _ikPoleR
            .copy(_weaponRight)
            .multiplyScalar(isRunning && !aimingActive ? 0.85 : 0.78)
            .addScaledVector(_weaponFwd, -0.28);
          _ikPoleR.y -= isRunning && !aimingActive ? 0.72 : 0.88;
          _ikPoleR.normalize();

          solveTwoBoneArmIK(
            bones.rightArm.node,
            bones.rightForeArm.node,
            bones.rightHand,
            _rightGripTarget,
            _ikPoleR,
            dt,
            48,
          );

          rig.root.updateMatrixWorld(true);
          if (aimingActive) {
            rig.rifleMount.getWorldPosition(_vec3);
            _weaponAimDir.copy(this.aimPoint).sub(_vec3);
            if (_weaponAimDir.lengthSq() < 0.01) _weaponAimDir.copy(_weaponFwd);
            else _weaponAimDir.normalize();
            _weaponAimDir.y += recoilKick * 0.2;
          } else if (isRunning) {
            _weaponAimDir
              .copy(_weaponFwd)
              .multiplyScalar(0.76)
              .addScaledVector(_weaponRight, -0.56 + sprintPump * 0.08);
            _weaponAimDir.y = -0.2 + Math.abs(sprintPump) * 0.06;
          } else {
            _weaponAimDir
              .copy(_weaponFwd)
              .multiplyScalar(0.89)
              .addScaledVector(_weaponRight, -0.3);
            _weaponAimDir.y = -0.065 + idleSway * 0.45;
          }
          _weaponAimDir.normalize();

          if (isCustomGlb) {
            const rightFinger = bones.rightHand.children.find(
              (c) => c !== rig.pistolMesh && c !== rig.rifleMount,
            );
            if (rightFinger) {
              _vec3B.copy(_weaponAimDir).multiplyScalar(0.86);
              _vec3B.y -= 0.34;
              _vec3B.normalize();
              orientBoneSegmentToWorldDir(bones.rightHand, rightFinger, _vec3B, dt, 28);
              rig.root.updateMatrixWorld(true);
            }
            this.alignObjectForwardToWorldDir(rig.rifleMount, _weaponAimDir, dt, 48);
          } else {
            this.alignHandMinusYToWorldDir(bones.rightHand, _weaponAimDir, dt, 44);
          }

          // Solve Left Arm IK onto rifle handguard/foregrip with palm-center offset
          if (bones.leftForeArm && bones.leftHand) {
            rig.root.updateMatrixWorld(true);
            rig.rifleForegrip.getWorldPosition(_vec3);

            // Cup left hand slightly forward, right across, and up under the FAL handguard
            _vec3B
              .copy(_weaponAimDir)
              .multiplyScalar(0.72)
              .addScaledVector(_weaponRight, 0.44);
            _vec3B.y += 0.32;
            _vec3B.normalize();

            // Pull wrist target back by palm offset so the glove/palm lands directly on the foregrip
            _vec3
              .addScaledVector(_vec3B, isCustomGlb ? -0.036 : -0.042)
              .addScaledVector(_weaponRight, -0.012);

            _ikPole
              .copy(_weaponRight)
              .multiplyScalar(isRunning && !aimingActive ? -0.82 : -0.68)
              .addScaledVector(_weaponFwd, -0.2);
            _ikPole.y -= isRunning && !aimingActive ? 0.72 : 0.92;
            _ikPole.normalize();

            solveTwoBoneArmIK(
              bones.leftArm.node,
              bones.leftForeArm.node,
              bones.leftHand,
              _vec3,
              _ikPole,
              dt,
              86,
            );
            if (!isCustomGlb) {
              this.alignHandMinusYToWorldDir(bones.leftHand, _vec3B, dt, 42);
            } else if (bones.leftHand.children.length > 0) {
              orientBoneSegmentToWorldDir(
                bones.leftHand,
                bones.leftHand.children[0],
                _vec3B,
                dt,
                30,
              );
            } else {
              dampBoneRot(bones.leftHandRest, -0.14, 0.16, 0.1, 18, dt);
            }
          }
        }
      }
    }

    if (rig.visorMat) {
      rig.visorMat.emissive.setHex(this.hurtFlashTimer > 0 ? 0xff2244 : 0xf59e0b);
    }
    rig.root.updateMatrixWorld(true);
  }

  private updateFreeCamera(dt: number) {
    const aiming = this.gameState === 'PLAYING' ? this.isAiming : this.cameraPreviewAim;
    const sprinting = this.gameState === 'PLAYING' && this.stance === 'run';
    const targetDist = aiming
      ? this.cameraSettings.aimDistance
      : sprinting
        ? this.cameraSettings.normalDistance + 0.5
        : this.cameraSettings.normalDistance;
    const targetShoulder = aiming
      ? this.cameraSettings.aimShoulderOffset
      : this.cameraSettings.normalShoulderOffset;
    const targetPivotY =
      (aiming ? this.cameraSettings.aimHeight : this.cameraSettings.normalHeight) -
      this.crouchFactor * 0.48;

    this.camDistCurrent = THREE.MathUtils.damp(this.camDistCurrent, targetDist, 12, dt);
    this.camShoulderOffset = THREE.MathUtils.damp(this.camShoulderOffset, targetShoulder, 12, dt);
    this.camPivotHeight = THREE.MathUtils.damp(this.camPivotHeight, targetPivotY, 12, dt);

    const rightX = Math.cos(this.camYaw);
    const rightZ = -Math.sin(this.camYaw);

    const lookTargetX = this.px + rightX * this.camShoulderOffset;
    const lookTargetY = this.py + this.camPivotHeight;
    const lookTargetZ = this.pz + rightZ * this.camShoulderOffset;

    // Pull camera arm slightly inward if an obstacle collider sits between player and camera
    let effectiveDist = this.camDistCurrent;
    const cosP = Math.cos(this.camPitch);
    const armDirX = Math.sin(this.camYaw) * cosP;
    const armDirZ = Math.cos(this.camYaw) * cosP;
    for (let i = 0; i < this.worldEnv.colliders.length; i++) {
      const c = this.worldEnv.colliders[i];
      const relX = c.x - lookTargetX;
      const relZ = c.z - lookTargetZ;
      const proj = relX * armDirX + relZ * armDirZ;
      if (proj > 0.3 && proj < effectiveDist) {
        const perpSq = relX * relX + relZ * relZ - proj * proj;
        const blockR = c.radius + 0.35;
        if (perpSq < blockR * blockR) {
          effectiveDist = Math.min(effectiveDist, Math.max(0.95, proj - blockR));
        }
      }
    }

    const horizDist = cosP * effectiveDist;
    const vertOffset = Math.sin(this.camPitch) * effectiveDist;

    const desiredCamX = lookTargetX + Math.sin(this.camYaw) * horizDist;
    const desiredCamZ = lookTargetZ + Math.cos(this.camYaw) * horizDist;
    const minGroundCamY = groundHeightAt(desiredCamX, desiredCamZ) + 0.55;
    const desiredCamY = Math.max(minGroundCamY, lookTargetY + vertOffset);

    const dampXZ = 1 - Math.exp(-15 * dt);
    const dampY = 1 - Math.exp(-14 * dt);
    this.camera.position.x += (desiredCamX - this.camera.position.x) * dampXZ;
    this.camera.position.y += (desiredCamY - this.camera.position.y) * dampY;
    this.camera.position.z += (desiredCamZ - this.camera.position.z) * dampXZ;

    const shake = this.shakeTrauma * this.shakeTrauma;
    const ox = (Math.random() * 2 - 1) * shake * 0.45;
    const oy = (Math.random() * 2 - 1) * shake * 0.4;

    const aimLookX = lookTargetX - Math.sin(this.camYaw) * 16;
    const aimLookY = lookTargetY - Math.sin(this.camPitch) * 16;
    const aimLookZ = lookTargetZ - Math.cos(this.camYaw) * 16;
    this.camera.lookAt(aimLookX + ox, aimLookY + oy, aimLookZ);

    const targetFov = aiming
      ? this.cameraSettings.aimFov
      : sprinting
        ? Math.min(85, this.cameraSettings.normalFov + 6)
        : this.cameraSettings.normalFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, dt);
      this.camera.updateProjectionMatrix();
    }

    this.sunLight.position.set(this.px + 18, this.py + 28, this.pz + 16);
    this.sunLight.target.position.set(this.px, this.py, this.pz);
  }

  private emitHud() {
    let alertedCount = 0;
    let investigatingCount = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'investigate') investigatingCount++;
      else if (e.state !== 'wander') alertedCount++;
      const d = Math.hypot(e.x - this.px, e.z - this.pz);
      if (d < nearestDist) nearestDist = d;
    }

    const stealthState: 'hidden' | 'caution' | 'detected' =
      alertedCount > 0
        ? 'detected'
        : investigatingCount > 0 || nearestDist < 8.5
          ? 'caution'
          : 'hidden';

    this.onHudUpdate({
      gameState: this.gameState,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      weapon: this.weapon,
      stance: this.stance,
      isAiming: this.isAiming,
      isReloading: this.reloadTimer > 0,
      stealthActive: this.isCrouching,
      stealthState,
      pistolAmmo: this.pistolAmmo,
      pistolMaxAmmo: this.pistolMaxAmmo,
      pistolReserveAmmo: this.pistolReserveAmmo,
      rifleAmmo: this.rifleAmmo,
      rifleMaxAmmo: this.rifleMaxAmmo,
      rifleReserveAmmo: this.rifleReserveAmmo,
      bandages: this.bandages,
      food: this.food,
      flareCharge: Math.floor(this.flareCharge),
      wood: this.wood,
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      survivalTime: Math.floor(this.survivalTime),
      enemiesRemaining: this.enemies.length,
      alertedZombies: alertedCount,
      kills: this.kills,
      nearCampfire: (() => {
        const cf = this.getCampfirePos();
        return Math.hypot(this.px - cf.x, this.pz - cf.z) <= CAMPFIRE_SAFE_RADIUS;
      })(),
      pointerLocked: this.pointerLocked,
      playerPos: { x: this.px, z: this.pz },
      playerYaw: this.pyaw,
      camYaw: this.camYaw,
      radarEntities: this.enemies.map((e) => ({
        id: e.id,
        x: e.x,
        z: e.z,
        kind: e.kind,
      })),
      difficulty: this.difficulty,
      muted: this.audio.muted,
      hurtFlash: THREE.MathUtils.clamp(this.hurtFlashTimer / 0.55, 0, 1),
      timeOfDay: this.mapSettings.timeOfDay,
      isDaytime: this.isCurrentlyDaytime(),
      clockLabel: this.formatClockFromTimeOfDay(this.mapSettings.timeOfDay),
      fogLevel: this.currentFogLevel,
      editorMode: this.editorMode,
      activePlacementSlotId: this.activePlacementSlotId,
      selectedPropId: this.selectedPropId,
      propSlots: [...this.propSlots],
      placedProps: this.placedProps.map((p) => ({ ...p })),
      mapSettings: { ...this.mapSettings },
      postProcess: { ...this.postProcess },
      cameraSettings: { ...this.cameraSettings },
      customModelName: this.customModelName,
      customZombieName: this.getCustomZombieSummary(),
      customZombieSlots: this.customZombieSlots.map((s) => ({ ...s })),
      customRifleName: this.customRifleName,
      modelError: this.modelError,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.exitPointerLockSafe();

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('contextmenu', this.handleContextMenu);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);

    this.clearDynamicEntities();
    this.playerRig.dispose();
    this.customZombieTemplates.forEach((t) => t.dispose());
    this.customZombieTemplates.clear();
    this.customRifleTemplate?.dispose();
    this.propTemplates.forEach((t) => t.dispose());
    this.propTemplates.clear();
    this.placedPropMeshes.forEach((m) => this.scene.remove(m));
    this.placedPropMeshes.clear();

    this.campfireVisuals.dispose();
    this.worldEnv.dispose();
    this.groundTex.dispose();
    this.simpleGroundTex.dispose();
    this.groundBumpTex.dispose();
    this.barkTex.dispose();
    this.stoneTex.dispose();
    this.skyTex.dispose();
    this.contactShadowTex.dispose();
    this.customGroundTex?.dispose();
    this.customStoneTex?.dispose();
    this.customBarkTex?.dispose();

    this.selectionRing.geometry.dispose();
    (this.selectionRing.material as THREE.Material).dispose();
    this.playerShadow.geometry.dispose();
    (this.playerShadow.material as THREE.Material).dispose();
    this.aimReticle.geometry.dispose();
    (this.aimReticle.material as THREE.Material).dispose();
    this.flareWaveMesh.geometry.dispose();
    (this.flareWaveMesh.material as THREE.Material).dispose();
    this.muzzleFlashMesh.geometry.dispose();
    (this.muzzleFlashMesh.material as THREE.Material).dispose();
    this.particleInst.geometry.dispose();
    (this.particleInst.material as THREE.Material).dispose();
    this.bloodInst.geometry.dispose();
    (this.bloodInst.material as THREE.Material).dispose();
    this.bloodDecals.forEach((d) => {
      this.scene.remove(d.mesh);
      d.geo.dispose();
      d.mat.dispose();
    });
    this.bloodDecals = [];

    this.playerBoltGeo.dispose();
    this.playerBoltMat.dispose();
    this.playerBoltTrailGeo.dispose();
    this.playerBoltTrailMat.dispose();
    this.enemyBoltGeo.dispose();
    this.enemyBoltMat.dispose();
    this.emberGeo.dispose();
    this.emberMat.dispose();
    this.woodGeo.dispose();
    this.woodMat.dispose();

    this.composer?.dispose();
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
