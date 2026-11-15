import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bandage,
  Check,
  Copy,
  Crosshair,
  Gamepad2,
  Hand,
  Image as ImageIcon,
  Layers,
  Moon,
  Package,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sliders,
  Sun,
  Trash2,
  Upload,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PROP_CATEGORIES } from '../game/settingsDefaults';
import type {
  DifficultyId,
  HudSnapshot,
  MapMaterialSettings,
  PlacedWorldProp,
  TextureTargetId,
  TouchLayoutConfig,
  WorldPropCategory,
} from '../game/types';
import { MiniMap } from './MiniMap';
import { MobileControls } from './MobileControls';
import type { StudioTab } from './StudioModal';

interface GameHudProps {
  hud: HudSnapshot;
  touchLayout: TouchLayoutConfig;
  mobileControlsEnabled: boolean;
  studioOpen?: boolean;
  onToggleMobileControls: () => void;
  onMobileMove: (x: number, y: number, sprint?: boolean) => void;
  onMobileCameraVelocity: (yawVel: number, pitchVel: number) => void;
  onMobileRotateCamera: (deltaYaw: number, deltaPitch: number) => void;
  onMobileCenterCamera: () => void;
  onMobileFireChange: (active: boolean) => void;
  onMobileAimChange: (active: boolean) => void;
  onMobileJump: () => void;
  onMobileToggleCrouch: () => void;
  onMobileReload: () => void;
  onMobileGrenade: () => void;
  onMobileCycleWeapon: () => void;
  onUseBandage: () => void;
  onUseFood: () => void;
  onStart: () => void;
  onResume: () => void;
  onPause: () => void;
  onReturnToTitle: () => void;
  onSelectDifficulty: (diff: DifficultyId) => void;
  onToggleMute: () => void;
  onOpenStudio: (tab?: StudioTab) => void;
  onExitEditorMode: () => void;
  onSelectPlacementSlot: (slotId: string | null) => void;
  onPlacePropNearPlayer: (slotId: string) => void;
  onUpdatePlacedProp: (instanceId: string, patch: Partial<PlacedWorldProp>) => void;
  onDuplicatePlacedProp: (instanceId: string) => void;
  onRemovePlacedProp: (instanceId: string) => void;
  onClearAllPlacedProps: () => void;
  onUpdateMapSettings: (patch: Partial<MapMaterialSettings>) => void;
  onUploadWorldPropGlb: (category: WorldPropCategory, file: File) => void;
  onUploadTexture: (target: TextureTargetId, file: File) => void;
}

const DIFFICULTIES: { id: DifficultyId; label: string; detail: string }[] = [
  { id: 'pilgrim', label: 'Superviviente', detail: '125 HP · Moderado' },
  { id: 'warden', label: 'Veterano', detail: '100 HP · Equilibrado' },
  { id: 'ascendant', label: 'Pesadilla', detail: '85 HP · Horda Feroz' },
];

function formatSurvivalTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  touchLayout,
  mobileControlsEnabled,
  studioOpen = false,
  onToggleMobileControls,
  onMobileMove,
  onMobileCameraVelocity,
  onMobileRotateCamera,
  onMobileCenterCamera,
  onMobileFireChange,
  onMobileAimChange,
  onMobileJump,
  onMobileToggleCrouch,
  onMobileReload,
  onMobileGrenade,
  onMobileCycleWeapon,
  onUseBandage,
  onUseFood,
  onStart,
  onResume,
  onPause,
  onReturnToTitle,
  onSelectDifficulty,
  onToggleMute,
  onOpenStudio,
  onExitEditorMode,
  onSelectPlacementSlot,
  onPlacePropNearPlayer,
  onUpdatePlacedProp,
  onDuplicatePlacedProp,
  onRemovePlacedProp,
  onClearAllPlacedProps,
  onUpdateMapSettings,
  onUploadWorldPropGlb,
  onUploadTexture,
}) => {
  const [canDismissDeath, setCanDismissDeath] = useState(false);
  const [editorPropCategory, setEditorPropCategory] = useState<WorldPropCategory>('building');
  const editorGlbRef = useRef<HTMLInputElement>(null);
  const editorGroundTexRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hud.gameState !== 'GAME_OVER') {
      setCanDismissDeath(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setCanDismissDeath(true);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [hud.gameState]);

  const hpRatio = Math.max(0, Math.min(1, hud.hp / Math.max(1, hud.maxHp)));
  const hpPct = hpRatio * 100;
  const missingHpRatio = 1 - hpRatio;
  const flareReady = hud.flareCharge >= 100;
  const activeAmmo = hud.weapon === 'pistol' ? hud.pistolAmmo : hud.rifleAmmo;
  const activeMaxAmmo = hud.weapon === 'pistol' ? hud.pistolMaxAmmo : hud.rifleMaxAmmo;
  const activeReserve = hud.weapon === 'pistol' ? hud.pistolReserveAmmo : hud.rifleReserveAmmo;

  const hurtFlicker =
    hud.hurtFlash > 0
      ? (0.45 + 0.55 * Math.abs(Math.sin(hud.hurtFlash * Math.PI * 3.5))) * hud.hurtFlash
      : 0;
  const lowHpEdgeIntensity = missingHpRatio > 0.12 ? Math.pow(missingHpRatio, 1.35) * 0.58 : 0;
  const flashEdgeIntensity = hurtFlicker * (0.42 + missingHpRatio * 0.55);
  const vignetteOpacity =
    hud.gameState === 'PLAYING' && !hud.editorMode
      ? Math.min(0.95, lowHpEdgeIntensity + flashEdgeIntensity)
      : 0;

  const crosshairGap = hud.isAiming
    ? 5
    : hud.stance === 'run' || hud.stance === 'jump'
      ? 16
      : hud.stance === 'crouch'
        ? 7
        : 10;

  const selectedProp =
    hud.placedProps.find((p) => p.instanceId === hud.selectedPropId) ?? null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* VIÑETA ROJA DE DAÑO EN LOS BORDES */}
      {vignetteOpacity > 0.01 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-75"
          style={{
            opacity: vignetteOpacity,
            background:
              'radial-gradient(circle at 50% 50%, rgba(185, 28, 28, 0) 44%, rgba(220, 38, 38, 0.38) 76%, rgba(153, 27, 27, 0.92) 100%)',
            boxShadow: `inset 0 0 ${Math.round(55 + missingHpRatio * 75)}px rgba(220, 38, 38, ${
              0.35 + missingHpRatio * 0.45
            })`,
          }}
        />
      )}

      {/* EDITOR 3D DEL MAPA (MODO INTERACTIVO) */}
      {hud.editorMode && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5">
          <input
            ref={editorGlbRef}
            type="file"
            accept=".glb"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadWorldPropGlb(editorPropCategory, f);
              e.target.value = '';
            }}
          />
          <input
            ref={editorGroundTexRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadTexture('ground', f);
              e.target.value = '';
            }}
          />

          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/35 bg-[#090c12]/88 px-4 py-2.5 shadow-xl">
            <div className="text-xs text-slate-200">
              <span className="font-semibold text-sky-300">Editor 3D del Mapa:</span>{' '}
              Clic izquierdo coloca objeto · Arrastra para mover · Clic derecho / Shift orbita · WASD mueve cámara · Rueda hace zoom
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-white/15 bg-slate-950/80 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => onUpdateMapSettings({ mapPreset: 'buenos_aires' })}
                  className={`rounded-md px-2.5 py-1 font-medium cursor-pointer transition-colors ${
                    hud.mapSettings.mapPreset === 'buenos_aires'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Av. 9 de Julio
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateMapSettings({ mapPreset: 'custom_sandbox' })}
                  className={`rounded-md px-2.5 py-1 font-medium cursor-pointer transition-colors ${
                    hud.mapSettings.mapPreset === 'custom_sandbox'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Terreno Simple
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenStudio('map')}
                className="rounded-lg border border-white/15 bg-slate-800/75 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-amber-400/60 cursor-pointer"
              >
                Estudio
              </button>
              <button
                type="button"
                onClick={onExitEditorMode}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Listo</span>
              </button>
            </div>
          </div>

          <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-xl border border-white/15 bg-[#090c12]/88 p-3.5 shadow-2xl space-y-2.5">
            {/* Quick import row for building custom maps directly from simple terrain */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-medium">
                <Layers className="h-3.5 w-3.5" />
                <span>Construcción rápida:</span>
              </div>
              <select
                value={editorPropCategory}
                onChange={(e) => setEditorPropCategory(e.target.value as WorldPropCategory)}
                className="rounded-lg border border-white/15 bg-slate-950 px-2 py-1 text-[11px] text-slate-100"
              >
                {PROP_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => editorGlbRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
              >
                <Upload className="h-3 w-3" />
                <span>Importar .glb</span>
              </button>
              <button
                type="button"
                onClick={() => editorGroundTexRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 text-[11px] font-medium text-sky-100 cursor-pointer"
              >
                <ImageIcon className="h-3 w-3" />
                <span>Textura Suelo</span>
              </button>
              {hud.placedProps.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllPlacedProps}
                  className="ml-auto flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-900/70 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Vaciar ({hud.placedProps.length})</span>
                </button>
              )}
            </div>

            {hud.propSlots.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Slot activo:</span>
                {hud.propSlots.map((slot) => {
                  const active = hud.activePlacementSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onSelectPlacementSlot(slot.id)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                          : 'border-white/12 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {slot.name}
                    </button>
                  );
                })}
                {hud.activePlacementSlotId && (
                  <button
                    type="button"
                    onClick={() => onPlacePropNearPlayer(hud.activePlacementSlotId!)}
                    className="ml-auto rounded-lg bg-amber-500 hover:bg-amber-400 px-2.5 py-1 text-[11px] font-semibold text-slate-950 cursor-pointer"
                  >
                    + Colocar frente al jugador
                  </button>
                )}
              </div>
            )}

            {selectedProp ? (
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-2.5 text-xs">
                <span className="font-semibold text-sky-300 truncate max-w-[140px]">
                  {selectedProp.name}
                </span>
                <label className="flex items-center gap-1.5 text-slate-200">
                  <span>Escala {selectedProp.scale.toFixed(2)}x</span>
                  <input
                    type="range"
                    min={0.25}
                    max={5}
                    step={0.05}
                    value={selectedProp.scale}
                    onChange={(e) =>
                      onUpdatePlacedProp(selectedProp.instanceId, {
                        scale: Number(e.target.value),
                      })
                    }
                    className="w-20 accent-amber-400"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-200">
                  <span>Rot {Math.round(selectedProp.rotationY)}°</span>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={selectedProp.rotationY}
                    onChange={(e) =>
                      onUpdatePlacedProp(selectedProp.instanceId, {
                        rotationY: Number(e.target.value),
                      })
                    }
                    className="w-20 accent-amber-400"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-200">
                  <span>Y {selectedProp.yOffset.toFixed(1)}m</span>
                  <input
                    type="range"
                    min={-1.5}
                    max={6}
                    step={0.1}
                    value={selectedProp.yOffset}
                    onChange={(e) =>
                      onUpdatePlacedProp(selectedProp.instanceId, {
                        yOffset: Number(e.target.value),
                      })
                    }
                    className="w-16 accent-amber-400"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedProp.solid}
                    onChange={(e) =>
                      onUpdatePlacedProp(selectedProp.instanceId, {
                        solid: e.target.checked,
                      })
                    }
                    className="accent-amber-400"
                  />
                  <span>Sólido</span>
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onDuplicatePlacedProp(selectedProp.instanceId)}
                    className="flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] text-sky-100 hover:bg-sky-500/25 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Duplicar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePlacedProp(selectedProp.instanceId)}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-[11px] text-rose-200 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-white/10 pt-2 text-[11px] text-slate-400">
                Haz clic en el terreno para colocar el modelo activo, o usa &quot;Importar .glb&quot; y &quot;Textura Suelo&quot; arriba.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CENTER OVER-THE-SHOULDER CROSSHAIR DURING PLAY */}
      {hud.gameState === 'PLAYING' && !hud.editorMode && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="relative h-12 w-12 flex items-center justify-center">
            <span
              className={`h-1 w-1 rounded-full ${
                hud.weapon === 'unarmed'
                  ? 'bg-white/60'
                  : hud.isAiming
                    ? 'bg-amber-300'
                    : 'bg-white/90'
              }`}
            />
            {hud.weapon !== 'unarmed' && (
              <>
                <span
                  className="absolute w-2.5 h-[1.5px] bg-amber-300/90 transition-transform duration-75"
                  style={{ transform: `translateX(-${crosshairGap + 5}px)` }}
                />
                <span
                  className="absolute w-2.5 h-[1.5px] bg-amber-300/90 transition-transform duration-75"
                  style={{ transform: `translateX(${crosshairGap + 5}px)` }}
                />
                <span
                  className="absolute h-2.5 w-[1.5px] bg-amber-300/90 transition-transform duration-75"
                  style={{ transform: `translateY(-${crosshairGap + 5}px)` }}
                />
                <span
                  className="absolute h-2.5 w-[1.5px] bg-amber-300/90 transition-transform duration-75"
                  style={{ transform: `translateY(${crosshairGap + 5}px)` }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* TOP HUD BAR (MINIMIZADA E INMERSIVA) */}
      {hud.gameState !== 'TITLE_MENU' && hud.gameState !== 'GAME_OVER' && !hud.editorMode && (
        <header className="flex items-start justify-between gap-2 px-3 pt-2.5 sm:px-5 sm:pt-3.5">
          {/* Top-Left: Salud, Munición (cargador + reserva) y Botiquín/Comida */}
          <div className="w-40 sm:w-52 bg-[#090c12]/60 border border-white/10 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2">
            <div className="flex items-center justify-between text-[11px] text-slate-200">
              <span className="flex items-center gap-1 font-medium">
                <Shield className="h-3 w-3 text-emerald-400" />
                <span className="font-mono-tabular">
                  {hud.hp}/{hud.maxHp}
                </span>
              </span>
              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onUseBandage}
                  title="Usar Vendaje (H)"
                  className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-mono-tabular transition-colors cursor-pointer ${
                    hud.bandages > 0
                      ? 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/35'
                      : 'text-slate-500'
                  }`}
                >
                  <Bandage className="h-2.5 w-2.5" />
                  <span>{hud.bandages}</span>
                </button>
                <button
                  type="button"
                  onClick={onUseFood}
                  title="Comer Ración (J)"
                  className={`flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-mono-tabular transition-colors cursor-pointer ${
                    hud.food > 0
                      ? 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/35'
                      : 'text-slate-500'
                  }`}
                >
                  <Utensils className="h-2.5 w-2.5" />
                  <span>{hud.food}</span>
                </button>
                {hud.wood > 0 && (
                  <span className="flex items-center gap-0.5 font-mono-tabular text-[10px] text-emerald-300">
                    <Package className="h-2.5 w-2.5 text-emerald-400" />
                    {hud.wood}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-150 ${
                  hpPct > 50
                    ? 'bg-emerald-500'
                    : hpPct > 25
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${hpPct}%` }}
              />
            </div>

            <div className="mt-1.5 h-1 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full transition-[width] duration-100 ${
                  flareReady ? 'bg-amber-400' : 'bg-amber-600/85'
                }`}
                style={{ width: `${Math.min(100, hud.flareCharge)}%` }}
              />
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-slate-200 font-medium">
                {hud.weapon === 'unarmed' ? (
                  <Hand className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Crosshair className="h-3 w-3 text-amber-400" />
                )}
                <span>
                  {hud.weapon === 'unarmed'
                    ? 'Desarmado'
                    : hud.weapon === 'pistol'
                      ? 'Pistola'
                      : 'Fusil FAL'}
                </span>
              </span>
              <span
                className={`font-mono-tabular ${
                  hud.weapon === 'unarmed' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {hud.weapon === 'unarmed'
                  ? hud.stealthActive
                    ? 'Sigilo'
                    : 'Libre'
                  : hud.isReloading
                    ? 'Recargando'
                    : `${activeAmmo}/${activeMaxAmmo} · ${activeReserve}`}
              </span>
            </div>
          </div>

          {/* Top-Center: Reloj Día/Noche, Infectados y Sigilo */}
          <div className="bg-[#090c12]/52 border border-white/10 rounded-lg px-3 py-1 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-mono-tabular text-slate-200">
              <span
                className={`flex items-center gap-1 ${
                  hud.isDaytime ? 'text-amber-200' : 'text-sky-300'
                }`}
                title={hud.isDaytime ? 'Día: zombies en reposo si no los molestas' : 'Noche: zombies activos'}
              >
                {hud.isDaytime ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                <span>{hud.clockLabel}</span>
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-amber-300 font-medium">
                {formatSurvivalTime(hud.survivalTime)}
              </span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-300">{hud.enemiesRemaining} Infectados</span>
              {(hud.stealthActive || hud.alertedZombies > 0 || hud.isDaytime) && (
                <>
                  <span aria-hidden="true" className="text-slate-500 hidden sm:inline">·</span>
                  <span
                    className={`hidden sm:inline ${
                      hud.alertedZombies > 0
                        ? 'text-rose-400 font-medium'
                        : hud.stealthActive
                          ? hud.stealthState === 'caution'
                            ? 'text-amber-300 font-medium'
                            : 'text-emerald-300 font-medium'
                          : 'text-sky-200'
                    }`}
                  >
                    {hud.alertedZombies > 0
                      ? `${hud.alertedZombies} Hostiles`
                      : hud.stealthActive
                        ? hud.stealthState === 'caution'
                          ? 'Sigilo · Cerca'
                          : 'Sigilo · Oculto'
                        : 'Reposo diurno'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Top-Right: Puntuación compacta + Botones de Estudio, Táctil, Audio y Pausa */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden md:flex items-center gap-2 bg-[#090c12]/52 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-mono-tabular">
              <span className="font-semibold text-amber-300">{hud.score.toLocaleString()}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="text-slate-300">{hud.kills} Bajas</span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenStudio('models')}
                aria-label="Estudio y Ajustes"
                title="Estudio: Modelos, Mapa, Gráficos y Controles"
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#090c12]/60 border border-white/12 text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200 transition-all active:scale-95 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <Sliders className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleMobileControls}
                aria-label={
                  mobileControlsEnabled
                    ? 'Ocultar controles táctiles'
                    : 'Mostrar controles táctiles'
                }
                title="Controles táctiles (móvil)"
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border transition-all active:scale-95 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${
                  mobileControlsEnabled
                    ? 'bg-amber-500/25 border-amber-400/70 text-amber-200'
                    : 'bg-[#090c12]/60 border-white/12 text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200'
                }`}
              >
                <Gamepad2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={hud.muted ? 'Activar sonido' : 'Silenciar'}
                title={hud.muted ? 'Activar sonido (M)' : 'Silenciar (M)'}
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#090c12]/60 border border-white/12 text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200 transition-all active:scale-95 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                {hud.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={hud.gameState === 'PAUSED' ? onResume : onPause}
                aria-label={hud.gameState === 'PAUSED' ? 'Reanudar partida' : 'Pausar partida'}
                title="Pausa (Esc)"
                className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-[#090c12]/60 border border-white/12 text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200 transition-all active:scale-95 cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                {hud.gameState === 'PAUSED' ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* PANTALLA DE TÍTULO (LIMPIA: OPCIONES DE MODELOS OCULTAS EN EL MENÚ DE ESTUDIO) */}
      {hud.gameState === 'TITLE_MENU' && !hud.editorMode && (
        <div className="pointer-events-none flex h-full w-full flex-col justify-between px-6 py-6 md:px-12 md:py-8">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenStudio('models')}
              className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#0c1017]/80 border border-white/12 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              <Sliders className="h-4 w-4 text-amber-400" />
              <span>Estudio · Modelos y Ajustes</span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="pointer-events-auto flex items-center gap-2 rounded-lg bg-[#0c1017]/80 border border-white/12 px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-amber-400/60 hover:bg-amber-500/15 hover:text-amber-200 transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              {hud.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span>{hud.muted ? 'Sin Sonido' : 'Sonido Activo'}</span>
            </button>
          </div>

          <div className="pointer-events-auto max-w-md rounded-xl bg-[#0c1017]/88 border border-white/12 p-6 sm:p-7 shadow-2xl">
            <svg
              viewBox="0 0 360 76"
              className="w-full max-w-[320px] h-auto"
              role="img"
              aria-label="Zona Cero"
            >
              <defs>
                <linearGradient id="hazardGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="55%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
              </defs>
              <g transform="translate(8, 12)">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="url(#hazardGold)"
                  strokeWidth="2.4"
                />
                <line x1="24" y1="0" x2="24" y2="12" stroke="#f59e0b" strokeWidth="2.4" />
                <line x1="24" y1="36" x2="24" y2="48" stroke="#f59e0b" strokeWidth="2.4" />
                <line x1="0" y1="24" x2="12" y2="24" stroke="#f59e0b" strokeWidth="2.4" />
                <line x1="36" y1="24" x2="48" y2="24" stroke="#f59e0b" strokeWidth="2.4" />
                <circle cx="24" cy="24" r="5" fill="#ef4444" />
              </g>
              <text
                x="68"
                y="43"
                fill="url(#hazardGold)"
                fontFamily="Cinzel, Georgia, serif"
                fontSize="35"
                fontWeight="700"
                letterSpacing="3"
              >
                ZONA CERO
              </text>
              <text
                x="70"
                y="62"
                fill="#94a3b8"
                fontFamily="Plus Jakarta Sans, sans-serif"
                fontSize="11"
                letterSpacing="2.2"
              >
                APOCALIPSIS ZOMBIE 3D
              </text>
            </svg>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Supervivencia libre con ciclo de día y noche, niebla dinámica y botín táctico. De día
              los infectados reposan si guardas silencio; al caer la noche cazan sin descanso.
            </p>

            {/* Selector de dificultad */}
            <div className="mt-4">
              <div className="text-xs font-medium text-slate-400 mb-2">Dificultad</div>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((d) => {
                  const active = hud.difficulty === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onSelectDifficulty(d.id)}
                      className={`rounded-lg px-3 py-2 text-left border transition-all active:scale-[0.98] cursor-pointer shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${
                        active
                          ? 'bg-amber-500/20 border-amber-400/70 text-amber-100'
                          : 'bg-slate-900/75 border-white/10 text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-semibold whitespace-nowrap">{d.label}</div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{d.detail}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones Iniciar Partida + Menú Estudio */}
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-semibold text-sm py-3 px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Iniciar Partida</span>
              </button>
              {hud.bestScore > 0 && (
                <div className="text-right px-2">
                  <div className="text-[11px] text-slate-400">Récord</div>
                  <div className="font-mono-tabular text-sm font-semibold text-amber-300">
                    {hud.bestScore.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onOpenStudio('models')}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-white/12 bg-slate-900/80 hover:bg-slate-800 hover:border-amber-400/50 py-2.5 px-4 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 text-amber-400" />
              <span>Personalizar Modelos (.glb), Mapa, Gráficos y Botones</span>
            </button>
          </div>

          <div className="flex justify-center">
            <div className="rounded-lg bg-[#090c12]/65 border border-white/10 px-4 py-1.5 text-[11px] text-slate-300 tracking-wide text-center">
              WASD Mover · Shift Correr · Espacio Saltar · C Sigilo · H Vendaje · J Comida · 1/2/3
              Arma · R Recargar · E Granada
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAUSA */}
      {hud.gameState === 'PAUSED' && !hud.editorMode && !studioOpen && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#07090e]/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#0c1017]/88 border border-white/15 p-7 shadow-2xl">
            <h2 className="font-display text-2xl text-amber-200">Pausa</h2>
            <p className="mt-1 text-xs text-slate-400 font-mono-tabular">
              {hud.clockLabel} · Tiempo {formatSurvivalTime(hud.survivalTime)} · Puntos{' '}
              {hud.score.toLocaleString()} · {hud.kills} Bajas
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-semibold text-sm py-2.5 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-all active:scale-[0.98] cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Reanudar</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenStudio('models')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-white/12 text-slate-100 font-medium text-sm py-2.5 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all active:scale-[0.98] cursor-pointer"
              >
                <Sliders className="h-4 w-4 text-amber-400" />
                <span>Estudio (Modelos, Mapa y Gráficos)</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenStudio('controls')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800/90 hover:bg-slate-700 border border-white/12 text-slate-100 font-medium text-sm py-2.5 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all active:scale-[0.98] cursor-pointer"
              >
                <Gamepad2 className="h-4 w-4 text-sky-400" />
                <span>Editar Botones Táctiles</span>
              </button>
              <button
                type="button"
                onClick={onStart}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/12 text-slate-200 font-medium text-sm py-2.5 px-4 transition-all active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-slate-300" />
                <span>Reiniciar Partida</span>
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200 text-sm py-2 px-4 transition-all active:scale-[0.98] cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Menú Principal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENSAJE DE MUERTE SIN FONDO */}
      {hud.gameState === 'GAME_OVER' && !hud.editorMode && (
        <div
          onClick={() => {
            if (canDismissDeath) onStart();
          }}
          className={`fixed inset-0 flex items-center justify-center p-4 bg-transparent select-none ${
            canDismissDeath ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
          }`}
        >
          <h2 className="font-death death-blood-text text-center text-3xl sm:text-5xl md:text-6xl tracking-[0.08em] leading-tight uppercase">
            ESTÁS MUERTO
          </h2>
        </div>
      )}

      {/* BARRA INFERIOR, MINIMAPA Y CONTROLES MÓVILES */}
      {hud.gameState === 'PLAYING' && !hud.editorMode && (
        <>
          <MiniMap
            playerPos={hud.playerPos}
            playerYaw={hud.playerYaw}
            camYaw={hud.camYaw}
            enemies={hud.radarEntities}
            nearCampfire={hud.nearCampfire}
            mobileLayout={mobileControlsEnabled}
            mapPreset={hud.mapSettings.mapPreset}
            placedProps={hud.placedProps}
          />
          {mobileControlsEnabled ? (
            <MobileControls
              weapon={hud.weapon}
              stance={hud.stance}
              isAiming={hud.isAiming}
              isReloading={hud.isReloading}
              flareCharge={hud.flareCharge}
              bandages={hud.bandages}
              food={hud.food}
              touchLayout={touchLayout}
              onMove={onMobileMove}
              onCameraVelocity={onMobileCameraVelocity}
              onRotateCamera={onMobileRotateCamera}
              onCenterCamera={onMobileCenterCamera}
              onFireChange={onMobileFireChange}
              onAimChange={onMobileAimChange}
              onJump={onMobileJump}
              onToggleCrouch={onMobileToggleCrouch}
              onReload={onMobileReload}
              onGrenade={onMobileGrenade}
              onCycleWeapon={onMobileCycleWeapon}
              onUseBandage={onUseBandage}
              onUseFood={onUseFood}
            />
          ) : (
            hud.survivalTime < 10 && (
              <footer className="flex justify-center pb-3">
                <div className="rounded-lg bg-[#090c12]/58 border border-white/10 px-3.5 py-1 text-[11px] text-slate-300">
                  WASD Mover · Shift Correr · Espacio Saltar · C Sigilo · H Vendaje · J Comida ·
                  1/2/3 Arma · R Recargar · E Granada
                </div>
              </footer>
            )
          )}
        </>
      )}
    </div>
  );
};
