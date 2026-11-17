import * as THREE from 'three';
import {
  INK,
  createPaperGrainPattern,
  sketchArc,
  sketchArrow,
  sketchCircle,
  sketchLine,
  sketchPoly,
  sketchRect,
  sketchText,
} from './sketch2d.js';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  return tex;
}

export function createChapterPaperTexture(theme) {
  const w = 512;
  const h = 512;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const bgMap = {
    svenska: '#eef4fa',
    matte: '#e7f1f6',
    no: '#e5f3f3',
    slojd: '#eaedf5',
  };
  ctx.fillStyle = bgMap[theme] || '#eaedf5';
  ctx.fillRect(0, 0, w, h);

  const grain = createPaperGrainPattern(ctx);
  if (grain) {
    ctx.fillStyle = grain;
    ctx.fillRect(0, 0, w, h);
  }

  const step = 32;
  if (theme === 'svenska') {
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.22)';
    ctx.lineWidth = 1.6;
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (theme === 'matte') {
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.18)';
    ctx.lineWidth = 1.3;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (theme === 'no') {
    ctx.fillStyle = 'rgba(13, 148, 136, 0.28)';
    for (let x = step / 2; x < w; x += step) {
      for (let y = step / 2; y < h; y += step) {
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
    }
  } else {
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.14)';
    ctx.lineWidth = 1.5;
    for (let y = step; y < h; y += step * 2) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  return toTexture(canvas, 6, 1.5);
}

const platformTexCache = new Map();

export function getPlatformTexture(style = 'default', boilFrame = 0, shaking = false) {
  const key = `${style}:${boilFrame}:${shaking ? 1 : 0}`;
  if (platformTexCache.has(key)) return platformTexCache.get(key);

  const w = 256;
  const h = 96;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  const pad = 6;
  const bw = w - pad * 2;
  const bh = h - pad * 2;
  const seed = 42 + style.length * 13.7;

  ctx.clearRect(0, 0, w, h);

  if (style === 'ruler') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#c4d3e3', shadow: false });
    const ticks = 16;
    for (let i = 1; i < ticks; i++) {
      const tx = pad + (i / ticks) * bw;
      const th = i % 4 === 0 ? bh * 0.42 : bh * 0.24;
      sketchLine(ctx, tx, pad, tx, pad + th, seed + i * 3.1, boilFrame, {
        lineWidth: 2,
        wobble: 0.9,
        overshoot: 1,
        passes: 1,
      });
    }
  } else if (style === 'bookblock') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#cbd5e1', shadow: false });
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(pad + 2, pad + 2, 20, bh - 4);
    sketchLine(ctx, pad + 22, pad, pad + 22, h - pad, seed + 4, boilFrame, {
      lineWidth: 2,
      overshoot: 1,
      passes: 1,
    });
    sketchLine(ctx, pad + 32, cy - 8, w - pad - 14, cy - 8, seed + 8, boilFrame, {
      color: 'rgba(24, 34, 48, 0.25)',
      lineWidth: 1.8,
      passes: 1,
    });
    sketchLine(ctx, pad + 32, cy + 8, w - pad - 24, cy + 8, seed + 12, boilFrame, {
      color: 'rgba(24, 34, 48, 0.25)',
      lineWidth: 1.8,
      passes: 1,
    });
  } else if (style === 'setsquare') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#bae6fd', shadow: false });
    sketchLine(ctx, w * 0.25, cy, w * 0.75, cy, seed + 5, boilFrame, {
      color: 'rgba(14, 116, 144, 0.45)',
      lineWidth: 1.8,
      passes: 1,
    });
    for (let i = 1; i < 12; i++) {
      const tx = pad + (i / 12) * bw;
      sketchLine(ctx, tx, h - pad, tx, h - pad - 10, seed + i * 2.1, boilFrame, {
        lineWidth: 1.6,
        passes: 1,
      });
    }
  } else if (style === 'mathblock') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#e0f2fe', shadow: false });
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.24)';
    ctx.lineWidth = 1.4;
    for (let gx = pad + 24; gx < w - pad; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, pad);
      ctx.lineTo(gx, h - pad);
      ctx.stroke();
    }
    for (let gy = pad + 24; gy < h - pad; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(pad, gy);
      ctx.lineTo(w - pad, gy);
      ctx.stroke();
    }
  } else if (style === 'iceblock') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#cffafe', shadow: false });
    sketchLine(ctx, w * 0.2, h * 0.28, w * 0.34, h * 0.72, seed + 3, boilFrame, {
      color: '#ffffff',
      lineWidth: 3.0,
      passes: 1,
    });
    sketchLine(ctx, w * 0.56, h * 0.25, w * 0.72, h * 0.7, seed + 7, boilFrame, {
      color: '#ffffff',
      lineWidth: 3.0,
      passes: 1,
    });
  } else if (style === 'springpad') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#a5f3fc', shadow: false });
    for (let b = -1; b <= 1; b++) {
      sketchCircle(ctx, cx + b * 55, cy, 10, seed + b * 9, boilFrame, {
        color: '#0e7490',
        lineWidth: 2.4,
        passes: 1,
      });
    }
  } else if (style === 'corkblock') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#cbd5e1', hatch: true, shadow: false });
  } else if (style === 'woodblock') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#d8e2ec', shadow: false });
    sketchLine(ctx, pad + 14, cy - 12, w - pad - 14, cy - 8, seed + 3, boilFrame, {
      color: 'rgba(51, 65, 85, 0.32)',
      lineWidth: 1.8,
      passes: 1,
    });
    sketchLine(ctx, pad + 18, cy + 12, w - pad - 16, cy + 9, seed + 7, boilFrame, {
      color: 'rgba(51, 65, 85, 0.32)',
      lineWidth: 1.8,
      passes: 1,
    });
  } else if (style === 'crumble') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, {
      fill: shaking ? '#fecdd3' : '#f1f5f9',
      shadow: false,
      lineWidth: 2.2,
    });
    sketchLine(ctx, cx - 12, pad, cx + 8, h - pad, seed + 19, boilFrame, {
      color: 'rgba(24, 34, 48, 0.55)',
      lineWidth: 2.0,
      passes: 1,
    });
  } else if (style === 'eraser') {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#e2ecf5', shadow: false });
    ctx.fillStyle = '#5b8ec9';
    ctx.fillRect(w * 0.68, pad + 1, w * 0.32 - pad - 1, bh - 2);
    sketchLine(ctx, w * 0.68, pad, w * 0.68, h - pad, seed + 9, boilFrame, {
      lineWidth: 2.5,
      overshoot: 1.5,
    });
  } else if (style.startsWith('postit')) {
    const colorMap = {
      'postit-yellow': '#b8e4f9',
      'postit-pink': '#cbd5f0',
      'postit-mint': '#b3ebe2',
    };
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, {
      fill: colorMap[style] || '#b8e4f9',
      shadow: false,
    });
  } else {
    sketchRect(ctx, cx, cy, bw, bh, seed, boilFrame, { fill: '#d5e1ee', hatch: true, shadow: false });
  }

  const tex = toTexture(canvas);
  platformTexCache.set(key, tex);
  return tex;
}

