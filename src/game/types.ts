export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type DifficultyId = 'pilgrim' | 'warden' | 'ascendant';

export type WeaponKind = 'unarmed' | 'pistol' | 'rifle';

export type MovementStance = 'idle' | 'walk' | 'run' | 'crouch' | 'jump';

export type EnemyKind = 'stalker' | 'spitter' | 'brute';

export type LootKind = 'ember' | 'wood' | 'bandage' | 'food' | 'fal_ammo' | 'pistol_ammo';

export type WorldPropCategory = 'vehicle' | 'tank' | 'building' | 'tree' | 'foliage' | 'prop';

export type TextureTargetId = 'ground' | 'stone' | 'bark';

export type MapPresetId = 'buenos_aires' | 'custom_sandbox';

export interface RadarBlip {
  id: number;
  x: number;
  z: number;
  kind: EnemyKind;
}

export interface ModelCacheMeta {
  name: string;
  byteLength: number;
  updatedAt: number;
}

export type ZombieTargetKind = EnemyKind | 'all';

export interface ZombieModelSlot {
  id: string;
  name: string;
  byteLength: number;
  updatedAt: number;
  targetKind: ZombieTargetKind;
  spawnCount?: number;
}

export interface WorldPropSlot {
  id: string;
  category: WorldPropCategory;
  name: string;
  byteLength: number;
  updatedAt: number;
}

export interface PlacedWorldProp {
  instanceId: string;
  slotId: string;
  category: WorldPropCategory;
  name: string;
  x: number;
  yOffset: number;
  z: number;
  scale: number;
  rotationY: number;
  solid: boolean;
}

export interface MapMaterialSettings {
  mapPreset: MapPresetId;
  terrainScale: number;
  fogDensity: number;
  fogDynamic: boolean;
  dayNightEnabled: boolean;
  cycleSpeed: number;
  timeOfDay: number; // 0..1 (0 = medianoche, 0.25 = amanecer, 0.5 = mediodía, 0.75 = atardecer)
  showDefaultRuins: boolean;
  showDefaultForest: boolean;
  groundTint: string;
  groundRoughness: number;
  groundMetalness: number;
  groundRepeat: number;
  stoneTint: string;
  stoneRoughness: number;
  stoneMetalness: number;
  barkTint: string;
  barkRoughness: number;
  customGroundTexName: string | null;
  customStoneTexName: string | null;
  customBarkTexName: string | null;
}

export type PostProcessPreset = 'cinematic' | 'horror' | 'natural' | 'crisp';

export interface PostProcessSettings {
  enabled: boolean;
  preset: PostProcessPreset;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomThreshold: number;
  vignette: number;
  chromaticAberration: number;
  filmGrain: number;
  saturation: number;
  contrast: number;
  exposure: number;
}

export type ControlButtonId =
  | 'crouch'
  | 'weapon'
  | 'reload'
  | 'grenade'
  | 'aim'
  | 'jump'
  | 'fire'
  | 'heal'
  | 'eat';

export interface ControlButtonConfig {
  id: ControlButtonId;
  label: string;
  xPct: number; // 4..96 (% from left)
  yPct: number; // 12..95 (% from top)
  scale: number; // 0.65..1.65
  opacity: number; // 0.2..1.0
  visible: boolean;
}

export type TouchLayoutConfig = Record<ControlButtonId, ControlButtonConfig>;

export type CameraPresetId = 'shoulder' | 'close' | 'wide';

export interface CameraSettings {
  preset: CameraPresetId;
  normalDistance: number;
  normalFov: number;
  normalShoulderOffset: number;
  normalHeight: number;
  normalPitch: number;
  aimDistance: number;
  aimFov: number;
  aimShoulderOffset: number;
  aimHeight: number;
}

export interface HudSnapshot {
  gameState: GameState;
  hp: number;
  maxHp: number;
  weapon: WeaponKind;
  stance: MovementStance;
  isAiming: boolean;
  isReloading: boolean;
  stealthActive: boolean;
  stealthState: 'hidden' | 'caution' | 'detected';
  pistolAmmo: number;
  pistolMaxAmmo: number;
  pistolReserveAmmo: number;
  rifleAmmo: number;
  rifleMaxAmmo: number;
  rifleReserveAmmo: number;
  bandages: number;
  food: number;
  flareCharge: number; // 0..100
  wood: number;
  score: number;
  bestScore: number;
  combo: number;
  survivalTime: number;
  enemiesRemaining: number;
  alertedZombies: number;
  kills: number;
  nearCampfire: boolean;
  pointerLocked: boolean;
  playerPos: { x: number; z: number };
  playerYaw: number;
  camYaw: number;
  radarEntities: RadarBlip[];
  difficulty: DifficultyId;
  muted: boolean;
  hurtFlash: number;
  timeOfDay: number;
  isDaytime: boolean;
  clockLabel: string;
  fogLevel: number;
  editorMode: boolean;
  activePlacementSlotId: string | null;
  selectedPropId: string | null;
  propSlots: WorldPropSlot[];
  placedProps: PlacedWorldProp[];
  mapSettings: MapMaterialSettings;
  postProcess: PostProcessSettings;
  cameraSettings: CameraSettings;
  customModelName: string | null;
  customZombieName: string | null;
  customZombieSlots: ZombieModelSlot[];
  customRifleName: string | null;
  modelError: string | null;
}
