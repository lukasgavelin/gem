// Deterministic 2D hand-drawn "boiling lines" pencil rendering helpers

export const INK = '#182230';
export const BOIL_FPS = 8;

// Fast deterministic pseudo-random in [-1, 1]
export function hash2(seed, boilFrame) {
  let n = Math.sin(seed * 127.1 + boilFrame * 311.7) * 43758.5453123;
  return (n - Math.floor(n)) * 2 - 1;
}

export function sketchLine(ctx, x1, y1, x2, y2, seed, boilFrame, opts = {}) {
  const {
    color = INK,
    lineWidth = 2.2,
    wobble = 2.0,
    overshoot = 3.5,
    passes = 2,
    alpha = 0.9,
  } = opts;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const prevAlpha = ctx.globalAlpha;

  for (let p = 0; p < passes; p++) {
    const s = seed + p * 17.3;
    const j1x = hash2(s + 1.1, boilFrame) * wobble;
    const j1y = hash2(s + 2.3, boilFrame) * wobble;
    const j2x = hash2(s + 3.7, boilFrame) * wobble;
    const j2y = hash2(s + 4.9, boilFrame) * wobble;
    const midX = (x1 + x2) * 0.5 + hash2(s + 6.1, boilFrame) * wobble * 1.1;
    const midY = (y1 + y2) * 0.5 + hash2(s + 7.3, boilFrame) * wobble * 1.1;

    ctx.globalAlpha = prevAlpha * (p === 0 ? alpha : alpha * 0.45);
    ctx.lineWidth = p === 0 ? lineWidth : lineWidth * 0.72;

    ctx.beginPath();
    ctx.moveTo(x1 - ux * overshoot + j1x, y1 - uy * overshoot + j1y);
    ctx.quadraticCurveTo(midX, midY, x2 + ux * overshoot + j2x, y2 + uy * overshoot + j2y);
    ctx.stroke();
  }
  ctx.globalAlpha = prevAlpha;
}

export function sketchPoly(ctx, pts, closed, seed, boilFrame, opts = {}) {
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sketchLine(ctx, a.x, a.y, b.x, b.y, seed + i * 11.7, boilFrame, opts);
  }
}

export function sketchRect(ctx, x, y, w, h, seed, boilFrame, opts = {}) {
  const {
    fill = '#d5e1ee',
    hatch = false,
    shadow = true,
    lineWidth = 2.3,
    wobble = 1.8,
  } = opts;

  const hw = w / 2;
  const hh = h / 2;

  ctx.save();
  // Soft paper cutout drop shadow
  if (shadow) {
    ctx.fillStyle = 'rgba(24, 34, 48, 0.14)';
    ctx.fillRect(x - hw + 5, y - hh + 6, w, h);
  }

  // Base fill
  ctx.fillStyle = fill;
  ctx.fillRect(x - hw, y - hh, w, h);

  // Optional diagonal pencil hatching inside
  if (hatch) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - hw, y - hh, w, h);
    ctx.clip();

    ctx.strokeStyle = 'rgba(24, 34, 48, 0.14)';
    ctx.lineWidth = 1.2;
    const step = 9;
    for (let hx = x - hw - h; hx < x + hw + h; hx += step) {
      const j = hash2(seed + hx * 0.1, boilFrame) * 1.1;
      ctx.beginPath();
      ctx.moveTo(hx + j, y - hh);
      ctx.lineTo(hx + h * 0.7 + j, y + hh);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();

  // Boiling pencil outline
  const pts = [
    { x: x - hw, y: y - hh },
    { x: x + hw, y: y - hh },
    { x: x + hw, y: y + hh },
    { x: x - hw, y: y + hh },
  ];
  sketchPoly(ctx, pts, true, seed, boilFrame, { lineWidth, wobble, overshoot: 3.5 });
}

export function createPaperGrainPattern(ctx) {
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tctx = tile.getContext('2d');

  // Subtle paper fibers
  tctx.strokeStyle = 'rgba(30, 45, 65, 0.045)';
  tctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 180;
    const y = Math.random() * 180;
    const a = Math.random() * Math.PI * 2;
    const len = 4 + Math.random() * 8;
    tctx.beginPath();
    tctx.moveTo(x, y);
    tctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    tctx.stroke();
  }

  // Tiny speckles
  tctx.fillStyle = 'rgba(24, 34, 48, 0.03)';
  for (let i = 0; i < 110; i++) {
    tctx.fillRect(Math.random() * 180, Math.random() * 180, 1.5, 1.5);
  }

  return ctx.createPattern(tile, 'repeat');
}

export function sketchArc(ctx, cx, cy, r, startAngle, endAngle, seed, boilFrame, opts = {}) {
  const {
    segments = 16,
    color = INK,
    lineWidth = 2.0,
    wobble = 1.6,
    overshoot = 1.5,
    passes = 2,
    alpha = 0.9,
  } = opts;

  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  sketchPoly(ctx, pts, false, seed, boilFrame, {
    color,
    lineWidth,
    wobble,
    overshoot,
    passes,
    alpha,
  });
}