export function createSignTexture(sign) {
  const w = 360;
  const h = 160;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  sketchText(ctx, sign.text, w / 2, 46, 101, 0, {
    color: 'rgba(24, 34, 48, 0.92)',
    fontSize: 28,
    weight: '800',
    tilt: sign.tilt || 0,
    underline: true,
    wobble: 1.0,
  });

  if (sign.subtext) {
    sketchText(ctx, sign.subtext, w / 2, 82, 108, 0, {
      color: 'rgba(51, 65, 85, 0.8)',
      fontSize: 16,
      weight: '700',
      tilt: sign.tilt || 0,
      wobble: 0.8,
    });
  }

  if (sign.arrowTo) {
    const dx = Math.max(-90, Math.min(90, (sign.arrowTo.x - sign.x) * 26));
    const dy = Math.max(18, Math.min(54, (sign.y - sign.arrowTo.y) * 24));
    sketchArrow(ctx, w / 2, 98, w / 2 + dx, 98 + dy, 121, 0, {
      color: 'rgba(30, 41, 59, 0.8)',
      lineWidth: 2.6,
      headSize: 12,
      curve: sign.curve || 0,
      wobble: 1.2,
    });
  }

  return toTexture(canvas);
}

const doodleTexCache = new Map();

export function getDoodleTexture(kind, seed = 10) {
  if (doodleTexCache.has(kind)) return doodleTexCache.get(kind);
  const w = 160;
  const h = 160;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const sx = w / 2;
  const sy = h / 2;
  const r = 46;
  const strokeOpts = {
    color: 'rgba(71, 85, 105, 0.42)',
    lineWidth: 2.2,
    wobble: 1.6,
    overshoot: 1.8,
    passes: 1,
  };

  switch (kind) {
    case 'spiral': {
      const pts = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = t * Math.PI * 4.5;
        const rad = t * r * 0.95;
        pts.push({ x: sx + Math.cos(a) * rad, y: sy + Math.sin(a) * rad });
      }
      sketchPoly(ctx, pts, false, seed, 0, strokeOpts);
      break;
    }
    case 'paperclip': {
      const pw = r * 0.48;
      const ph = r * 0.95;
      sketchPoly(
        ctx,
        [
          { x: sx - pw * 0.4, y: sy + ph * 0.35 },
          { x: sx - pw * 0.4, y: sy - ph * 0.65 },
          { x: sx + pw * 0.45, y: sy - ph * 0.65 },
          { x: sx + pw * 0.45, y: sy + ph * 0.7 },
          { x: sx - pw * 0.75, y: sy + ph * 0.7 },
          { x: sx - pw * 0.75, y: sy - ph * 0.9 },
          { x: sx + pw * 0.75, y: sy - ph * 0.9 },
          { x: sx + pw * 0.75, y: sy + ph * 0.25 },
        ],
        false,
        seed,
        0,
        strokeOpts
      );
      break;
    }
    case 'triangle':
      sketchPoly(
        ctx,
        [
          { x: sx - r * 0.85, y: sy + r * 0.65 },
          { x: sx + r * 0.85, y: sy + r * 0.65 },
          { x: sx - r * 0.85, y: sy - r * 0.75 },
        ],
        true,
        seed,
        0,
        strokeOpts
      );
      break;
    case 'compass':
      sketchCircle(ctx, sx, sy - r * 0.85, r * 0.16, seed, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.08, sy - r * 0.7, sx - r * 0.58, sy + r * 0.75, seed + 3, 0, strokeOpts);
      sketchLine(ctx, sx + r * 0.08, sy - r * 0.7, sx + r * 0.58, sy + r * 0.75, seed + 6, 0, strokeOpts);
      break;
    case 'pi':
      sketchLine(ctx, sx - r * 0.75, sy - r * 0.45, sx + r * 0.75, sy - r * 0.5, seed, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.3, sy - r * 0.47, sx - r * 0.42, sy + r * 0.55, seed + 4, 0, strokeOpts);
      sketchLine(ctx, sx + r * 0.28, sy - r * 0.48, sx + r * 0.32, sy + r * 0.55, seed + 8, 0, strokeOpts);
      break;
    case 'abc':
      sketchText(ctx, 'A B C', sx, sy, seed, 0, {
        color: 'rgba(51, 65, 85, 0.42)',
        fontSize: 24,
        weight: '800',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
      });
      break;
    case 'quote':
      sketchText(ctx, '“...”', sx, sy, seed, 0, {
        color: 'rgba(51, 65, 85, 0.42)',
        fontSize: 28,
        weight: '800',
        fontFamily: 'Georgia, serif',
      });
      break;
    case 'math_eq':
      sketchText(ctx, 'x² + y² = r²', sx, sy, seed, 0, {
        color: 'rgba(14, 116, 144, 0.46)',
        fontSize: 20,
        weight: '700',
        fontFamily: '"Segoe UI", system-ui, sans-serif',
      });
      break;
    case 'flask':
      sketchPoly(
        ctx,
        [
          { x: sx - r * 0.22, y: sy - r * 0.85 },
          { x: sx - r * 0.22, y: sy - r * 0.35 },
          { x: sx - r * 0.72, y: sy + r * 0.65 },
          { x: sx + r * 0.72, y: sy + r * 0.65 },
          { x: sx + r * 0.22, y: sy - r * 0.35 },
          { x: sx + r * 0.22, y: sy - r * 0.85 },
        ],
        true,
        seed,
        0,
        strokeOpts
      );
      break;
    case 'atom':
      sketchCircle(ctx, sx, sy, r * 0.16, seed, 0, strokeOpts);
      sketchCircle(ctx, sx, sy, r * 0.75, seed + 4, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.9, sy - r * 0.5, sx + r * 0.9, sy + r * 0.5, seed + 8, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.9, sy + r * 0.5, sx + r * 0.9, sy - r * 0.5, seed + 12, 0, strokeOpts);
      break;
    case 'scissors':
      sketchCircle(ctx, sx - r * 0.55, sy - r * 0.35, r * 0.24, seed, 0, strokeOpts);
      sketchCircle(ctx, sx - r * 0.55, sy + r * 0.35, r * 0.24, seed + 4, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.32, sy - r * 0.22, sx + r * 0.85, sy + r * 0.25, seed + 8, 0, strokeOpts);
      sketchLine(ctx, sx - r * 0.32, sy + r * 0.22, sx + r * 0.85, sy - r * 0.25, seed + 12, 0, strokeOpts);
      break;
    default:
      sketchArc(ctx, sx, sy, r * 0.65, 0.2, Math.PI * 1.6, seed, 0, strokeOpts);
      break;
  }

  const tex = toTexture(canvas);
  doodleTexCache.set(kind, tex);
  return tex;
}
