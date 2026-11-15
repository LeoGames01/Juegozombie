import {
  cloneTouchLayout,
  DEFAULT_CAMERA_SETTINGS,
  DEFAULT_MAP_SETTINGS,
  DEFAULT_POST_PROCESS,
  DEFAULT_TOUCH_LAYOUT,
  sanitizePlacedProps,
} from './settingsDefaults';
import type {
  CameraSettings,
  MapMaterialSettings,
  ModelCacheMeta,
  PlacedWorldProp,
  PostProcessSettings,
  TextureTargetId,
  TouchLayoutConfig,
  WorldPropCategory,
  WorldPropSlot,
  ZombieModelSlot,
  ZombieTargetKind,
} from './types';

// Configuración de IndexedDB para guardar modelos .glb, objetos del mapa y texturas de forma permanente
export const DB_NAME = 'SurvivalGameDB';
export const STORE_NAME = 'assets';
export const MODEL_KEY = 'meshy_character_glb';
const META_KEY = 'meshy_character_meta';

export const ZOMBIE_MODEL_KEY = 'meshy_zombie_glb';
const ZOMBIE_META_KEY = 'meshy_zombie_meta';
const ZOMBIE_SLOTS_META_KEY = 'meshy_zombies_slots_v1';
const ZOMBIE_BUFFER_PREFIX = 'meshy_zombie_glb_';

export const RIFLE_MODEL_KEY = 'meshy_rifle_glb';
const RIFLE_META_KEY = 'meshy_rifle_meta';

const PROP_SLOTS_META_KEY = 'world_prop_slots_meta_v1';
const PROP_BUFFER_PREFIX = 'world_prop_glb_';
const PLACED_PROPS_KEY = 'world_placed_props_v1';

const TEXTURE_META_PREFIX = 'custom_tex_meta_';
const TEXTURE_BUF_PREFIX = 'custom_tex_buf_';

const MAP_SETTINGS_STORAGE_KEY = 'zonacero_map_settings_v1';
const POST_PROCESS_STORAGE_KEY = 'zonacero_postprocess_v1';
const TOUCH_LAYOUT_STORAGE_KEY = 'zonacero_touch_layout_v1';
const CAMERA_SETTINGS_STORAGE_KEY = 'zonacero_camera_settings_v1';

let cachedDbPromise: Promise<IDBDatabase> | null = null;

export function abrirBaseDeDatos(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (cachedDbPromise) {
    return cachedDbPromise;
  }
  cachedDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      db.onclose = () => {
        cachedDbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        cachedDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = (e) => {
      cachedDbPromise = null;
      reject((e.target as IDBOpenDBRequest).error);
    };
    request.onblocked = () => {
      cachedDbPromise = null;
    };
  });
  return cachedDbPromise;
}

export async function guardarModeloCache(
  arrayBuffer: ArrayBuffer,
  fileName = 'custom_character.glb',
): Promise<void> {
  const db = await abrirBaseDeDatos();
  const meta: ModelCacheMeta = {
    name: fileName,
    byteLength: arrayBuffer.byteLength,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, MODEL_KEY);
    store.put(meta, META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

export async function cargarModeloCache(): Promise<ArrayBuffer | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MODEL_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) || null);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch {
    return null;
  }
}