export function sketchCircle(ctx, cx, cy, r, seed, boilFrame, opts = {}) {
  const {
    segments = 16,
    color = INK,
    lineWidth = 2.0,
    wobble = 1.6,
    overshoot = 1.5,
    passes = 2,
    alpha = 0.9,
  } = opts;

  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  sketchPoly(ctx, pts, true, seed, boilFrame, {
    color,
    lineWidth,
    wobble,
    overshoot,
    passes,
    alpha,
  });
}

export function sketchArrow(ctx, x1, y1, x2, y2, seed, boilFrame, opts = {}) {
  const {
    color = INK,
    lineWidth = 2.1,
    wobble = 1.6,
    headSize = 11,
    passes = 2,
    alpha = 0.88,
    curve = 0,
  } = opts;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  if (Math.abs(curve) > 0.5) {
    const midX = (x1 + x2) * 0.5 + nx * curve;
    const midY = (y1 + y2) * 0.5 + ny * curve;
    sketchLine(ctx, x1, y1, midX, midY, seed, boilFrame, {
      color,
      lineWidth,
      wobble,
      overshoot: 1.5,
      passes,
      alpha,
    });
    sketchLine(ctx, midX, midY, x2, y2, seed + 5.7, boilFrame, {
      color,
      lineWidth,
      wobble,
      overshoot: 1.5,
      passes,
      alpha,
    });
    const tx = x2 - midX;
    const ty = y2 - midY;
    const tlen = Math.hypot(tx, ty) || 1;
    const tux = tx / tlen;
    const tuy = ty / tlen;
    const tnx = -tuy;
    const tny = tux;
    const h1x = x2 - tux * headSize + tnx * headSize * 0.55;
    const h1y = y2 - tuy * headSize + tny * headSize * 0.55;
    const h2x = x2 - tux * headSize - tnx * headSize * 0.55;
    const h2y = y2 - tuy * headSize - tny * headSize * 0.55;
    sketchLine(ctx, h1x, h1y, x2, y2, seed + 13.1, boilFrame, {
      color,
      lineWidth,
      wobble: wobble * 0.8,
      overshoot: 1.5,
      passes,
      alpha,
    });
    sketchLine(ctx, h2x, h2y, x2, y2, seed + 19.3, boilFrame, {
      color,
      lineWidth,
      wobble: wobble * 0.8,
      overshoot: 1.5,
      passes,
      alpha,
    });
    return;
  }

  sketchLine(ctx, x1, y1, x2, y2, seed, boilFrame, {
    color,
    lineWidth,
    wobble,
    overshoot: 2,
    passes,
    alpha,
  });

  const h1x = x2 - ux * headSize + nx * headSize * 0.55;
  const h1y = y2 - uy * headSize + ny * headSize * 0.55;
  const h2x = x2 - ux * headSize - nx * headSize * 0.55;
  const h2y = y2 - uy * headSize - ny * headSize * 0.55;
  sketchLine(ctx, h1x, h1y, x2, y2, seed + 13.1, boilFrame, {
    color,
    lineWidth,
    wobble: wobble * 0.8,
    overshoot: 1.5,
    passes,
    alpha,
  });
  sketchLine(ctx, h2x, h2y, x2, y2, seed + 19.3, boilFrame, {
    color,
    lineWidth,
    wobble: wobble * 0.8,
    overshoot: 1.5,
    passes,
    alpha,
  });
}

export function sketchText(ctx, text, x, y, seed, boilFrame, opts = {}) {
  const {
    color = INK,
    fontSize = 18,
    weight = '700',
    fontFamily = '"Patrick Hand", "Chalkboard SE", "Comic Sans MS", "Bradley Hand", cursive, sans-serif',
    align = 'center',
    baseline = 'middle',
    wobble = 1.1,
    alpha = 0.88,
    tilt = 0,
    underline = false,
  } = opts;

  const jx = hash2(seed + 1.3, boilFrame) * wobble;
  const jy = hash2(seed + 2.9, boilFrame) * wobble;
  const jRot = tilt + hash2(seed + 4.7, boilFrame) * 0.022;

  ctx.save();
  ctx.translate(x + jx, y + jy);
  ctx.rotate(jRot);
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;

  // Faint secondary graphite pass for hand-lettered boil feel
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha * 0.28;
  ctx.fillText(
    text,
    hash2(seed + 8.1, boilFrame) * 1.1 + 0.8,
    hash2(seed + 9.4, boilFrame) * 1.1 + 0.6
  );

  ctx.globalAlpha = alpha;
  ctx.fillText(text, 0, 0);

  if (underline) {
    const metrics = ctx.measureText(text);
    const w = metrics.width;
    const ux1 = align === 'center' ? -w * 0.52 : align === 'right' ? -w : 0;
    const ux2 = ux1 + w * 1.04;
    const uy = fontSize * 0.56;
    sketchLine(ctx, ux1, uy, ux2, uy, seed + 15.2, boilFrame, {
      color,
      lineWidth: 1.6,
      wobble: 1.0,
      overshoot: 2,
      passes: 1,
      alpha: alpha * 0.8,
    });
  }
  ctx.restore();
}
