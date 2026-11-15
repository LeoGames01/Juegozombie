import React from 'react';
import {
  ARENA_PLAYABLE_RADIUS,
  CAMPFIRE_SAFE_RADIUS,
  getCampfireCoords,
} from '../game/models';
import type { MapPresetId, PlacedWorldProp, RadarBlip } from '../game/types';

interface MiniMapProps {
  playerPos: { x: number; z: number };
  playerYaw: number;
  camYaw: number;
  enemies: RadarBlip[];
  nearCampfire: boolean;
  mobileLayout?: boolean;
  mapPreset?: MapPresetId;
  placedProps?: PlacedWorldProp[];
}

function worldToRadar(
  wx: number,
  wz: number,
  center: number,
  mapRadius: number,
): { rx: number; ry: number; clamped: boolean } {
  const dist = Math.hypot(wx, wz);
  const scale = dist > ARENA_PLAYABLE_RADIUS ? ARENA_PLAYABLE_RADIUS / dist : 1;
  const x = wx * scale;
  const z = wz * scale;
  return {
    rx: center + (x / ARENA_PLAYABLE_RADIUS) * mapRadius,
    ry: center + (z / ARENA_PLAYABLE_RADIUS) * mapRadius,
    clamped: dist > ARENA_PLAYABLE_RADIUS,
  };
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerPos,
  playerYaw,
  camYaw,
  enemies,
  nearCampfire,
  mobileLayout = false,
  mapPreset = 'buenos_aires',
  placedProps = [],
}) => {
  const size = mobileLayout ? 78 : 108;
  const center = size / 2;
  const mapRadius = mobileLayout ? 35 : 49;
  const isSandbox = mapPreset === 'custom_sandbox';

  const playerPt = worldToRadar(playerPos.x, playerPos.z, center, mapRadius);
  const cfCoords = getCampfireCoords(mapPreset);
  const campPt = worldToRadar(cfCoords.x, cfCoords.z, center, mapRadius);
  const obeliscoPt = worldToRadar(0, -2.2, center, mapRadius);
  const baPt = worldToRadar(0, 5.4, center, mapRadius);
  const safeZoneR = (CAMPFIRE_SAFE_RADIUS / ARENA_PLAYABLE_RADIUS) * mapRadius;
  const metrobusLeftX = center + (-12.7 / ARENA_PLAYABLE_RADIUS) * mapRadius;
  const metrobusRightX = center + (12.7 / ARENA_PLAYABLE_RADIUS) * mapRadius;
  const plazaW = (17.4 / ARENA_PLAYABLE_RADIUS) * mapRadius;
  const plazaH = (21.8 / ARENA_PLAYABLE_RADIUS) * mapRadius;

  const camDeg = (-camYaw * 180) / Math.PI;
  const playerDeg = ((Math.PI - playerYaw) * 180) / Math.PI;

  return (
    <div
      aria-label="Minimapa táctico"
      className={`pointer-events-none fixed rounded-full bg-[#090c12]/58 border border-white/14 p-1 ${
        mobileLayout ? 'top-14 right-3 sm:right-5' : 'bottom-4 right-5'
      }`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="block rounded-full bg-[#070a0f]/75"
      >
        <defs>
          <radialGradient id="fovCone" cx="50%" cy="100%" r="85%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>

        {isSandbox ? (
          <>
            <line
              x1={center}
              y1={6}
              x2={center}
              y2={size - 6}
              stroke="#334155"
              strokeOpacity="0.55"
              strokeWidth="0.7"
              strokeDasharray="2 2"
            />
            <line
              x1={6}
              y1={center}
              x2={size - 6}
              y2={center}
              stroke="#334155"
              strokeOpacity="0.55"
              strokeWidth="0.7"
              strokeDasharray="2 2"
            />
            <circle
              cx={center}
              cy={center}
              r={mapRadius * 0.55}
              fill="none"
              stroke="#334155"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
          </>
        ) : (
          <>
            {/* Avenida 9 de Julio & Av. Corrientes cross corridors */}
            <rect
              x={center - (26 / ARENA_PLAYABLE_RADIUS) * mapRadius}
              y={4}
              width={(52 / ARENA_PLAYABLE_RADIUS) * mapRadius}
              height={size - 8}
              fill="#1e293b"
              fillOpacity="0.35"
            />
            <rect
              x={4}
              y={center - (6.8 / ARENA_PLAYABLE_RADIUS) * mapRadius}
              width={size - 8}
              height={(13.6 / ARENA_PLAYABLE_RADIUS) * mapRadius}
              fill="#1e293b"
              fillOpacity="0.32"
            />

            {/* Metrobus 9 de Julio lanes */}
            <line
              x1={metrobusLeftX}
              y1={6}
              x2={metrobusLeftX}
              y2={size - 6}
              stroke="#eab308"
              strokeOpacity="0.4"
              strokeWidth="1.4"
              strokeDasharray="3 2"
            />
            <line
              x1={metrobusRightX}
              y1={6}
              x2={metrobusRightX}
              y2={size - 6}
              stroke="#eab308"
              strokeOpacity="0.4"
              strokeWidth="1.4"
              strokeDasharray="3 2"
            />

            {/* Plaza de la República */}
            <rect
              x={center - plazaW * 0.5}
              y={center - plazaH * 0.5}
              width={plazaW}
              height={plazaH}
              rx="2"
              fill="#334155"
              fillOpacity="0.55"
              stroke="#64748b"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
          </>
        )}

        <circle
          cx={center}
          cy={center}
          r={mapRadius}
          fill="none"
          stroke="#475569"
          strokeOpacity="0.75"
          strokeWidth="1"
        />

        <text
          x={center}
          y={8}
          textAnchor="middle"
          fill="#64748b"
          fontSize="7"
          fontWeight="700"
        >
          N
        </text>

        {!isSandbox && (
          <>
            {/* El Obelisco & Gran BA markers */}
            <rect
              x={obeliscoPt.rx - 2.1}
              y={obeliscoPt.ry - 2.1}
              width={4.2}
              height={4.2}
              transform={`rotate(45 ${obeliscoPt.rx} ${obeliscoPt.ry})`}
              fill="#f8fafc"
              fillOpacity="0.85"
            />
            <rect
              x={baPt.rx - 3.6}
              y={baPt.ry - 1.1}
              width={7.2}
              height={2.2}
              rx="0.8"
              fill="#4ade80"
              fillOpacity="0.85"
            />
          </>
        )}

        {placedProps.map((prop) => {
          const pt = worldToRadar(prop.x, prop.z, center, mapRadius);
          return (
            <rect
              key={prop.instanceId}
              x={pt.rx - 1.4}
              y={pt.ry - 1.4}
              width={2.8}
              height={2.8}
              rx="0.5"
              fill="#38bdf8"
              fillOpacity={pt.clamped ? 0.45 : 0.85}
            />
          );
        })}

        <circle
          cx={campPt.rx}
          cy={campPt.ry}
          r={safeZoneR}
          fill={nearCampfire ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.06)'}
          stroke="#f59e0b"
          strokeOpacity="0.5"
          strokeWidth="0.9"
        />
        <polygon
          points={`${campPt.rx},${campPt.ry - 3.4} ${campPt.rx + 2.5},${campPt.ry + 2.2} ${campPt.rx - 2.5},${campPt.ry + 2.2}`}
          fill="#fb923c"
        />
        <circle cx={campPt.rx} cy={campPt.ry + 0.5} r="1.1" fill="#fef08a" />

        {enemies.map((e) => {
          const pt = worldToRadar(e.x, e.z, center, mapRadius);
          const color =
            e.kind === 'brute' ? '#f97316' : e.kind === 'spitter' ? '#84cc16' : '#ef4444';
          const radius = e.kind === 'brute' ? 3.0 : e.kind === 'spitter' ? 2.4 : 2.1;
          return (
            <circle
              key={e.id}
              cx={pt.rx}
              cy={pt.ry}
              r={radius}
              fill={color}
              fillOpacity={pt.clamped ? 0.55 : 0.92}
              stroke="#080b10"
              strokeWidth="0.75"
            />
          );
        })}

        <g transform={`translate(${playerPt.rx}, ${playerPt.ry})`}>
          <g transform={`rotate(${camDeg})`}>
            <polygon points="0,0 -9,-20 9,-20" fill="url(#fovCone)" />
          </g>
          <g transform={`rotate(${playerDeg})`}>
            <polygon
              points="0,-4.8 3.4,3.4 0,1.5 -3.4,3.4"
              fill="#f8fafc"
              stroke="#0f172a"
              strokeWidth="0.9"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
