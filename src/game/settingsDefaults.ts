import type {
  CameraPresetId,
  CameraSettings,
  ControlButtonId,
  MapMaterialSettings,
  PlacedWorldProp,
  PostProcessPreset,
  PostProcessSettings,
  TouchLayoutConfig,
  WorldPropCategory,
} from './types';

export const DEFAULT_MAP_SETTINGS: MapMaterialSettings = {
  mapPreset: 'buenos_aires',
  terrainScale: 1.0,
  fogDensity: 1.0,
  fogDynamic: true,
  dayNightEnabled: true,
  cycleSpeed: 1.0,
  timeOfDay: 0.36, // Mañana despejada (~08:38) para experimentar el ciclo completo día/noche
  showDefaultRuins: true,
  showDefaultForest: true,
  groundTint: '#ffffff',
  groundRoughness: 0.92,
  groundMetalness: 0.05,
  groundRepeat: 18,
  stoneTint: '#ffffff',
  stoneRoughness: 0.88,
  stoneMetalness: 0.1,
  barkTint: '#5c4635',
  barkRoughness: 0.92,
  customGroundTexName: null,
  customStoneTexName: null,
  customBarkTexName: null,
};

export const POST_PROCESS_PRESETS: Record<
  PostProcessPreset,
  Omit<PostProcessSettings, 'enabled' | 'preset'>
> = {
  cinematic: {
    bloomEnabled: true,
    bloomStrength: 0.42,
    bloomThreshold: 0.82,
    vignette: 0.28,
    chromaticAberration: 0.14,
    filmGrain: 0.06,
    saturation: 1.06,
    contrast: 1.04,
    exposure: 1.16,
  },
  horror: {
    bloomEnabled: true,
    bloomStrength: 0.62,
    bloomThreshold: 0.72,
    vignette: 0.55,
    chromaticAberration: 0.32,
    filmGrain: 0.18,
    saturation: 0.84,
    contrast: 1.14,
    exposure: 1.04,
  },
  natural: {
    bloomEnabled: true,
    bloomStrength: 0.22,
    bloomThreshold: 0.9,
    vignette: 0.12,
    chromaticAberration: 0,
    filmGrain: 0,
    saturation: 1.02,
    contrast: 1.0,
    exposure: 1.15,
  },
  crisp: {
    bloomEnabled: false,
    bloomStrength: 0,
    bloomThreshold: 0.95,
    vignette: 0.05,
    chromaticAberration: 0,
    filmGrain: 0,
    saturation: 1.08,
    contrast: 1.08,
    exposure: 1.18,
  },
};

export const DEFAULT_POST_PROCESS: PostProcessSettings = {
  enabled: true,
  preset: 'cinematic',
  ...POST_PROCESS_PRESETS.cinematic,
};

export const CAMERA_PRESETS: Record<CameraPresetId, Omit<CameraSettings, 'preset'>> = {
  shoulder: {
    normalDistance: 4.05,
    normalFov: 54,
    normalShoulderOffset: 0.38,
    normalHeight: 1.5,
    normalPitch: 0.2,
    aimDistance: 1.56,
    aimFov: 38,
    aimShoulderOffset: 0.54,
    aimHeight: 1.53,
  },
  close: {
    normalDistance: 2.85,
    normalFov: 48,
    normalShoulderOffset: 0.48,
    normalHeight: 1.54,
    normalPitch: 0.16,
    aimDistance: 1.18,
    aimFov: 30,
    aimShoulderOffset: 0.58,
    aimHeight: 1.56,
  },
  wide: {
    normalDistance: 5.5,
    normalFov: 62,
    normalShoulderOffset: 0.22,
    normalHeight: 1.62,
    normalPitch: 0.26,
    aimDistance: 1.95,
    aimFov: 44,
    aimShoulderOffset: 0.46,
    aimHeight: 1.52,
  },
};

export const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  preset: 'shoulder',
  ...CAMERA_PRESETS.shoulder,
};

export const DEFAULT_TOUCH_LAYOUT: TouchLayoutConfig = {
  crouch: {
    id: 'crouch',
    label: 'Sigilo / Agachar',
    xPct: 6,
    yPct: 91,
    scale: 1,
    opacity: 0.92,
    visible: true,
  },
  heal: {
    id: 'heal',
    label: 'Vendaje',
    xPct: 14,
    yPct: 91,
    scale: 0.95,
    opacity: 0.92,
    visible: true,
  },
  eat: {
    id: 'eat',
    label: 'Comida',
    xPct: 22,
    yPct: 91,
    scale: 0.95,
    opacity: 0.92,
    visible: true,
  },
  weapon: {
    id: 'weapon',
    label: 'Cambiar Arma',
    xPct: 71,
    yPct: 74,
    scale: 1,
    opacity: 0.92,
    visible: true,
  },
  reload: {
    id: 'reload',
    label: 'Recargar',
    xPct: 82,
    yPct: 74,
    scale: 1,
    opacity: 0.92,
    visible: true,
  },
  grenade: {
    id: 'grenade',
    label: 'Granada',
    xPct: 91,
    yPct: 74,
    scale: 1,
    opacity: 0.92,
    visible: true,
  },
  aim: {
    id: 'aim',
    label: 'Apuntar',
    xPct: 70,
    yPct: 88,
    scale: 1,
    opacity: 0.95,
    visible: true,
  },
  jump: {
    id: 'jump',
    label: 'Saltar',
    xPct: 80,
    yPct: 88,
    scale: 1,
    opacity: 0.95,
    visible: true,
  },
  fire: {
    id: 'fire',
    label: 'Disparar / Golpe',
    xPct: 91,
    yPct: 87,
    scale: 1.05,
    opacity: 0.98,
    visible: true,
  },
};

export const CONTROL_BUTTON_ORDER: ControlButtonId[] = [
  'fire',
  'aim',
  'jump',
  'crouch',
  'weapon',
  'reload',
  'grenade',
  'heal',
  'eat',
];

export const PROP_CATEGORIES: {
  id: WorldPropCategory;
  label: string;
  solidDefault: boolean;
}[] = [
  { id: 'vehicle', label: 'Autos y Vehículos', solidDefault: true },
  { id: 'tank', label: 'Tanques de Fierro', solidDefault: true },
  { id: 'building', label: 'Edificaciones', solidDefault: true },
  { id: 'tree', label: 'Árboles', solidDefault: true },
  { id: 'foliage', label: 'Follaje y Maleza', solidDefault: false },
  { id: 'prop', label: 'Otros Objetos', solidDefault: true },
];

export function cloneTouchLayout(src: TouchLayoutConfig): TouchLayoutConfig {
  const copy = {} as TouchLayoutConfig;
  (Object.keys(DEFAULT_TOUCH_LAYOUT) as ControlButtonId[]).forEach((key) => {
    const base = DEFAULT_TOUCH_LAYOUT[key];
    const entry = src?.[key];
    copy[key] = {
      ...base,
      ...(entry ?? {}),
      id: key,
      label: base.label,
    };
  });
  return copy;
}

export function sanitizePlacedProps(raw: unknown): PlacedWorldProp[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PlacedWorldProp =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as PlacedWorldProp).instanceId === 'string' &&
      typeof (item as PlacedWorldProp).slotId === 'string' &&
      Number.isFinite((item as PlacedWorldProp).x) &&
      Number.isFinite((item as PlacedWorldProp).z),
  );
}
