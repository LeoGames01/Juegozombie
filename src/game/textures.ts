import * as THREE from 'three';

export function createGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich weathered urban Buenos Aires asphalt base
  ctx.fillStyle = '#262a31';
  ctx.fillRect(0, 0, size, size);

  // Subtle asphalt aggregate patches & tire wear
  for (let i = 0; i < 480; i++) {
    const x = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * size;
    const y = Math.abs((Math.sin(i * 78.233) * 19341.123) % 1) * size;
    const radius = 5 + (i % 22);
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(54, 58, 66, 0.22)'
        : i % 4 === 1
          ? 'rgba(18, 21, 26, 0.25)'
          : i % 4 === 2
            ? 'rgba(72, 76, 84, 0.14)'
            : 'rgba(32, 36, 44, 0.18)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tar-sealed asphalt cracks
  ctx.strokeStyle = 'rgba(10, 12, 16, 0.48)';
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 26; i++) {
    let cx = Math.abs((Math.sin(i * 91.1) * 18231.4) % 1) * size;
    let cy = Math.abs((Math.sin(i * 37.7) * 42183.9) % 1) * size;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += Math.sin(i * 7 + s * 2.1) * 22;
      cy += Math.cos(i * 5 + s * 1.9) * 22;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Fine mineral aggregate grit
  for (let i = 0; i < 2600; i++) {
    const px = Math.abs((Math.sin(i * 45.164) * 23421.63) % 1) * size;
    const py = Math.abs((Math.sin(i * 91.732) * 51234.19) % 1) * size;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.13)';
    ctx.fillRect(px, py, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createSimpleTerrainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Clean natural sandbox earth/grass-stone blend ready for custom textures or props
  ctx.fillStyle = '#5f6959';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 420; i++) {
    const x = Math.abs((Math.sin(i * 19.31) * 43758.5453) % 1) * size;
    const y = Math.abs((Math.sin(i * 63.17) * 19341.123) % 1) * size;
    const r = 8 + (i % 26);
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(116, 128, 102, 0.16)'
        : i % 3 === 1
          ? 'rgba(72, 82, 66, 0.18)'
          : 'rgba(140, 146, 130, 0.1)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 1800; i++) {
    const px = Math.abs((Math.sin(i * 45.164) * 23421.63) % 1) * size;
    const py = Math.abs((Math.sin(i * 91.732) * 51234.19) % 1) * size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.075)';
    ctx.fillRect(px, py, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createGroundBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const px = Math.abs((Math.sin(i * 27.19) * 19384.2) % 1) * size;
    const py = Math.abs((Math.sin(i * 67.43) * 38192.5) % 1) * size;
    const v = i % 2 === 0 ? 175 : 75;
    ctx.fillStyle = `rgba(${v},${v},${v},0.32)`;
    ctx.fillRect(px, py, 3, 3);
  }

  ctx.strokeStyle = 'rgba(28, 28, 28, 0.65)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    let cx = Math.abs((Math.sin(i * 41.3) * 14111.2) % 1) * size;
    let cy = Math.abs((Math.sin(i * 83.9) * 29182.7) % 1) * size;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += Math.sin(i * 5.2 + s * 1.8) * 18;
      cy += Math.cos(i * 4.4 + s * 2.1) * 18;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createBarkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Organic deep-ridged wood bark & weathered timber planks
  ctx.fillStyle = '#4f3a26';
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 5) {
    const ridge = Math.sin(x * 0.38) * 0.5 + Math.cos(x * 0.14) * 0.5;
    ctx.fillStyle =
      ridge > 0.2
        ? 'rgba(24, 15, 10, 0.36)'
        : ridge < -0.2
          ? 'rgba(118, 89, 59, 0.24)'
          : 'rgba(65, 48, 32, 0.2)';
    ctx.fillRect(x, 0, 3, size);
  }

  for (let i = 0; i < 140; i++) {
    const px = Math.abs((Math.sin(i * 17.7) * 32918.4) % 1) * size;
    const py = Math.abs((Math.sin(i * 53.3) * 18293.1) % 1) * size;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(40, 56, 36, 0.22)' : 'rgba(18, 12, 8, 0.35)';
    ctx.fillRect(px, py, 4, 12 + (i % 18));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Weathered concrete blocks, moss stains & rubble grain
  ctx.fillStyle = '#4e5661';
  ctx.fillRect(0, 0, size, size);

  // Subtle concrete slab joints
  ctx.strokeStyle = 'rgba(20, 24, 30, 0.45)';
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let i = 0; i < 420; i++) {
    const px = Math.abs((Math.sin(i * 19.31) * 91823.1) % 1) * size;
    const py = Math.abs((Math.sin(i * 63.17) * 41234.7) % 1) * size;
    const r = 3 + (i % 13);
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(42, 64, 46, 0.18)'
        : i % 2 === 0
          ? 'rgba(24, 28, 34, 0.25)'
          : 'rgba(155, 162, 174, 0.16)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createSkyGradientTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#050812'); // Deep midnight zenith
  grad.addColorStop(0.32, '#0c1526'); // Indigo night sky
  grad.addColorStop(0.54, '#18273c'); // Cool twilight mist above horizon
  grad.addColorStop(0.66, '#131d2b'); // Horizon fog band
  grad.addColorStop(1.0, '#0c1118'); // Lower hemisphere

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(4, 6, 10, 0.78)');
  grad.addColorStop(0.55, 'rgba(4, 6, 10, 0.36)');
  grad.addColorStop(1, 'rgba(4, 6, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

let cachedAwarenessIcons: {
  question: THREE.CanvasTexture;
  exclamation: THREE.CanvasTexture;
} | null = null;

function createAwarenessGlyphTexture(symbol: '?' | '!'): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 88px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

  // Dark outer halo for contrast against both bright sky and dark forest
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = 'rgba(6, 9, 14, 0.94)';
  ctx.lineWidth = 16;
  ctx.strokeText(symbol, size / 2, size / 2 + 4);

  // Pure white glyph so SpriteMaterial.color tints it cleanly
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(symbol, size / 2, size / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getAwarenessIconTextures(): {
  question: THREE.CanvasTexture;
  exclamation: THREE.CanvasTexture;
} {
  if (!cachedAwarenessIcons) {
    cachedAwarenessIcons = {
      question: createAwarenessGlyphTexture('?'),
      exclamation: createAwarenessGlyphTexture('!'),
    };
  }
  return cachedAwarenessIcons;
}

let cachedBloodTextures: THREE.CanvasTexture[] | null = null;

function createBloodPuddleTexture(seed: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;

  const rnd = (i: number) => {
    const v = Math.sin(seed * 91.7 + i * 37.13) * 43758.5453;
    return v - Math.floor(v);
  };

  // Main organic irregular puddle lobes
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const angle = (i / lobes) * Math.PI * 2 + rnd(i) * 0.8;
    const dist = i === 0 ? 0 : size * (0.06 + rnd(i + 10) * 0.12);
    const lx = cx + Math.cos(angle) * dist;
    const ly = cy + Math.sin(angle) * dist;
    const r = size * (i === 0 ? 0.28 : 0.14 + rnd(i + 20) * 0.13);

    const grad = ctx.createRadialGradient(lx, ly, r * 0.15, lx, ly, r);
    grad.addColorStop(0.0, 'rgba(68, 4, 8, 0.96)');
    grad.addColorStop(0.55, 'rgba(112, 8, 13, 0.92)');
    grad.addColorStop(0.84, 'rgba(54, 4, 7, 0.78)');
    grad.addColorStop(1.0, 'rgba(38, 2, 4, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glossy deeper core
  const coreGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, size * 0.22);
  coreGrad.addColorStop(0, 'rgba(42, 2, 5, 0.95)');
  coreGrad.addColorStop(0.65, 'rgba(92, 6, 11, 0.65)');
  coreGrad.addColorStop(1, 'rgba(92, 6, 11, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Scattered directional blood droplets & micro-splatters around the pool
  for (let i = 0; i < 24; i++) {
    const a = rnd(i + 40) * Math.PI * 2;
    const d = size * (0.24 + rnd(i + 70) * 0.22);
    const sx = cx + Math.cos(a) * d;
    const sy = cy + Math.sin(a) * d;
    const sr = 2.5 + rnd(i + 100) * 8.5;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(96, 7, 12, 0.85)' : 'rgba(58, 3, 7, 0.78)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, sr * (1.2 + rnd(i + 130) * 0.8), sr * 0.72, a, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getBloodPuddleTextures(): THREE.CanvasTexture[] {
  if (!cachedBloodTextures) {
    cachedBloodTextures = [
      createBloodPuddleTexture(1.37),
      createBloodPuddleTexture(4.91),
      createBloodPuddleTexture(8.53),
    ];
  }
  return cachedBloodTextures;
}

export interface BuenosAiresTextures {
  classicFacade: THREE.CanvasTexture;
  classicEmissive: THREE.CanvasTexture;
  modernGlass: THREE.CanvasTexture;
  modernEmissive: THREE.CanvasTexture;
  verticalGarden: THREE.CanvasTexture;
  plazaPaver: THREE.CanvasTexture;
  metrobusSign: THREE.CanvasTexture;
  busLivery: THREE.CanvasTexture;
  billboardA: THREE.CanvasTexture;
  billboardB: THREE.CanvasTexture;
  dispose: () => void;
}

function makeFacadePair(
  maxAnisotropy: number,
  mode: 'classic' | 'modern',
): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const w = 512;
  const h = 512;
  const cMap = document.createElement('canvas');
  cMap.width = w;
  cMap.height = h;
  const ctx = cMap.getContext('2d')!;

  const cEm = document.createElement('canvas');
  cEm.width = w;
  cEm.height = h;
  const ectx = cEm.getContext('2d')!;

  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  if (mode === 'classic') {
    // Buenos Aires French-academic limestone & stucco facade
    ctx.fillStyle = '#c8bfb0';
    ctx.fillRect(0, 0, w, h);

    // Horizontal stone cornice bands
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = y % 128 === 0 ? '#a89f90' : '#b7ae9f';
      ctx.fillRect(0, y, w, 7);
    }

    const cols = 6;
    const rows = 8;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = Math.abs(Math.sin(r * 19.3 + c * 43.7) * 9182.3);
        const lit = (seed % 1) > 0.56;
        const wx = c * cellW + 15;
        const wy = r * cellH + 14;
        const ww = cellW - 30;
        const wh = cellH - 24;

        // Recessed window frame
        ctx.fillStyle = '#5a554c';
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);

        // Glass pane
        ctx.fillStyle = lit ? '#6e5c3e' : '#25313e';
        ctx.fillRect(wx, wy, ww, wh);

        // Window mullion & subtle Porteño wrought-iron balcony bar
        ctx.fillStyle = '#332f2a';
        ctx.fillRect(wx + ww * 0.5 - 1.5, wy, 3, wh);
        ctx.fillRect(wx - 4, wy + wh - 10, ww + 8, 3);

        if (lit) {
          ectx.fillStyle = (seed * 7) % 1 > 0.35 ? '#ffd68a' : '#dbeafe';
          ectx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        }
      }
    }
  } else {
    // Modern corporate glass curtain wall (Av. 9 de Julio towers)
    ctx.fillStyle = '#1f2d3d';
    ctx.fillRect(0, 0, w, h);

    const cols = 8;
    const rows = 10;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = Math.abs(Math.sin(r * 31.1 + c * 17.9) * 4371.9);
        const lit = (seed % 1) > 0.52;
        const wx = c * cellW + 5;
        const wy = r * cellH + 6;
        const ww = cellW - 10;
        const wh = cellH - 12;

        const g = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        if (lit) {
          g.addColorStop(0, '#4f6d88');
          g.addColorStop(1, '#3b5266');
        } else {
          g.addColorStop(0, '#2a4156');
          g.addColorStop(1, '#1a2a3a');
        }
        ctx.fillStyle = g;
        ctx.fillRect(wx, wy, ww, wh);

        if (lit) {
          ectx.fillStyle = (seed * 3) % 1 > 0.45 ? '#bae6fd' : '#fde68a';
          ectx.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        }
      }
    }

    // Horizontal metallic spandrels
    ctx.fillStyle = '#334155';
    for (let r = 0; r < rows; r++) {
      ctx.fillRect(0, r * cellH, w, 5);
    }
  }

  const map = new THREE.CanvasTexture(cMap);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = Math.min(8, maxAnisotropy);
  map.needsUpdate = true;

  const emissive = new THREE.CanvasTexture(cEm);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = THREE.RepeatWrapping;
  emissive.wrapT = THREE.RepeatWrapping;
  emissive.anisotropy = Math.min(8, maxAnisotropy);
  emissive.needsUpdate = true;

  return { map, emissive };
}

