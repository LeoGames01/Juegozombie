import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Bandage,
  ChevronDown,
  Crosshair,
  Flame,
  Hand,
  RotateCcw,
  Target,
  Utensils,
} from 'lucide-react';
import { DEFAULT_TOUCH_LAYOUT } from '../game/settingsDefaults';
import type { MovementStance, TouchLayoutConfig, WeaponKind } from '../game/types';

interface MobileControlsProps {
  weapon: WeaponKind;
  stance: MovementStance;
  isAiming: boolean;
  isReloading: boolean;
  flareCharge: number;
  bandages: number;
  food: number;
  touchLayout: TouchLayoutConfig;
  onMove: (x: number, y: number, sprint?: boolean) => void;
  onCameraVelocity: (yawVel: number, pitchVel: number) => void;
  onRotateCamera: (deltaYaw: number, deltaPitch: number) => void;
  onCenterCamera: () => void;
  onFireChange: (active: boolean) => void;
  onAimChange: (active: boolean) => void;
  onJump: () => void;
  onToggleCrouch: () => void;
  onReload: () => void;
  onGrenade: () => void;
  onCycleWeapon: () => void;
  onUseBandage: () => void;
  onUseFood: () => void;
}

const MOVE_DEADZONE = 6;
const MOVE_WALK_RADIUS = 44;
const MOVE_MAX_RADIUS = 74;

