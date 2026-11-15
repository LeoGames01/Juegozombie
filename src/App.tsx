import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { StudioModal, type StudioTab } from './components/StudioModal';
import { SurvivalGameEngine } from './game/engine';
import { PLAYER_SPAWN_X, PLAYER_SPAWN_Z } from './game/models';
import { cargarTouchLayoutLocal, guardarTouchLayoutLocal } from './game/modelCache';
import {
  cloneTouchLayout,
  DEFAULT_CAMERA_SETTINGS,
  DEFAULT_MAP_SETTINGS,
  DEFAULT_POST_PROCESS,
  DEFAULT_TOUCH_LAYOUT,
} from './game/settingsDefaults';
import type {
  CameraPresetId,
  CameraSettings,
  DifficultyId,
  HudSnapshot,
  MapMaterialSettings,
  PlacedWorldProp,
  PostProcessPreset,
  PostProcessSettings,
  TextureTargetId,
  TouchLayoutConfig,
  WorldPropCategory,
  ZombieTargetKind,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  hp: 100,
  maxHp: 100,
  weapon: 'rifle',
  stance: 'idle',
  isAiming: false,
  isReloading: false,
  stealthActive: false,
  stealthState: 'hidden',
  pistolAmmo: 15,
  pistolMaxAmmo: 15,
  pistolReserveAmmo: 30,
  rifleAmmo: 30,
  rifleMaxAmmo: 30,
  rifleReserveAmmo: 60,
  bandages: 1,
  food: 1,
  flareCharge: 45,
  wood: 0,
  score: 0,
  bestScore: 0,
  combo: 1,
  survivalTime: 0,
  enemiesRemaining: 0,
  alertedZombies: 0,
  kills: 0,
  nearCampfire: true,
  pointerLocked: false,
  playerPos: { x: PLAYER_SPAWN_X, z: PLAYER_SPAWN_Z },
  playerYaw: Math.PI,
  camYaw: 0,
  radarEntities: [],
  difficulty: 'warden',
  muted: false,
  hurtFlash: 0,
  timeOfDay: DEFAULT_MAP_SETTINGS.timeOfDay,
  isDaytime: true,
  clockLabel: '08:38',
  fogLevel: 0.0172,
  editorMode: false,
  activePlacementSlotId: null,
  selectedPropId: null,
  propSlots: [],
  placedProps: [],
  mapSettings: { ...DEFAULT_MAP_SETTINGS },
  postProcess: { ...DEFAULT_POST_PROCESS },
  cameraSettings: { ...DEFAULT_CAMERA_SETTINGS },
  customModelName: null,
  customZombieName: null,
  customZombieSlots: [],
  customRifleName: null,
  modelError: null,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SurvivalGameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<StudioTab>('models');
  const [touchLayout, setTouchLayout] = useState<TouchLayoutConfig>(() => cargarTouchLayoutLocal());
  const [mobileControlsEnabled, setMobileControlsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(pointer: coarse)')?.matches ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 1024
    );
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new SurvivalGameEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleOpenStudio = (tab: StudioTab = 'models') => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (hud.gameState === 'PLAYING' && !hud.editorMode) {
      engineRef.current?.pauseGame();
    }
    setStudioTab(tab);
    setStudioOpen(true);
  };

  const handleUpdateTouchLayout = (next: TouchLayoutConfig) => {
    const cloned = cloneTouchLayout(next);
    setTouchLayout(cloned);
    guardarTouchLayoutLocal(cloned);
  };

  const handleResetTouchLayout = () => {
    const reset = cloneTouchLayout(DEFAULT_TOUCH_LAYOUT);
    setTouchLayout(reset);
    guardarTouchLayoutLocal(reset);
  };

  const handleOpenMapEditorWithSlot = (slotId: string | null) => {
    setStudioOpen(false);
    engineRef.current?.setActivePlacementSlot(slotId);
    engineRef.current?.setEditorMode(true);
  };

  const handleStart = () => {
    setStudioOpen(false);
    engineRef.current?.startNewRun();
  };
  const handleResume = () => {
    setStudioOpen(false);
    engineRef.current?.resumeGame();
  };
  const handlePause = () => engineRef.current?.pauseGame();
  const handleReturnToTitle = () => {
    setStudioOpen(false);
    engineRef.current?.returnToTitle();
  };
  const handleSelectDifficulty = (diff: DifficultyId) => engineRef.current?.setDifficulty(diff);
  const handleToggleMute = () => engineRef.current?.toggleMute();

  const handleUploadPlayerGlb = (file: File) => {
    void engineRef.current?.loadCustomGlbFile(file);
  };
  const handleResetPlayerGlb = () => {
    void engineRef.current?.resetToDefaultCharacter();
  };
  const handleUploadZombieGlbs = (files: File[]) => {
    void engineRef.current?.loadCustomZombieGlbFiles(files);
  };
  const handleUpdateZombieSlotKind = (slotId: string, targetKind: ZombieTargetKind) => {
    void engineRef.current?.setZombieSlotTargetKind(slotId, targetKind);
  };
  const handleUpdateZombieSlotCount = (slotId: string, spawnCount: number) => {
    void engineRef.current?.setZombieSlotSpawnCount(slotId, spawnCount);
  };
  const handleDeleteZombieSlot = (slotId: string) => {
    void engineRef.current?.deleteCustomZombieSlot(slotId);
  };
  const handleResetZombieGlb = () => {
    void engineRef.current?.resetToDefaultZombie();
  };
  const handleUploadRifleGlb = (file: File) => {
    void engineRef.current?.loadCustomRifleGlbFile(file);
  };
  const handleResetRifleGlb = () => {
    void engineRef.current?.resetToDefaultRifle();
  };

  const handleUploadWorldPropGlb = (category: WorldPropCategory, file: File) => {
    void engineRef.current?.uploadWorldPropGlb(category, file);
  };
  const handleDeleteWorldPropSlot = (slotId: string) => {
    void engineRef.current?.deleteWorldPropSlot(slotId);
  };
  const handlePlaceWorldPropNearPlayer = (slotId: string) => {
    engineRef.current?.placeWorldPropNearPlayer(slotId);
  };
  const handleSelectPlacedProp = (instanceId: string | null) => {
    engineRef.current?.selectPlacedProp(instanceId);
  };
  const handleUpdatePlacedProp = (instanceId: string, patch: Partial<PlacedWorldProp>) => {
    engineRef.current?.updatePlacedProp(instanceId, patch);
  };
  const handleDuplicatePlacedProp = (instanceId: string) => {
    engineRef.current?.duplicatePlacedProp(instanceId);
  };
  const handleRemovePlacedProp = (instanceId: string) => {
    engineRef.current?.removePlacedProp(instanceId);
  };
  const handleClearAllPlacedProps = () => {
    engineRef.current?.clearAllPlacedProps();
  };

  const handleUpdateMapSettings = (patch: Partial<MapMaterialSettings>) => {
    engineRef.current?.setMapSettings(patch);
  };
  const handleUploadTexture = (target: TextureTargetId, file: File) => {
    void engineRef.current?.loadCustomTextureFile(target, file);
  };
  const handleResetTexture = (target: TextureTargetId) => {
    void engineRef.current?.resetCustomTexture(target);
  };

  const handleUpdatePostProcess = (patch: Partial<PostProcessSettings>) => {
    engineRef.current?.setPostProcessSettings(patch);
  };
  const handleSelectPostProcessPreset = (preset: PostProcessPreset) => {
    engineRef.current?.applyPostProcessPreset(preset);
  };

  const handleUpdateCameraSettings = (patch: Partial<CameraSettings>) => {
    engineRef.current?.setCameraSettings(patch);
  };
  const handleSelectCameraPreset = (preset: CameraPresetId) => {
    engineRef.current?.applyCameraPreset(preset);
  };
  const handleResetCameraSettings = () => {
    engineRef.current?.resetCameraSettings();
  };
  const handleSetCameraPreview = useCallback((active: boolean, aim = false) => {
    engineRef.current?.setCameraPreview(active, aim);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b0e14]">
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      <GameHud
        hud={hud}
        touchLayout={touchLayout}
        mobileControlsEnabled={mobileControlsEnabled}
        studioOpen={studioOpen}
        onToggleMobileControls={() => setMobileControlsEnabled((prev) => !prev)}
        onMobileMove={(x, y, sprint) => engineRef.current?.setVirtualMove(x, y, sprint)}
        onMobileCameraVelocity={(yawVel, pitchVel) =>
          engineRef.current?.setVirtualCameraVelocity(yawVel, pitchVel)
        }
        onMobileRotateCamera={(dyaw, dpitch) => engineRef.current?.rotateCameraBy(dyaw, dpitch)}
        onMobileCenterCamera={() => engineRef.current?.centerCameraBehindPlayer()}
        onMobileFireChange={(active) => engineRef.current?.setVirtualFire(active)}
        onMobileAimChange={(active) => engineRef.current?.setVirtualAim(active)}
        onMobileJump={() => engineRef.current?.triggerJump()}
        onMobileToggleCrouch={() => engineRef.current?.toggleCrouch()}
        onMobileReload={() => engineRef.current?.triggerReload()}
        onMobileGrenade={() => engineRef.current?.triggerGrenade()}
        onMobileCycleWeapon={() => engineRef.current?.cycleWeapon()}
        onUseBandage={() => engineRef.current?.useBandage()}
        onUseFood={() => engineRef.current?.useFood()}
        onStart={handleStart}
        onResume={handleResume}
        onPause={handlePause}
        onReturnToTitle={handleReturnToTitle}
        onSelectDifficulty={handleSelectDifficulty}
        onToggleMute={handleToggleMute}
        onOpenStudio={handleOpenStudio}
        onExitEditorMode={() => engineRef.current?.setEditorMode(false)}
        onSelectPlacementSlot={(slotId) => engineRef.current?.setActivePlacementSlot(slotId)}
        onPlacePropNearPlayer={handlePlaceWorldPropNearPlayer}
        onUpdatePlacedProp={handleUpdatePlacedProp}
        onDuplicatePlacedProp={handleDuplicatePlacedProp}
        onRemovePlacedProp={handleRemovePlacedProp}
        onClearAllPlacedProps={handleClearAllPlacedProps}
        onUpdateMapSettings={handleUpdateMapSettings}
        onUploadWorldPropGlb={handleUploadWorldPropGlb}
        onUploadTexture={handleUploadTexture}
      />

      {studioOpen && (
        <StudioModal
          open={studioOpen}
          initialTab={studioTab}
          hud={hud}
          touchLayout={touchLayout}
          onClose={() => setStudioOpen(false)}
          onUploadPlayerGlb={handleUploadPlayerGlb}
          onResetPlayerGlb={handleResetPlayerGlb}
          onUploadZombieGlbs={handleUploadZombieGlbs}
          onUpdateZombieSlotKind={handleUpdateZombieSlotKind}
          onUpdateZombieSlotCount={handleUpdateZombieSlotCount}
          onDeleteZombieSlot={handleDeleteZombieSlot}
          onResetZombieGlb={handleResetZombieGlb}
          onUploadRifleGlb={handleUploadRifleGlb}
          onResetRifleGlb={handleResetRifleGlb}
          onUploadWorldPropGlb={handleUploadWorldPropGlb}
          onDeleteWorldPropSlot={handleDeleteWorldPropSlot}
          onPlaceWorldPropNearPlayer={handlePlaceWorldPropNearPlayer}
          onOpenMapEditorWithSlot={handleOpenMapEditorWithSlot}
          onSelectPlacedProp={handleSelectPlacedProp}
          onUpdatePlacedProp={handleUpdatePlacedProp}
          onDuplicatePlacedProp={handleDuplicatePlacedProp}
          onRemovePlacedProp={handleRemovePlacedProp}
          onClearAllPlacedProps={handleClearAllPlacedProps}
          onUpdateMapSettings={handleUpdateMapSettings}
          onUploadTexture={handleUploadTexture}
          onResetTexture={handleResetTexture}
          onUpdatePostProcess={handleUpdatePostProcess}
          onSelectPostProcessPreset={handleSelectPostProcessPreset}
          onUpdateCameraSettings={handleUpdateCameraSettings}
          onSelectCameraPreset={handleSelectCameraPreset}
          onResetCameraSettings={handleResetCameraSettings}
          onSetCameraPreview={handleSetCameraPreview}
          onUpdateTouchLayout={handleUpdateTouchLayout}
          onResetTouchLayout={handleResetTouchLayout}
        />
      )}
    </main>
  );
}