export function createBuenosAiresTextures(maxAnisotropy: number): BuenosAiresTextures {
  const classic = makeFacadePair(maxAnisotropy, 'classic');
  const modern = makeFacadePair(maxAnisotropy, 'modern');

  // Vertical garden lush moss & foliage texture for the giant green "BA"
  const vgCanvas = document.createElement('canvas');
  vgCanvas.width = 256;
  vgCanvas.height = 256;
  const vgCtx = vgCanvas.getContext('2d')!;
  vgCtx.fillStyle = '#255c24';
  vgCtx.fillRect(0, 0, 256, 256);
  const greens = ['#2d6e29', '#3f8f33', '#52ad3d', '#1e4d1e', '#6bc44b', '#337a2d'];
  for (let i = 0; i < 1600; i++) {
    const px = Math.abs((Math.sin(i * 17.13) * 43758.5) % 1) * 256;
    const py = Math.abs((Math.sin(i * 61.79) * 29312.7) % 1) * 256;
    const rx = 2.5 + (i % 5);
    const ry = 2.0 + ((i * 3) % 4);
    vgCtx.fillStyle = greens[i % greens.length];
    vgCtx.beginPath();
    vgCtx.ellipse(px, py, rx, ry, (i * 0.7) % Math.PI, 0, Math.PI * 2);
    vgCtx.fill();
  }
  const verticalGarden = new THREE.CanvasTexture(vgCanvas);
  verticalGarden.colorSpace = THREE.SRGBColorSpace;
  verticalGarden.wrapS = THREE.RepeatWrapping;
  verticalGarden.wrapT = THREE.RepeatWrapping;
  verticalGarden.repeat.set(2, 2);
  verticalGarden.anisotropy = Math.min(8, maxAnisotropy);
  verticalGarden.needsUpdate = true;

  // Plaza de la República granite stone pavers
  const plCanvas = document.createElement('canvas');
  plCanvas.width = 256;
  plCanvas.height = 256;
  const plCtx = plCanvas.getContext('2d')!;
  plCtx.fillStyle = '#7b8088';
  plCtx.fillRect(0, 0, 256, 256);
  const tile = 32;
  for (let ty = 0; ty < 256; ty += tile) {
    for (let tx = 0; tx < 256; tx += tile) {
      const shade = ((tx / tile + ty / tile) % 2 === 0 ? 1 : -1) * 8;
      plCtx.fillStyle = `rgb(${124 + shade}, ${128 + shade}, ${134 + shade})`;
      plCtx.fillRect(tx + 1, ty + 1, tile - 2, tile - 2);
    }
  }
  const plazaPaver = new THREE.CanvasTexture(plCanvas);
  plazaPaver.colorSpace = THREE.SRGBColorSpace;
  plazaPaver.wrapS = THREE.RepeatWrapping;
  plazaPaver.wrapT = THREE.RepeatWrapping;
  plazaPaver.repeat.set(6, 6);
  plazaPaver.anisotropy = Math.min(8, maxAnisotropy);
  plazaPaver.needsUpdate = true;

  // Metrobus totem sign ("METROBUS 9 DE JULIO")
  const mbCanvas = document.createElement('canvas');
  mbCanvas.width = 256;
  mbCanvas.height = 512;
  const mbCtx = mbCanvas.getContext('2d')!;
  mbCtx.fillStyle = '#1e293b';
  mbCtx.fillRect(0, 0, 256, 512);
  mbCtx.fillStyle = '#eab308';
  mbCtx.fillRect(0, 0, 256, 76);
  mbCtx.fillStyle = '#0ea5e9';
  mbCtx.fillRect(0, 76, 256, 18);
  mbCtx.fillStyle = '#0f172a';
  mbCtx.font = '900 32px system-ui, sans-serif';
  mbCtx.textAlign = 'center';
  mbCtx.fillText('METROBUS', 128, 50);
  mbCtx.fillStyle = '#f8fafc';
  mbCtx.font = '700 24px system-ui, sans-serif';
  mbCtx.fillText('9 DE JULIO', 128, 138);
  mbCtx.fillStyle = '#38bdf8';
  mbCtx.fillRect(28, 166, 200, 4);
  mbCtx.fillStyle = '#cbd5e1';
  mbCtx.font = '800 26px system-ui, sans-serif';
  mbCtx.fillText('OBELISCO', 128, 218);
  const lines = ['9', '10', '17', '45', '59', '67', '70', '100'];
  lines.forEach((ln, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const bx = 36 + col * 96;
    const by = 255 + row * 52;
    mbCtx.fillStyle = idx % 3 === 0 ? '#facc15' : '#38bdf8';
    mbCtx.fillRect(bx, by, 84, 38);
    mbCtx.fillStyle = '#0f172a';
    mbCtx.font = '900 22px system-ui, sans-serif';
    mbCtx.fillText(ln, bx + 42, by + 27);
  });
  const metrobusSign = new THREE.CanvasTexture(mbCanvas);
  metrobusSign.colorSpace = THREE.SRGBColorSpace;
  metrobusSign.anisotropy = Math.min(8, maxAnisotropy);
  metrobusSign.needsUpdate = true;

  // Classic Porteño Colectivo side livery (Línea 59 / 17 inspired)
  const busCanvas = document.createElement('canvas');
  busCanvas.width = 512;
  busCanvas.height = 256;
  const bCtx = busCanvas.getContext('2d')!;
  bCtx.fillStyle = '#f1f5f9';
  bCtx.fillRect(0, 0, 512, 256);
  // Roof stripe & skirt stripe
  bCtx.fillStyle = '#0284c7';
  bCtx.fillRect(0, 0, 512, 34);
  bCtx.fillStyle = '#eab308';
  bCtx.fillRect(0, 148, 512, 28);
  bCtx.fillStyle = '#0f172a';
  bCtx.fillRect(0, 176, 512, 80);
  // Dark tinted passenger windows
  bCtx.fillStyle = '#132030';
  for (let wx = 26; wx < 470; wx += 74) {
    bCtx.fillRect(wx, 44, 62, 86);
  }
  bCtx.fillStyle = '#0f172a';
  bCtx.font = '900 20px system-ui, sans-serif';
  bCtx.textAlign = 'center';
  bCtx.fillText('METROBUS 9 DE JULIO · BS. AS.', 256, 169);
  const busLivery = new THREE.CanvasTexture(busCanvas);
  busLivery.colorSpace = THREE.SRGBColorSpace;
  busLivery.anisotropy = Math.min(8, maxAnisotropy);
  busLivery.needsUpdate = true;

  // Illuminated rooftop billboards for Av. 9 de Julio / Corrientes skyline
  const makeBillboard = (bg: string, accent: string, title: string, sub: string) => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 192;
    const c = cv.getContext('2d')!;
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 192);
    c.strokeStyle = accent;
    c.lineWidth = 8;
    c.strokeRect(8, 8, 496, 176);
    c.fillStyle = '#ffffff';
    c.font = '900 54px system-ui, sans-serif';
    c.textAlign = 'center';
    c.fillText(title, 256, 98);
    c.fillStyle = accent;
    c.font = '700 26px system-ui, sans-serif';
    c.fillText(sub, 256, 148);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAnisotropy);
    t.needsUpdate = true;
    return t;
  };

  const billboardA = makeBillboard('#0c1e38', '#38bdf8', 'AV. 9 DE JULIO', 'BUENOS AIRES');
  const billboardB = makeBillboard('#231026', '#fbbf24', 'CORRIENTES', 'TEATROS · CAFÉS');

  return {
    classicFacade: classic.map,
    classicEmissive: classic.emissive,
    modernGlass: modern.map,
    modernEmissive: modern.emissive,
    verticalGarden,
    plazaPaver,
    metrobusSign,
    busLivery,
    billboardA,
    billboardB,
    dispose: () => {
      classic.map.dispose();
      classic.emissive.dispose();
      modern.map.dispose();
      modern.emissive.dispose();
      verticalGarden.dispose();
      plazaPaver.dispose();
      metrobusSign.dispose();
      busLivery.dispose();
      billboardA.dispose();
      billboardB.dispose();
    },
  };
}