export async function cargarModeloMeta(): Promise<ModelCacheMeta | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(META_KEY);
      req.onsuccess = () => resolve((req.result as ModelCacheMeta | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function eliminarModeloCache(): Promise<void> {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(MODEL_KEY);
      store.delete(META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function guardarZombieCache(
  arrayBuffer: ArrayBuffer,
  fileName = 'custom_zombie.glb',
): Promise<void> {
  const db = await abrirBaseDeDatos();
  const meta: ModelCacheMeta = {
    name: fileName,
    byteLength: arrayBuffer.byteLength,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, ZOMBIE_MODEL_KEY);
    store.put(meta, ZOMBIE_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

export async function cargarZombieCache(): Promise<ArrayBuffer | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(ZOMBIE_MODEL_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) || null);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch {
    return null;
  }
}

export async function cargarZombieMeta(): Promise<ModelCacheMeta | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(ZOMBIE_META_KEY);
      req.onsuccess = () => resolve((req.result as ModelCacheMeta | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function eliminarZombieCache(): Promise<void> {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(ZOMBIE_MODEL_KEY);
      store.delete(ZOMBIE_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function listarZombieSlotsCache(): Promise<ZombieModelSlot[]> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(ZOMBIE_SLOTS_META_KEY);
      req.onsuccess = () => {
        const list = req.result;
        if (!Array.isArray(list)) {
          resolve([]);
          return;
        }
        resolve(
          (list as ZombieModelSlot[]).map((s) => ({
            ...s,
            spawnCount:
              typeof s.spawnCount === 'number' && Number.isFinite(s.spawnCount)
                ? Math.max(0, Math.min(25, Math.round(s.spawnCount)))
                : 4,
          })),
        );
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function guardarZombieSlotCache(
  slotId: string,
  arrayBuffer: ArrayBuffer,
  fileName: string,
  targetKind: ZombieTargetKind = 'all',
  spawnCount = 4,
): Promise<ZombieModelSlot[]> {
  const existing = await listarZombieSlotsCache();
  const nextSlot: ZombieModelSlot = {
    id: slotId,
    name: fileName,
    byteLength: arrayBuffer.byteLength,
    updatedAt: Date.now(),
    targetKind,
    spawnCount: Math.max(0, Math.min(25, Math.round(spawnCount))),
  };
  const nextList = [...existing.filter((s) => s.id !== slotId), nextSlot];
  const db = await abrirBaseDeDatos();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, `${ZOMBIE_BUFFER_PREFIX}${slotId}`);
    store.put(nextList, ZOMBIE_SLOTS_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
  return nextList;
}

export async function guardarZombieSlotsBatchCache(
  items: Array<{
    slotId: string;
    arrayBuffer: ArrayBuffer;
    fileName: string;
    targetKind?: ZombieTargetKind;
    spawnCount?: number;
  }>,
): Promise<ZombieModelSlot[]> {
  if (items.length === 0) return listarZombieSlotsCache();
  const existing = await listarZombieSlotsCache();
  const itemIds = new Set(items.map((it) => it.slotId));
  const now = Date.now();
  const nextSlots: ZombieModelSlot[] = items.map((it, idx) => ({
    id: it.slotId,
    name: it.fileName,
    byteLength: it.arrayBuffer.byteLength,
    updatedAt: now + idx,
    targetKind: it.targetKind ?? 'all',
    spawnCount: Math.max(0, Math.min(25, Math.round(it.spawnCount ?? 4))),
  }));
  const nextList = [...existing.filter((s) => !itemIds.has(s.id)), ...nextSlots];
  const db = await abrirBaseDeDatos();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    items.forEach((it) => {
      store.put(it.arrayBuffer, `${ZOMBIE_BUFFER_PREFIX}${it.slotId}`);
    });
    store.put(nextList, ZOMBIE_SLOTS_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
  return nextList;
}

export async function cargarZombieSlotBuffer(slotId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(`${ZOMBIE_BUFFER_PREFIX}${slotId}`);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cargarZombieSlotBuffers(slotIds: string[]): Promise<Map<string, ArrayBuffer>> {
  const result = new Map<string, ArrayBuffer>();
  if (slotIds.length === 0) return result;
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      slotIds.forEach((slotId) => {
        const req = store.get(`${ZOMBIE_BUFFER_PREFIX}${slotId}`);
        req.onsuccess = () => {
          if (req.result) {
            result.set(slotId, req.result as ArrayBuffer);
          }
        };
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}

export async function actualizarZombieSlotTargetCache(
  slotId: string,
  targetKind: ZombieTargetKind,
): Promise<ZombieModelSlot[]> {
  const existing = await listarZombieSlotsCache();
  const nextList = existing.map((s) => (s.id === slotId ? { ...s, targetKind } : s));
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(nextList, ZOMBIE_SLOTS_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
  return nextList;
}

export async function actualizarZombieSlotCountCache(
  slotId: string,
  spawnCount: number,
): Promise<ZombieModelSlot[]> {
  const clamped = Math.max(0, Math.min(25, Math.round(spawnCount)));
  const existing = await listarZombieSlotsCache();
  const nextList = existing.map((s) => (s.id === slotId ? { ...s, spawnCount: clamped } : s));
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(nextList, ZOMBIE_SLOTS_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
  return nextList;
}

export async function eliminarZombieSlotCache(slotId: string): Promise<ZombieModelSlot[]> {
  const existing = await listarZombieSlotsCache();
  const nextList = existing.filter((s) => s.id !== slotId);
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(`${ZOMBIE_BUFFER_PREFIX}${slotId}`);
      store.put(nextList, ZOMBIE_SLOTS_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
  return nextList;
}

export async function limpiarTodosZombiesCache(): Promise<void> {
  const existing = await listarZombieSlotsCache();
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(ZOMBIE_MODEL_KEY);
      store.delete(ZOMBIE_META_KEY);
      store.delete(ZOMBIE_SLOTS_META_KEY);
      existing.forEach((s) => store.delete(`${ZOMBIE_BUFFER_PREFIX}${s.id}`));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function guardarRifleCache(
  arrayBuffer: ArrayBuffer,
  fileName = 'custom_rifle.glb',
): Promise<void> {
  const db = await abrirBaseDeDatos();
  const meta: ModelCacheMeta = {
    name: fileName,
    byteLength: arrayBuffer.byteLength,
    updatedAt: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, RIFLE_MODEL_KEY);
    store.put(meta, RIFLE_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

export async function cargarRifleCache(): Promise<ArrayBuffer | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RIFLE_MODEL_KEY);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) || null);
      req.onerror = (e) => reject((e.target as IDBRequest).error);
    });
  } catch {
    return null;
  }
}

export async function cargarRifleMeta(): Promise<ModelCacheMeta | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RIFLE_META_KEY);
      req.onsuccess = () => resolve((req.result as ModelCacheMeta | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function eliminarRifleCache(): Promise<void> {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(RIFLE_MODEL_KEY);
      store.delete(RIFLE_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

// --- SLOTS DE MODELOS 3D DE ENTORNO (.GLB: autos, tanques, edificaciones, árboles, follaje, props) ---

export async function listarPropSlotsCache(): Promise<WorldPropSlot[]> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PROP_SLOTS_META_KEY);
      req.onsuccess = () => {
        const list = req.result;
        resolve(Array.isArray(list) ? (list as WorldPropSlot[]) : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function guardarPropSlotCache(
  slotId: string,
  category: WorldPropCategory,
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<WorldPropSlot[]> {
  const existing = await listarPropSlotsCache();
  const nextSlot: WorldPropSlot = {
    id: slotId,
    category,
    name: fileName,
    byteLength: arrayBuffer.byteLength,
    updatedAt: Date.now(),
  };
  const nextList = [...existing.filter((s) => s.id !== slotId), nextSlot];
  const db = await abrirBaseDeDatos();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(arrayBuffer, `${PROP_BUFFER_PREFIX}${slotId}`);
    store.put(nextList, PROP_SLOTS_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
  return nextList;
}

export async function cargarPropSlotBuffer(slotId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(`${PROP_BUFFER_PREFIX}${slotId}`);
      req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function cargarPropSlotBuffers(slotIds: string[]): Promise<Map<string, ArrayBuffer>> {
  const result = new Map<string, ArrayBuffer>();
  if (slotIds.length === 0) return result;
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      slotIds.forEach((slotId) => {
        const req = store.get(`${PROP_BUFFER_PREFIX}${slotId}`);
        req.onsuccess = () => {
          if (req.result) {
            result.set(slotId, req.result as ArrayBuffer);
          }
        };
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(result);
    });
  } catch {
    return result;
  }
}

export async function eliminarPropSlotCache(slotId: string): Promise<WorldPropSlot[]> {
  const existing = await listarPropSlotsCache();
  const nextList = existing.filter((s) => s.id !== slotId);
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(`${PROP_BUFFER_PREFIX}${slotId}`);
      store.put(nextList, PROP_SLOTS_META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
  return nextList;
}

export async function guardarPlacedPropsCache(props: PlacedWorldProp[]): Promise<void> {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(props, PLACED_PROPS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
}

export async function cargarPlacedPropsCache(): Promise<PlacedWorldProp[]> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PLACED_PROPS_KEY);
      req.onsuccess = () => resolve(sanitizePlacedProps(req.result));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// --- TEXTURAS IMPORTADAS PERSONALIZADAS (.png / .jpg / .webp) ---

export interface CachedTextureRecord {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

export async function guardarTextureCache(
  target: TextureTargetId,
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
): Promise<void> {
  const db = await abrirBaseDeDatos();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(buffer, `${TEXTURE_BUF_PREFIX}${target}`);
    store.put({ name: fileName, mimeType }, `${TEXTURE_META_PREFIX}${target}`);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as IDBTransaction).error);
  });
}

export async function cargarTextureCache(
  target: TextureTargetId,
): Promise<CachedTextureRecord | null> {
  try {
    const db = await abrirBaseDeDatos();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const reqBuf = store.get(`${TEXTURE_BUF_PREFIX}${target}`);
      const reqMeta = store.get(`${TEXTURE_META_PREFIX}${target}`);
      let buf: ArrayBuffer | undefined;
      let meta: { name: string; mimeType: string } | undefined;
      reqBuf.onsuccess = () => {
        buf = reqBuf.result as ArrayBuffer | undefined;
      };
      reqMeta.onsuccess = () => {
        meta = reqMeta.result as { name: string; mimeType: string } | undefined;
      };
      tx.oncomplete = () => {
        if (buf && meta) {
          resolve({ name: meta.name, mimeType: meta.mimeType, buffer: buf });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function eliminarTextureCache(target: TextureTargetId): Promise<void> {
  try {
    const db = await abrirBaseDeDatos();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(`${TEXTURE_BUF_PREFIX}${target}`);
      store.delete(`${TEXTURE_META_PREFIX}${target}`);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject((e.target as IDBTransaction).error);
    });
  } catch {
    // Ignore
  }
}

// --- PREFERENCIAS PERSISTENTES (MAPA, POSTPROCESADO, CONTROLES) ---

export function cargarMapSettingsLocal(): MapMaterialSettings {
  try {
    const raw = localStorage.getItem(MAP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MAP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<MapMaterialSettings>;
    return { ...DEFAULT_MAP_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_MAP_SETTINGS };
  }
}

export function guardarMapSettingsLocal(settings: MapMaterialSettings): void {
  try {
    localStorage.setItem(MAP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function cargarPostProcessLocal(): PostProcessSettings {
  try {
    const raw = localStorage.getItem(POST_PROCESS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_POST_PROCESS };
    const parsed = JSON.parse(raw) as Partial<PostProcessSettings>;
    return { ...DEFAULT_POST_PROCESS, ...parsed };
  } catch {
    return { ...DEFAULT_POST_PROCESS };
  }
}

export function guardarPostProcessLocal(settings: PostProcessSettings): void {
  try {
    localStorage.setItem(POST_PROCESS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function cargarTouchLayoutLocal(): TouchLayoutConfig {
  try {
    const raw = localStorage.getItem(TOUCH_LAYOUT_STORAGE_KEY);
    if (!raw) return cloneTouchLayout(DEFAULT_TOUCH_LAYOUT);
    const parsed = JSON.parse(raw) as TouchLayoutConfig;
    return cloneTouchLayout(parsed);
  } catch {
    return cloneTouchLayout(DEFAULT_TOUCH_LAYOUT);
  }
}

export function guardarTouchLayoutLocal(layout: TouchLayoutConfig): void {
  try {
    localStorage.setItem(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore
  }
}

export function cargarCameraSettingsLocal(): CameraSettings {
  try {
    const raw = localStorage.getItem(CAMERA_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CAMERA_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<CameraSettings>;
    return { ...DEFAULT_CAMERA_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_CAMERA_SETTINGS };
  }
}

export function guardarCameraSettingsLocal(settings: CameraSettings): void {
  try {
    localStorage.setItem(CAMERA_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}