function safeSetPointerCapture(el: Element | null | undefined, pointerId: number) {
  if (!el || typeof el.setPointerCapture !== 'function') return;
  try {
    if (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(pointerId)) {
      return;
    }
    el.setPointerCapture(pointerId);
  } catch {
    // Ignore InvalidStateError when pointer is no longer active or cannot be captured
  }
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  weapon,
  stance,
  isAiming,
  isReloading,
  flareCharge,
  bandages,
  food,
  touchLayout,
  onMove,
  onCameraVelocity,
  onRotateCamera,
  onFireChange,
  onAimChange,
  onJump,
  onToggleCrouch,
  onReload,
  onGrenade,
  onCycleWeapon,
  onUseBandage,
  onUseFood,
}) => {
  const movePointerIdRef = useRef<number | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const camPointerIdRef = useRef<number | null>(null);
  const camLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [firing, setFiring] = useState(false);

  const cleanupCallbacksRef = useRef({
    onMove,
    onCameraVelocity,
    onFireChange,
    onAimChange,
  });
  cleanupCallbacksRef.current = {
    onMove,
    onCameraVelocity,
    onFireChange,
    onAimChange,
  };

  useEffect(() => {
    return () => {
      cleanupCallbacksRef.current.onMove(0, 0, false);
      cleanupCallbacksRef.current.onCameraVelocity(0, 0);
      cleanupCallbacksRef.current.onFireChange(false);
      cleanupCallbacksRef.current.onAimChange(false);
    };
  }, []);

  const updateFloatingMove = (clientX: number, clientY: number) => {
    let dx = clientX - moveOriginRef.current.x;
    let dy = clientY - moveOriginRef.current.y;
    let dist = Math.hypot(dx, dy);

    // Gently trail origin behind the finger past max radius so 360° direction reversals stay instant
    if (dist > MOVE_MAX_RADIUS) {
      const pull = (dist - MOVE_MAX_RADIUS) / dist;
      moveOriginRef.current.x += dx * pull;
      moveOriginRef.current.y += dy * pull;
      dx = clientX - moveOriginRef.current.x;
      dy = clientY - moveOriginRef.current.y;
      dist = MOVE_MAX_RADIUS;
    }

    if (dist <= MOVE_DEADZONE) {
      onMove(0, 0, false);
      return;
    }

    const ux = dx / dist;
    const uy = -dy / dist;

    if (dist <= MOVE_WALK_RADIUS) {
      const walkMag = 0.28 + ((dist - MOVE_DEADZONE) / (MOVE_WALK_RADIUS - MOVE_DEADZONE)) * 0.57;
      onMove(ux * walkMag, uy * walkMag, false);
    } else {
      onMove(ux, uy, true);
    }
  };

  const resetFloatingMove = () => {
    movePointerIdRef.current = null;
    onMove(0, 0, false);
  };

  const getCfg = (id: keyof TouchLayoutConfig) => touchLayout[id] ?? DEFAULT_TOUCH_LAYOUT[id];
  const btnStyle = (id: keyof TouchLayoutConfig): React.CSSProperties => {
    const cfg = getCfg(id);
    return {
      left: `${cfg.xPct}%`,
      top: `${cfg.yPct}%`,
      opacity: cfg.opacity,
      transform: `translate(-50%, -50%) scale(${cfg.scale})`,
    };
  };

  const flareReady = flareCharge >= 100;
  const touchBtnBase =
    'pointer-events-auto fixed flex items-center justify-center rounded-full border transition-transform duration-100 active:scale-90 cursor-pointer touch-none shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]';

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* INVISIBLE 360° LOWER-LEFT TOUCH PAD: WALK & RUN */}
      <div
        aria-label="Zona táctil de movimiento 360 grados"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          movePointerIdRef.current = e.pointerId;
          moveOriginRef.current = { x: e.clientX, y: e.clientY };
          safeSetPointerCapture(e.currentTarget, e.pointerId);
          onMove(0, 0, false);
        }}
        onPointerMove={(e) => {
          if (movePointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          updateFloatingMove(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (movePointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetFloatingMove();
        }}
        onPointerCancel={(e) => {
          if (movePointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          resetFloatingMove();
        }}
        className="pointer-events-auto fixed bottom-0 left-0 h-[52vh] w-[44vw] bg-transparent touch-none"
      />

      {/* INVISIBLE 360° LOWER-RIGHT TOUCH PAD: CAMERA LOOK */}
      <div
        aria-label="Zona táctil de cámara 360 grados"
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          camPointerIdRef.current = e.pointerId;
          camLastPosRef.current = { x: e.clientX, y: e.clientY };
          safeSetPointerCapture(e.currentTarget, e.pointerId);
        }}
        onPointerMove={(e) => {
          if (camPointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          const dx = e.clientX - camLastPosRef.current.x;
          const dy = e.clientY - camLastPosRef.current.y;
          camLastPosRef.current = { x: e.clientX, y: e.clientY };
          const sens = isAiming ? 0.0044 : 0.0068;
          onRotateCamera(-dx * sens, dy * sens);
        }}
        onPointerUp={(e) => {
          if (camPointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          camPointerIdRef.current = null;
        }}
        onPointerCancel={(e) => {
          if (camPointerIdRef.current !== e.pointerId) return;
          e.stopPropagation();
          camPointerIdRef.current = null;
        }}
        className="pointer-events-auto fixed bottom-0 right-0 h-[52vh] w-[56vw] bg-transparent touch-none"
      />

      {/* CUSTOMIZABLE ACTION & STANCE BUTTONS */}
      <div className="pointer-events-none fixed inset-0 z-30 touch-none">
        {getCfg('crouch').visible && (
          <button
            type="button"
            title="Sigilo / Agacharse"
            aria-label="Sigilo y agacharse"
            style={btnStyle('crouch')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleCrouch();
            }}
            className={`h-11 w-11 ${touchBtnBase} ${
              stance === 'crouch'
                ? 'bg-emerald-500/35 border-emerald-300 text-emerald-100'
                : 'bg-[#090c12]/62 border-white/15 text-slate-200'
            }`}
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {getCfg('heal').visible && (
          <button
            type="button"
            title="Usar Vendaje"
            aria-label="Usar vendaje"
            style={btnStyle('heal')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onUseBandage();
            }}
            className={`h-11 w-11 ${touchBtnBase} ${
              bandages > 0
                ? 'bg-rose-950/75 border-rose-400/50 text-rose-200'
                : 'bg-[#090c12]/48 border-white/10 text-slate-500'
            }`}
          >
            <Bandage className="h-4 w-4" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-950 border border-white/15 px-1 text-[9px] font-mono-tabular text-slate-100">
              {bandages}
            </span>
          </button>
        )}

        {getCfg('eat').visible && (
          <button
            type="button"
            title="Comer Ración"
            aria-label="Comer ración"
            style={btnStyle('eat')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onUseFood();
            }}
            className={`h-11 w-11 ${touchBtnBase} ${
              food > 0
                ? 'bg-amber-950/75 border-amber-400/50 text-amber-200'
                : 'bg-[#090c12]/48 border-white/10 text-slate-500'
            }`}
          >
            <Utensils className="h-4 w-4" />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-950 border border-white/15 px-1 text-[9px] font-mono-tabular text-slate-100">
              {food}
            </span>
          </button>
        )}

        {getCfg('weapon').visible && (
          <button
            type="button"
            style={btnStyle('weapon')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onCycleWeapon();
            }}
            aria-label="Cambiar arma"
            className={`pointer-events-auto fixed h-11 px-3 rounded-full border text-[11px] font-semibold tracking-wide transition-transform duration-100 active:scale-90 cursor-pointer touch-none shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
              weapon === 'rifle'
                ? 'bg-[#090c12]/65 border-amber-400/50 text-amber-200'
                : weapon === 'unarmed'
                  ? 'bg-[#090c12]/65 border-emerald-400/45 text-emerald-200'
                  : 'bg-[#090c12]/65 border-white/15 text-slate-100'
            }`}
          >
            {weapon === 'unarmed' ? 'Desarmado' : weapon === 'pistol' ? 'Pistola' : 'FAL'}
          </button>
        )}

        {getCfg('reload').visible && weapon !== 'unarmed' && (
          <button
            type="button"
            style={btnStyle('reload')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onReload();
            }}
            aria-label="Recargar"
            className={`h-11 w-11 ${touchBtnBase} ${
              isReloading
                ? 'bg-amber-500/35 border-amber-300 text-amber-100'
                : 'bg-[#090c12]/62 border-white/15 text-slate-200'
            }`}
          >
            <RotateCcw className={`h-4 w-4 ${isReloading ? 'animate-spin' : ''}`} />
          </button>
        )}

        {getCfg('grenade').visible && (
          <button
            type="button"
            style={btnStyle('grenade')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onGrenade();
            }}
            aria-label="Granada"
            className={`h-11 w-11 ${touchBtnBase} ${
              flareReady
                ? 'bg-amber-500/35 border-amber-300 text-amber-200'
                : 'bg-[#090c12]/55 border-white/12 text-slate-500'
            }`}
          >
            <Flame className="h-4 w-4" />
          </button>
        )}

        {getCfg('aim').visible && (
          <button
            type="button"
            style={btnStyle('aim')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onAimChange(!isAiming);
            }}
            aria-label="Apuntar"
            className={`h-12 w-12 ${touchBtnBase} ${
              isAiming
                ? 'bg-amber-500/35 border-amber-300 text-amber-100'
                : 'bg-[#090c12]/62 border-white/16 text-slate-100'
            }`}
          >
            <Target className="h-5 w-5" />
          </button>
        )}

        {getCfg('jump').visible && (
          <button
            type="button"
            style={btnStyle('jump')}
            onPointerDown={(e) => {
              e.stopPropagation();
              onJump();
            }}
            aria-label="Saltar"
            className={`h-12 w-12 ${touchBtnBase} bg-[#090c12]/62 border-white/16 text-slate-100`}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}

        {getCfg('fire').visible && (
          <button
            type="button"
            style={btnStyle('fire')}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              safeSetPointerCapture(e.currentTarget, e.pointerId);
              setFiring(true);
              onFireChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setFiring(false);
              onFireChange(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              setFiring(false);
              onFireChange(false);
            }}
            aria-label={weapon === 'unarmed' ? 'Golpear' : 'Disparar'}
            className={`pointer-events-auto fixed h-16 w-16 rounded-full border-2 flex items-center justify-center transition-transform duration-100 active:scale-90 cursor-pointer touch-none shadow-lg ${
              firing
                ? 'bg-rose-500 border-rose-200 text-white'
                : weapon === 'unarmed'
                  ? 'bg-emerald-500/85 border-emerald-200 text-slate-950'
                  : 'bg-amber-500/85 border-amber-200 text-slate-950'
            }`}
          >
            {weapon === 'unarmed' ? (
              <Hand className="h-6 w-6" />
            ) : (
              <Crosshair className="h-6 w-6" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
