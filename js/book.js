import {
  BOIL_FPS,
  INK,
  createPaperGrainPattern,
  hash2,
  sketchArc,
  sketchArrow,
  sketchCircle,
  sketchLine,
  sketchPoly,
  sketchRect,
  sketchText,
} from './sketch2d.js';

export const PPU = 54; // Pixels per world unit

export class BookWorld {
  constructor() {
    this.sections = [];
    this.platforms = [];
    this.hazards = [];
    this.stars = [];
    this.checkpoints = [];
    this.goal = null;
    this.signs = [];
    this.doodles = [];
    this.motes = [];
    this.paperPattern = null;
    this.creaseGrad = null;
  }

  loadWorld(worldData) {
    this.sections = worldData.sections;

    this.platforms = worldData.platforms.map((p, idx) => ({
      ...p,
      baseX: p.x,
      baseY: p.y,
      prevX: p.x,
      prevY: p.y,
      bounce: p.bounce || 0,
      bounceAnim: 0,
      crumble: Boolean(p.crumble),
      crumbleState: 'solid',
      crumbleTimer: 0,
      slippery: Boolean(p.slippery),
      seed: 100 + idx * 31.7,
    }));

    this.hazards = worldData.hazards.map((h, idx) => ({
      ...h,
      seed: 900 + idx * 27.3,
    }));

    this.stars = worldData.stars.map((s, idx) => ({
      ...s,
      baseY: s.y,
      collected: false,
      seed: 1500 + idx * 19.1,
    }));

    this.checkpoints = worldData.checkpoints.map((cp, idx) => ({
      ...cp,
      activated: false,
      seed: 2100 + idx * 23.9,
    }));

    this.goal = { ...worldData.goal, radius: 1.0, seed: 2800 };

    // Tutorial & custom paper signposts
    this.signs = (worldData.signs || []).map((s, idx) => ({
      ...s,
      seed: 4200 + idx * 37.1,
    }));

    // Section-specific background hand-drawn pencil doodles
    this.doodles = this._buildSectionDoodles(this.sections);

    // Floating graphite dust motes
    this.motes = [];
    for (let i = 0; i < 150; i++) {
      this.motes.push({
        x: Math.random() * 420 - 5,
        y: (Math.random() - 0.5) * 13,
        phase: Math.random() * Math.PI * 2,
        r: 1.2 + Math.random() * 1.4,
      });
    }
  }

  update(time, dt) {
    for (const p of this.platforms) {
      p.prevX = p.x;
      p.prevY = p.y;
      if (p.move) {
        const offset = Math.sin(time * p.move.speed) * p.move.range;
        if (p.move.axis === 'x') p.x = p.baseX + offset;
        else p.y = p.baseY + offset;
      }

      if (p.bounceAnim > 0) {
        p.bounceAnim = Math.max(0, p.bounceAnim - dt * 5.5);
      }

      if (p.crumble) {
        if (p.crumbleState === 'shaking') {
          p.crumbleTimer -= dt;
          if (p.crumbleTimer <= 0) {
            p.crumbleState = 'fallen';
            p.crumbleTimer = 2.4;
          }
        } else if (p.crumbleState === 'fallen') {
          p.crumbleTimer -= dt;
          if (p.crumbleTimer <= 0) {
            p.crumbleState = 'solid';
          }
        }
      }
    }

    for (const s of this.stars) {
      if (!s.collected) {
        s.y = s.baseY + Math.sin(time * 3.2 + s.x) * 0.12;
      }
    }
  }

  draw(ctx, camX, camY, viewW, viewH, time) {
    if (!this.paperPattern) {
      this.paperPattern = createPaperGrainPattern(ctx);
    }

    const boilFrame = Math.floor(time * BOIL_FPS) % 3;

    // 1. Paper section backgrounds
    const leftWorldX = camX - viewW / (2 * PPU) - 1;
    const rightWorldX = camX + viewW / (2 * PPU) + 1;
    const topWorldY = camY + viewH / (2 * PPU) + 1;
    const bottomWorldY = camY - viewH / (2 * PPU) - 1;

    ctx.save();
    // World transform: center of screen is (camX, camY), +Y is UP
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(PPU, -PPU);
    ctx.translate(-camX, -camY);

    // Draw section paper fills
    for (const sec of this.sections) {
      if (sec.endX < leftWorldX || sec.startX > rightWorldX) continue;
      const sx = Math.max(sec.startX, leftWorldX);
      const ex = Math.min(sec.endX, rightWorldX);
      const bgMap = {
        svenska: '#eef4fa',
        matte: '#e7f1f6',
        no: '#e5f3f3',
        slojd: '#eaedf5',
      };
      ctx.fillStyle = bgMap[sec.theme] || '#eaedf5';
      ctx.fillRect(sx, bottomWorldY, ex - sx, topWorldY - bottomWorldY);
    }

    ctx.restore();

    // Overlay paper fiber grain in screen space
    if (this.paperPattern) {
      ctx.save();
      ctx.fillStyle = this.paperPattern;
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.restore();
    }

    // Helper: world -> screen coords
    const toSX = (wx) => viewW / 2 + (wx - camX) * PPU;
    const toSY = (wy) => viewH / 2 - (wy - camY) * PPU;

    // 2. Draw paper lines / grids / page creases in screen space for crisp 1px-2px strokes
    this._drawPaperMarkings(ctx, leftWorldX, rightWorldX, topWorldY, bottomWorldY, toSX, toSY, viewH, boilFrame);

    // 3. Section-specific background boiling pencil doodles
    for (const d of this.doodles) {
      if (d.x < leftWorldX - 3 || d.x > rightWorldX + 3) continue;
      this._drawDoodle(ctx, d, toSX, toSY, boilFrame);
    }

    // 4. Platforms (+ moving platform tracks, highlights, motion lines & optional labels)
    for (const p of this.platforms) {
      if (p.move) {
        const minX = p.move.axis === 'x' ? p.baseX - p.move.range : p.x;
        const maxX = p.move.axis === 'x' ? p.baseX + p.move.range : p.x;
        if (maxX + p.w / 2 >= leftWorldX && minX - p.w / 2 <= rightWorldX) {
          this._drawMovingPlatformTrack(ctx, p, toSX, toSY, boilFrame);
        }
      }

      if (p.x + p.w / 2 < leftWorldX || p.x - p.w / 2 > rightWorldX) continue;
      const sx = toSX(p.x);
      const sy = toSY(p.y);
      const pw = p.w * PPU;
      const ph = p.h * PPU;

      ctx.save();
      const shakeSeed = p.seed + Math.floor(time * 32) * 1.7;
      const shakeX = p.crumbleState === 'shaking' ? hash2(shakeSeed, boilFrame) * 3.2 : 0;
      const shakeY = p.crumbleState === 'shaking' ? hash2(shakeSeed + 5.1, boilFrame) * 2.6 : 0;
      ctx.translate(sx + shakeX, sy + shakeY);
      if (p.tilt) ctx.rotate(-p.tilt);
      if (p.bounceAnim > 0) {
        const s = Math.sin(p.bounceAnim * Math.PI) * 0.28;
        ctx.scale(1 + s * 0.5, 1 - s);
      }

      if (p.crumbleState === 'fallen') {
        // Faint dashed outline showing where the block will respawn
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = 'rgba(24, 34, 48, 0.25)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
        ctx.restore();
      } else if (p.style === 'ruler') {
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#c4d3e3', hatch: false });
        const tickCount = Math.floor(p.w * 2.5);
        for (let i = 1; i < tickCount; i++) {
          const tx = -pw / 2 + (i / tickCount) * pw;
          const th = i % 4 === 0 ? ph * 0.42 : ph * 0.24;
          sketchLine(ctx, tx, -ph / 2, tx, -ph / 2 + th, p.seed + i * 3.1, boilFrame, {
            lineWidth: 1.5,
            wobble: 0.9,
            overshoot: 1,
            passes: 1,
          });
        }
      } else if (p.style === 'bookblock') {
        // Svenska: textbook with spine & page lines
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#cbd5e1', hatch: false });
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(-pw / 2 + 2, -ph / 2 + 2, 12, ph - 4);
        sketchLine(ctx, -pw / 2 + 14, -ph / 2, -pw / 2 + 14, ph / 2, p.seed + 4, boilFrame, {
          lineWidth: 1.6,
          overshoot: 1,
          passes: 1,
        });
        sketchLine(ctx, -pw / 2 + 20, -2, pw / 2 - 8, -2, p.seed + 8, boilFrame, {
          color: 'rgba(24, 34, 48, 0.25)',
          lineWidth: 1.2,
          passes: 1,
        });
        sketchLine(ctx, -pw / 2 + 20, 4, pw / 2 - 14, 4, p.seed + 12, boilFrame, {
          color: 'rgba(24, 34, 48, 0.25)',
          lineWidth: 1.2,
          passes: 1,
        });
      } else if (p.style === 'setsquare') {
        // Matematik: drafting set-square with inner cutout & ticks
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#bae6fd', hatch: false });
        if (pw > 60 && ph > 22) {
          sketchLine(ctx, -pw * 0.25, 0, pw * 0.25, 0, p.seed + 5, boilFrame, {
            color: 'rgba(14, 116, 144, 0.45)',
            lineWidth: 1.4,
            passes: 1,
          });
        }
        for (let i = 1; i < Math.floor(p.w * 2); i++) {
          const tx = -pw / 2 + (i / (p.w * 2)) * pw;
          sketchLine(ctx, tx, ph / 2, tx, ph / 2 - 6, p.seed + i * 2.1, boilFrame, {
            lineWidth: 1.2,
            passes: 1,
          });
        }
      } else if (p.style === 'mathblock') {
        // Matematik: grid block
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#e0f2fe', hatch: false });
        ctx.save();
        ctx.strokeStyle = 'rgba(14, 116, 144, 0.24)';
        ctx.lineWidth = 1;
        for (let gx = -pw / 2 + 14; gx < pw / 2; gx += 14) {
          ctx.beginPath();
          ctx.moveTo(gx, -ph / 2);
          ctx.lineTo(gx, ph / 2);
          ctx.stroke();
        }
        for (let gy = -ph / 2 + 14; gy < ph / 2; gy += 14) {
          ctx.beginPath();
          ctx.moveTo(-pw / 2, gy);
          ctx.lineTo(pw / 2, gy);
          ctx.stroke();
        }
        ctx.restore();
      } else if (p.style === 'iceblock') {
        // NO & Labb: slippery glass/ice block with frost sheen
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#cffafe', hatch: false });
        sketchLine(ctx, -pw * 0.35, -ph * 0.2, -pw * 0.15, ph * 0.25, p.seed + 3, boilFrame, {
          color: '#ffffff',
          lineWidth: 2.2,
          passes: 1,
        });
        sketchLine(ctx, pw * 0.05, -ph * 0.25, pw * 0.25, ph * 0.2, p.seed + 7, boilFrame, {
          color: '#ffffff',
          lineWidth: 2.2,
          passes: 1,
        });
      } else if (p.style === 'springpad') {
        // NO & Labb: bubbling high-bounce lab pad
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#a5f3fc', hatch: false });
        for (let b = -1; b <= 1; b++) {
          sketchCircle(ctx, b * (pw * 0.22), 0, 4.5, p.seed + b * 9, boilFrame, {
            color: '#0e7490',
            lineWidth: 1.6,
            passes: 1,
          });
        }
      } else if (p.style === 'corkblock') {
        // NO & Labb: speckled corkboard block
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#cbd5e1', hatch: true });
      } else if (p.style === 'woodblock') {
        // Slöjd & Bild: carpenter wood plank with grain & nail dots
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#d8e2ec', hatch: false });
        sketchLine(ctx, -pw / 2 + 8, -ph * 0.15, pw / 2 - 8, -ph * 0.1, p.seed + 3, boilFrame, {
          color: 'rgba(51, 65, 85, 0.3)',
          lineWidth: 1.3,
          passes: 1,
        });
        sketchLine(ctx, -pw / 2 + 12, ph * 0.18, pw / 2 - 10, ph * 0.14, p.seed + 7, boilFrame, {
          color: 'rgba(51, 65, 85, 0.3)',
          lineWidth: 1.3,
          passes: 1,
        });
      } else if (p.style === 'crumble') {
        // Slöjd & Bild: fragile crumbling paper block
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, {
          fill: p.crumbleState === 'shaking' ? '#fecdd3' : '#f1f5f9',
          hatch: false,
          lineWidth: 1.8,
        });
        // Crack line in middle
        sketchLine(ctx, -6, -ph / 2, 4, ph / 2, p.seed + 19, boilFrame, {
          color: 'rgba(24, 34, 48, 0.5)',
          lineWidth: 1.4,
          passes: 1,
        });
      } else if (p.style === 'eraser') {
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#e2ecf5', hatch: false });
        ctx.fillStyle = '#5b8ec9';
        ctx.fillRect(pw * 0.18, -ph / 2 + 1, pw * 0.32 - 1, ph - 2);
        sketchLine(ctx, pw * 0.18, -ph / 2, pw * 0.18, ph / 2, p.seed + 9, boilFrame, {
          lineWidth: 2,
          overshoot: 1.5,
        });
      } else if (p.style.startsWith('postit')) {
        const colorMap = {
          'postit-yellow': '#b8e4f9',
          'postit-pink': '#cbd5f0',
          'postit-mint': '#b3ebe2',
        };
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, {
          fill: colorMap[p.style] || '#b8e4f9',
          hatch: false,
        });
      } else {
        sketchRect(ctx, 0, 0, pw, ph, p.seed, boilFrame, { fill: '#d5e1ee', hatch: true });
      }

      if (p.move) {
        this._drawMovingPlatformEffects(ctx, p, pw, ph, time, boilFrame);
      }
      ctx.restore();

      if (p.label) {
        this._drawPlatformLabel(ctx, p, sx, sy, ph, boilFrame);
      }
    }

    // 4b. Paper tutorial & world signposts
    for (const sign of this.signs) {
      if (sign.x < leftWorldX - 4 || sign.x > rightWorldX + 4) continue;
      this._drawSign(ctx, sign, toSX, toSY, boilFrame);
    }

    // 5. Hazards (sketchy ink spikes)
    for (const h of this.hazards) {
      if (h.x + h.w / 2 < leftWorldX || h.x - h.w / 2 > rightWorldX) continue;
      const sx = toSX(h.x);
      const sy = toSY(h.y);
      const hw = h.w * PPU;
      const hh = h.h * PPU;

      sketchRect(ctx, sx, sy, hw, hh, h.seed, boilFrame, {
        fill: '#182230',
        shadow: false,
        lineWidth: 2,
      });

      const spikeCount = Math.max(3, Math.floor(h.w / 0.45));
      for (let i = 0; i < spikeCount; i++) {
        const t = spikeCount === 1 ? 0 : i / (spikeCount - 1) - 0.5;
        const cx = sx + t * (hw - 16);
        const by = sy - hh / 2;
        const ty = by - 14;
        ctx.fillStyle = '#182230';
        ctx.beginPath();
        ctx.moveTo(cx - 7, by);
        ctx.lineTo(cx, ty);
        ctx.lineTo(cx + 7, by);
        ctx.closePath();
        ctx.fill();
        sketchPoly(
          ctx,
          [
            { x: cx - 7, y: by },
            { x: cx, y: ty },
            { x: cx + 7, y: by },
          ],
          false,
          h.seed + i * 7.3,
          boilFrame,
          { lineWidth: 2, wobble: 1.6, overshoot: 2 }
        );
      }
    }

    // 6. Checkpoints (sketchy pin flags with crisp highlights & flutter lines)
    for (const cp of this.checkpoints) {
      if (cp.x < leftWorldX - 2 || cp.x > rightWorldX + 2) continue;
      this._drawCheckpoint(ctx, cp, toSX, toSY, time, boilFrame);
    }

    // 7. Stars
    for (const s of this.stars) {
      if (s.collected || s.x < leftWorldX - 1 || s.x > rightWorldX + 1) continue;
      const sx = toSX(s.x);
      const sy = toSY(s.y);
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 === 0 ? 0.38 : 0.16) * PPU;
        const angle = (i * Math.PI) / 5 - Math.PI / 2 + Math.sin(time * 2 + s.x) * 0.12;
        pts.push({ x: sx + Math.cos(angle) * r, y: sy + Math.sin(angle) * r });
      }
      ctx.save();
      ctx.fillStyle = 'rgba(24, 34, 48, 0.14)';
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x + 4, p.y + 5) : ctx.lineTo(p.x + 4, p.y + 5)));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#67e8f9';
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      sketchPoly(ctx, pts, true, s.seed, boilFrame, { lineWidth: 2.1, wobble: 1.7, overshoot: 2 });
    }

    // 8. Goal Bookmark Ribbon
    if (this.goal && this.goal.x > leftWorldX - 2 && this.goal.x < rightWorldX + 2) {
      const sx = toSX(this.goal.x);
      const sy = toSY(this.goal.y);
      const sway = Math.sin(time * 2.5) * 4;
      const pts = [
        { x: sx - 20, y: sy - 44 },
        { x: sx + 20, y: sy - 44 },
        { x: sx + 20 + sway, y: sy + 38 },
        { x: sx + sway, y: sy + 18 },
        { x: sx - 20 + sway, y: sy + 38 },
      ];
      ctx.save();
      ctx.fillStyle = 'rgba(24, 34, 48, 0.16)';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x + 5, p.y + 6) : ctx.lineTo(p.x + 5, p.y + 6)));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      sketchPoly(ctx, pts, true, this.goal.seed, boilFrame, { lineWidth: 2.4, wobble: 1.8 });
    }

    // 9. Floating graphite dust motes
    ctx.save();
    ctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
    for (const m of this.motes) {
      if (m.x < leftWorldX || m.x > rightWorldX) continue;
      const sx = toSX(m.x);
      const sy = toSY(m.y + Math.sin(time * 0.8 + m.phase) * 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawPaperMarkings(ctx, leftWX, rightWX, topWY, bottomWY, toSX, toSY, viewH, boilFrame) {
    ctx.save();
    for (const sec of this.sections) {
      if (sec.endX < leftWX || sec.startX > rightWX) continue;
      const sx1 = Math.max(0, toSX(sec.startX));
      const sx2 = toSX(sec.endX);

      if (sec.theme === 'svenska') {
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.2)';
        ctx.lineWidth = 1.4;
        const startY = Math.floor(bottomWY);
        for (let wy = startY; wy <= topWY; wy += 1.0) {
          const sy = toSY(wy) + hash2(wy * 7.1, boilFrame) * 0.8;
          ctx.beginPath();
          ctx.moveTo(sx1, sy);
          ctx.lineTo(sx2, sy);
          ctx.stroke();
        }
      } else if (sec.theme === 'matte') {
        ctx.strokeStyle = 'rgba(14, 116, 144, 0.16)';
        ctx.lineWidth = 1.1;
        const startX = Math.max(sec.startX, Math.floor(leftWX));
        for (let wx = startX; wx <= Math.min(sec.endX, rightWX); wx += 1.0) {
          const sx = toSX(wx) + hash2(wx * 5.3, boilFrame) * 0.6;
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx, viewH);
          ctx.stroke();
        }
        for (let wy = Math.floor(bottomWY); wy <= topWY; wy += 1.0) {
          const sy = toSY(wy) + hash2(wy * 5.3, boilFrame) * 0.6;
          ctx.beginPath();
          ctx.moveTo(sx1, sy);
          ctx.lineTo(sx2, sy);
          ctx.stroke();
        }
      } else if (sec.theme === 'no') {
        // Dotted lab notebook grid
        ctx.fillStyle = 'rgba(13, 148, 136, 0.25)';
        const startX = Math.max(sec.startX, Math.floor(leftWX));
        for (let wx = startX; wx <= Math.min(sec.endX, rightWX); wx += 1.0) {
          const sx = toSX(wx);
          for (let wy = Math.floor(bottomWY); wy <= topWY; wy += 1.0) {
            const sy = toSY(wy);
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
          }
        }
      } else {
        // Sketchbook wide guide lines
        ctx.strokeStyle = 'rgba(51, 65, 85, 0.12)';
        ctx.lineWidth = 1.3;
        for (let wy = Math.floor(bottomWY / 2) * 2; wy <= topWY; wy += 2.0) {
          const sy = toSY(wy) + hash2(wy * 3.7, boilFrame) * 0.8;
          ctx.beginPath();
          ctx.moveTo(sx1, sy);
          ctx.lineTo(sx2, sy);
          ctx.stroke();
        }
      }
    }

    // Vertical page-crease seams every 24 world units
    if (!this.creaseGrad) {
      const grad = ctx.createLinearGradient(-18, 0, 18, 0);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.08)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      this.creaseGrad = grad;
    }

    for (let wx = 24; wx <= 408; wx += 24) {
      if (wx < leftWX || wx > rightWX) continue;
      const sx = toSX(wx);
      ctx.save();
      ctx.translate(sx, 0);
      ctx.fillStyle = this.creaseGrad;
      ctx.fillRect(-18, 0, 36, viewH);
      ctx.restore();

      sketchLine(ctx, sx, 0, sx, viewH, wx * 13, boilFrame, {
        color: 'rgba(51, 65, 85, 0.25)',
        lineWidth: 1.5,
        wobble: 1.5,
        passes: 1,
      });
    }
    ctx.restore();
  }

  _buildSectionDoodles(sections) {
    const doodles = [];
    const themeKinds = {
      svenska: ['abc', 'pencil', 'book', 'quote', 'spiral', 'paperclip', 'squiggle'],
      matte: ['triangle', 'compass', 'pi', 'math_eq', 'protractor', 'cube'],
      no: ['flask', 'atom', 'dna', 'leaf', 'magnet'],
      slojd: ['scissors', 'hammer', 'brush', 'saw', 'plane', 'mountains'],
    };

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const pool = themeKinds[sec.theme] || themeKinds.slojd;
      const minX = Math.max(sec.startX + 4, 4);
      const maxX = Math.min(sec.endX - 4, 408);
      const span = Math.max(10, maxX - minX);
      const count = Math.max(6, Math.round(span / 6.2));

      for (let i = 0; i < count; i++) {
        const x = minX + ((i + 0.5) / count) * span;
        const y = i % 2 === 0 ? 3.2 + (i % 3) * 0.65 : -3.8 - (i % 3) * 0.45;
        doodles.push({
          x,
          y,
          kind: pool[i % pool.length],
          seed: 3300 + sIdx * 211 + i * 41.2,
        });
      }
    }
    return doodles;
  }

  _drawDoodle(ctx, d, toSX, toSY, boilFrame) {
    const sx = toSX(d.x);
    const sy = toSY(d.y);
    const r = 0.65 * PPU;
    const strokeOpts = {
      color: 'rgba(71, 85, 105, 0.32)',
      lineWidth: 1.7,
      wobble: 1.8,
      overshoot: 1.8,
      passes: 1,
    };

    switch (d.kind) {
      case 'spiral': {
        const pts = [];
        const steps = 26;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const a = t * Math.PI * 4.5;
          const rad = t * r * 0.95;
          pts.push({ x: sx + Math.cos(a) * rad, y: sy + Math.sin(a) * rad });
        }
        sketchPoly(ctx, pts, false, d.seed, boilFrame, strokeOpts);
        break;
      }
      case 'paperclip': {
        const w = r * 0.48;
        const h = r * 0.95;
        const pts = [
          { x: sx - w * 0.4, y: sy + h * 0.35 },
          { x: sx - w * 0.4, y: sy - h * 0.65 },
          { x: sx + w * 0.45, y: sy - h * 0.65 },
          { x: sx + w * 0.45, y: sy + h * 0.7 },
          { x: sx - w * 0.75, y: sy + h * 0.7 },
          { x: sx - w * 0.75, y: sy - h * 0.9 },
          { x: sx + w * 0.75, y: sy - h * 0.9 },
          { x: sx + w * 0.75, y: sy + h * 0.25 },
        ];
        sketchPoly(ctx, pts, false, d.seed, boilFrame, strokeOpts);
        break;
      }
      case 'squiggle': {
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12 - 0.5;
          pts.push({
            x: sx + t * r * 2.1,
            y: sy + Math.sin(i * 1.4) * r * 0.38,
          });
        }
        sketchPoly(ctx, pts, false, d.seed, boilFrame, strokeOpts);
        break;
      }
      case 'triangle': {
        // Right triangle with right-angle square & angle arc
        const ax = sx - r * 0.85;
        const ay = sy + r * 0.65;
        const bx = sx + r * 0.85;
        const by = sy + r * 0.65;
        const cx = sx - r * 0.85;
        const cy = sy - r * 0.75;
        sketchPoly(ctx, [{ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }], true, d.seed, boilFrame, strokeOpts);
        const sq = r * 0.28;
        sketchPoly(
          ctx,
          [{ x: ax, y: ay - sq }, { x: ax + sq, y: ay - sq }, { x: ax + sq, y: ay }],
          false,
          d.seed + 7,
          boilFrame,
          strokeOpts
        );
        sketchArc(ctx, bx, by, r * 0.42, Math.PI, Math.PI + 0.68, d.seed + 13, boilFrame, {
          ...strokeOpts,
          segments: 6,
        });
        break;
      }
      case 'compass': {
        // Drafting compass with head, legs & dashed arc
        const topY = sy - r * 0.95;
        sketchCircle(ctx, sx, topY, r * 0.16, d.seed, boilFrame, { ...strokeOpts, segments: 10 });
        sketchLine(ctx, sx - r * 0.08, topY + r * 0.14, sx - r * 0.58, sy + r * 0.75, d.seed + 3, boilFrame, strokeOpts);
        sketchLine(ctx, sx + r * 0.08, topY + r * 0.14, sx + r * 0.58, sy + r * 0.75, d.seed + 6, boilFrame, strokeOpts);
        sketchArc(ctx, sx - r * 0.58, sy + r * 0.75, r * 1.15, -0.5, 0.25, d.seed + 11, boilFrame, {
          ...strokeOpts,
          segments: 8,
        });
        break;
      }
      case 'pi': {
        // Hand-drawn pi symbol & small reference circle
        sketchLine(ctx, sx - r * 0.75, sy - r * 0.45, sx + r * 0.75, sy - r * 0.5, d.seed, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.3, sy - r * 0.47, sx - r * 0.42, sy + r * 0.55, d.seed + 4, boilFrame, strokeOpts);
        sketchLine(ctx, sx + r * 0.28, sy - r * 0.48, sx + r * 0.32, sy + r * 0.55, d.seed + 8, boilFrame, strokeOpts);
        sketchCircle(ctx, sx + r * 1.1, sy - r * 0.1, r * 0.32, d.seed + 14, boilFrame, {
          ...strokeOpts,
          segments: 12,
        });
        break;
      }
      case 'plane': {
        // Folded paper airplane with trailing flight dashes
        const pts = [
          { x: sx - r * 0.9, y: sy + r * 0.1 },
          { x: sx + r * 0.95, y: sy - r * 0.35 },
          { x: sx - r * 0.45, y: sy + r * 0.65 },
        ];
        sketchPoly(ctx, pts, true, d.seed, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.25, sy + r * 0.28, sx + r * 0.95, sy - r * 0.35, d.seed + 5, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 1.65, sy + r * 0.42, sx - r * 1.15, sy + r * 0.22, d.seed + 9, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 2.25, sy + r * 0.58, sx - r * 1.85, sy + r * 0.48, d.seed + 12, boilFrame, strokeOpts);
        break;
      }
      case 'mountains': {
        // Layered sketchy mountain peaks & small sun
        sketchPoly(
          ctx,
          [
            { x: sx - r * 1.25, y: sy + r * 0.65 },
            { x: sx - r * 0.35, y: sy - r * 0.7 },
            { x: sx + r * 0.45, y: sy + r * 0.65 },
          ],
          false,
          d.seed,
          boilFrame,
          strokeOpts
        );
        sketchPoly(
          ctx,
          [
            { x: sx + r * 0.05, y: sy + r * 0.25 },
            { x: sx + r * 0.65, y: sy - r * 0.55 },
            { x: sx + r * 1.3, y: sy + r * 0.65 },
          ],
          false,
          d.seed + 6,
          boilFrame,
          strokeOpts
        );
        sketchCircle(ctx, sx + r * 0.95, sy - r * 0.85, r * 0.24, d.seed + 11, boilFrame, {
          ...strokeOpts,
          segments: 10,
        });
        break;
      }
      case 'flask': {
        // Chemistry Erlenmeyer flask
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
          d.seed,
          boilFrame,
          strokeOpts
        );
        sketchCircle(ctx, sx - r * 0.15, sy + r * 0.25, r * 0.12, d.seed + 5, boilFrame, strokeOpts);
        sketchCircle(ctx, sx + r * 0.18, sy + r * 0.35, r * 0.09, d.seed + 9, boilFrame, strokeOpts);
        break;
      }
      case 'atom': {
        // Science atom orbits
        sketchCircle(ctx, sx, sy, r * 0.16, d.seed, boilFrame, strokeOpts);
        sketchCircle(ctx, sx, sy, r * 0.75, d.seed + 4, boilFrame, { ...strokeOpts, segments: 16 });
        sketchLine(ctx, sx - r * 0.9, sy - r * 0.5, sx + r * 0.9, sy + r * 0.5, d.seed + 8, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.9, sy + r * 0.5, sx + r * 0.9, sy - r * 0.5, d.seed + 12, boilFrame, strokeOpts);
        break;
      }
      case 'scissors': {
        // Craft scissors
        sketchCircle(ctx, sx - r * 0.55, sy - r * 0.35, r * 0.24, d.seed, boilFrame, strokeOpts);
        sketchCircle(ctx, sx - r * 0.55, sy + r * 0.35, r * 0.24, d.seed + 4, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.32, sy - r * 0.22, sx + r * 0.85, sy + r * 0.25, d.seed + 8, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.32, sy + r * 0.22, sx + r * 0.85, sy - r * 0.25, d.seed + 12, boilFrame, strokeOpts);
        break;
      }
      case 'abc': {
        sketchText(ctx, 'A B C', sx, sy, d.seed, boilFrame, {
          color: 'rgba(51, 65, 85, 0.34)',
          fontSize: 18,
          weight: '800',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          wobble: 1.5,
        });
        break;
      }
      case 'quote': {
        sketchText(ctx, '“...”', sx, sy, d.seed, boilFrame, {
          color: 'rgba(51, 65, 85, 0.34)',
          fontSize: 22,
          weight: '800',
          fontFamily: 'Georgia, serif',
          wobble: 1.5,
        });
        break;
      }
      case 'pencil': {
        // Hand-drawn wooden pencil
        sketchPoly(
          ctx,
          [
            { x: sx - r * 0.9, y: sy - r * 0.16 },
            { x: sx + r * 0.55, y: sy - r * 0.16 },
            { x: sx + r * 0.95, y: sy },
            { x: sx + r * 0.55, y: sy + r * 0.16 },
            { x: sx - r * 0.9, y: sy + r * 0.16 },
          ],
          true,
          d.seed,
          boilFrame,
          strokeOpts
        );
        sketchLine(ctx, sx - r * 0.65, sy - r * 0.16, sx - r * 0.65, sy + r * 0.16, d.seed + 6, boilFrame, strokeOpts);
        break;
      }
      case 'book': {
        // Little open book
        sketchPoly(
          ctx,
          [
            { x: sx - r * 0.85, y: sy - r * 0.5 },
            { x: sx, y: sy - r * 0.35 },
            { x: sx + r * 0.85, y: sy - r * 0.5 },
            { x: sx + r * 0.85, y: sy + r * 0.5 },
            { x: sx, y: sy + r * 0.62 },
            { x: sx - r * 0.85, y: sy + r * 0.5 },
          ],
          true,
          d.seed,
          boilFrame,
          strokeOpts
        );
        sketchLine(ctx, sx, sy - r * 0.35, sx, sy + r * 0.62, d.seed + 7, boilFrame, strokeOpts);
        break;
      }
      case 'math_eq': {
        sketchText(ctx, 'x² + y² = r²', sx, sy, d.seed, boilFrame, {
          color: 'rgba(14, 116, 144, 0.36)',
          fontSize: 15,
          weight: '700',
          fontFamily: '"Segoe UI", system-ui, sans-serif',
          wobble: 1.4,
        });
        break;
      }
      case 'protractor': {
        sketchArc(ctx, sx, sy + r * 0.35, r * 0.85, Math.PI, 0, d.seed, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.85, sy + r * 0.35, sx + r * 0.85, sy + r * 0.35, d.seed + 5, boilFrame, strokeOpts);
        sketchLine(ctx, sx, sy + r * 0.35, sx, sy - r * 0.5, d.seed + 9, boilFrame, strokeOpts);
        break;
      }
      case 'cube': {
        const s = r * 0.48;
        sketchPoly(
          ctx,
          [
            { x: sx - s, y: sy - s * 0.5 },
            { x: sx + s * 0.4, y: sy - s * 0.5 },
            { x: sx + s * 0.4, y: sy + s * 0.9 },
            { x: sx - s, y: sy + s * 0.9 },
          ],
          true,
          d.seed,
          boilFrame,
          strokeOpts
        );
        sketchPoly(
          ctx,
          [
            { x: sx - s, y: sy - s * 0.5 },
            { x: sx - s * 0.3, y: sy - s },
            { x: sx + s, y: sy - s },
            { x: sx + s * 0.4, y: sy - s * 0.5 },
          ],
          false,
          d.seed + 6,
          boilFrame,
          strokeOpts
        );
        sketchLine(ctx, sx + s, sy - s, sx + s, sy + s * 0.4, d.seed + 11, boilFrame, strokeOpts);
        sketchLine(ctx, sx + s * 0.4, sy + s * 0.9, sx + s, sy + s * 0.4, d.seed + 14, boilFrame, strokeOpts);
        break;
      }
      case 'dna': {
        const p1 = [];
        const p2 = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const x = sx - r * 0.9 + t * r * 1.8;
          const wave = Math.sin(t * Math.PI * 2.5) * r * 0.32;
          p1.push({ x, y: sy + wave });
          p2.push({ x, y: sy - wave });
          if (i % 2 === 1) {
            sketchLine(ctx, x, sy + wave, x, sy - wave, d.seed + i * 3, boilFrame, strokeOpts);
          }
        }
        sketchPoly(ctx, p1, false, d.seed + 40, boilFrame, strokeOpts);
        sketchPoly(ctx, p2, false, d.seed + 60, boilFrame, strokeOpts);
        break;
      }
      case 'leaf': {
        sketchArc(ctx, sx, sy + r * 0.45, r * 0.75, -Math.PI * 0.85, -Math.PI * 0.15, d.seed, boilFrame, strokeOpts);
        sketchArc(ctx, sx, sy - r * 0.45, r * 0.75, Math.PI * 0.15, Math.PI * 0.85, d.seed + 5, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.85, sy, sx + r * 0.75, sy, d.seed + 9, boilFrame, strokeOpts);
        break;
      }
      case 'magnet': {
        sketchArc(ctx, sx, sy - r * 0.15, r * 0.5, Math.PI, 0, d.seed, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.5, sy - r * 0.15, sx - r * 0.5, sy + r * 0.55, d.seed + 4, boilFrame, strokeOpts);
        sketchLine(ctx, sx + r * 0.5, sy - r * 0.15, sx + r * 0.5, sy + r * 0.55, d.seed + 8, boilFrame, strokeOpts);
        sketchLine(ctx, sx - r * 0.5, sy + r * 0.3, sx - r * 0.25, sy + r * 0.3, d.seed + 12, boilFrame, strokeOpts);
        sketchLine(ctx, sx + r * 0.25, sy + r * 0.3, sx + r * 0.5, sy + r * 0.3, d.seed + 15, boilFrame, strokeOpts);
        break;
      }
      case 'hammer': {
        sketchLine(ctx, sx - r * 0.65, sy + r * 0.7, sx + r * 0.25, sy - r * 0.2, d.seed, boilFrame, {
          ...strokeOpts,
          lineWidth: 2.6,
        });
        sketchPoly(
          ctx,
          [
            { x: sx - r * 0.1, y: sy - r * 0.55 },
            { x: sx + r * 0.65, y: sy + r * 0.2 },
            { x: sx + r * 0.42, y: sy + r * 0.42 },
            { x: sx - r * 0.32, y: sy - r * 0.32 },
          ],
          true,
          d.seed + 6,
          boilFrame,
          strokeOpts
        );
        break;
      }
      case 'brush': {
        sketchLine(ctx, sx - r * 0.75, sy + r * 0.65, sx + r * 0.35, sy - r * 0.35, d.seed, boilFrame, strokeOpts);
        sketchPoly(
          ctx,
          [
            { x: sx + r * 0.35, y: sy - r * 0.35 },
            { x: sx + r * 0.8, y: sy - r * 0.55 },
            { x: sx + r * 0.65, y: sy - r * 0.1 },
          ],
          true,
          d.seed + 5,
          boilFrame,
          strokeOpts
        );
        break;
      }
      case 'saw': {
        sketchLine(ctx, sx - r * 0.85, sy - r * 0.25, sx + r * 0.75, sy - r * 0.25, d.seed, boilFrame, strokeOpts);
        const teeth = [];
        for (let i = 0; i <= 6; i++) {
          teeth.push({ x: sx - r * 0.75 + (i / 6) * r * 1.45, y: sy + (i % 2 === 0 ? 0.05 : 0.28) * r });
        }
        sketchPoly(ctx, teeth, false, d.seed + 6, boilFrame, strokeOpts);
        break;
      }
    }
  }

  _drawSign(ctx, sign, toSX, toSY, boilFrame) {
    const sx = toSX(sign.x);
    const sy = toSY(sign.y);
    const tilt = sign.tilt || 0;

    sketchText(ctx, sign.text, sx, sy, sign.seed, boilFrame, {
      color: 'rgba(24, 34, 48, 0.86)',
      fontSize: 19,
      weight: '700',
      tilt,
      underline: true,
      wobble: 1.0,
    });

    if (sign.subtext) {
      sketchText(ctx, sign.subtext, sx, sy + 21, sign.seed + 7.3, boilFrame, {
        color: 'rgba(51, 65, 85, 0.72)',
        fontSize: 12,
        weight: '600',
        tilt,
        wobble: 0.8,
      });
    }

    if (sign.arrowTo) {
      const tx = toSX(sign.arrowTo.x);
      const ty = toSY(sign.arrowTo.y);
      const startY = sign.subtext ? sy + 31 : sy + 16;
      sketchArrow(ctx, sx, startY, tx, ty, sign.seed + 19.7, boilFrame, {
        color: 'rgba(30, 41, 59, 0.75)',
        lineWidth: 2.0,
        headSize: 10,
        curve: sign.curve || 0,
        wobble: 1.4,
      });
    }
  }

  _drawPlatformLabel(ctx, p, sx, sy, ph, boilFrame) {
    const cfg = typeof p.label === 'string' ? { text: p.label } : p.label;
    if (!cfg || !cfg.text) return;

    const lx = sx + (cfg.offsetX || 0) * PPU;
    const ly = sy - ph / 2 - 22 + (cfg.offsetY || 0) * PPU;

    sketchText(ctx, cfg.text, lx, ly, p.seed + 301, boilFrame, {
      color: 'rgba(24, 34, 48, 0.84)',
      fontSize: 15,
      weight: '700',
      tilt: -(p.tilt || 0) * 0.5,
      underline: true,
    });

    if (cfg.arrow !== false) {
      sketchArrow(ctx, lx, ly + 11, sx, sy - ph / 2 - 4, p.seed + 317, boilFrame, {
        color: 'rgba(51, 65, 85, 0.68)',
        lineWidth: 1.6,
        headSize: 7,
        wobble: 1.0,
      });
    }
  }

  _drawMovingPlatformTrack(ctx, p, toSX, toSY, boilFrame) {
    const isX = p.move.axis === 'x';
    const x1 = toSX(isX ? p.baseX - p.move.range : p.baseX);
    const y1 = toSY(isX ? p.baseY : p.baseY - p.move.range);
    const x2 = toSX(isX ? p.baseX + p.move.range : p.baseX);
    const y2 = toSY(isX ? p.baseY : p.baseY + p.move.range);

    const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
    const dashCount = Math.max(4, Math.floor(dist / 22));
    for (let i = 0; i < dashCount; i++) {
      const t0 = i / dashCount;
      const t1 = (i + 0.55) / dashCount;
      sketchLine(
        ctx,
        x1 + (x2 - x1) * t0,
        y1 + (y2 - y1) * t0,
        x1 + (x2 - x1) * t1,
        y1 + (y2 - y1) * t1,
        p.seed + 50 + i * 3.7,
        boilFrame,
        { color: 'rgba(71, 85, 105, 0.34)', lineWidth: 1.6, wobble: 0.9, overshoot: 1, passes: 1 }
      );
    }

    sketchCircle(ctx, x1, y1, 3.5, p.seed + 81, boilFrame, {
      segments: 8,
      color: 'rgba(71, 85, 105, 0.45)',
      lineWidth: 1.5,
      passes: 1,
    });
    sketchCircle(ctx, x2, y2, 3.5, p.seed + 89, boilFrame, {
      segments: 8,
      color: 'rgba(71, 85, 105, 0.45)',
      lineWidth: 1.5,
      passes: 1,
    });
  }

  _drawMovingPlatformEffects(ctx, p, pw, ph, time, boilFrame) {
    // Crisp top-edge chalk highlight
    sketchLine(ctx, -pw / 2 + 6, -ph / 2 + 4, pw / 2 - 6, -ph / 2 + 4, p.seed + 101, boilFrame, {
      color: 'rgba(255, 255, 255, 0.65)',
      lineWidth: 1.8,
      wobble: 0.7,
      overshoot: 1,
      passes: 1,
    });

    // Trailing motion lines opposite current velocity
    const isX = p.move.axis === 'x';
    const vel = Math.cos(time * p.move.speed) * p.move.speed;
    const dir = vel >= 0 ? 1 : -1;
    const strength = Math.min(1, Math.abs(vel) / Math.max(0.5, p.move.speed));
    const len = 10 + strength * 14;

    for (let i = -1; i <= 1; i++) {
      if (isX) {
        const edgeX = -dir * (pw / 2 + 6);
        const yOff = i * (ph * 0.28);
        sketchLine(
          ctx,
          edgeX,
          yOff,
          edgeX - dir * len,
          yOff,
          p.seed + 120 + i * 5.3,
          boilFrame,
          { color: 'rgba(37, 99, 235, 0.48)', lineWidth: 1.7, wobble: 1.0, overshoot: 1, passes: 1 }
        );
      } else {
        // +Y in world is -Y in screen space
        const screenDir = -dir;
        const edgeY = -screenDir * (ph / 2 + 6);
        const xOff = i * (pw * 0.28);
        sketchLine(
          ctx,
          xOff,
          edgeY,
          xOff,
          edgeY - screenDir * len,
          p.seed + 120 + i * 5.3,
          boilFrame,
          { color: 'rgba(37, 99, 235, 0.48)', lineWidth: 1.7, wobble: 1.0, overshoot: 1, passes: 1 }
        );
      }
    }
  }

  _drawCheckpoint(ctx, cp, toSX, toSY, time, boilFrame) {
    const sx = toSX(cp.x);
    const sy = toSY(cp.y);

    // Pole, finial pinhead & base pin mark
    sketchLine(ctx, sx, sy + 28, sx, sy - 36, cp.seed, boilFrame, { lineWidth: 2.6 });
    sketchCircle(ctx, sx, sy - 39, 3.8, cp.seed + 2, boilFrame, {
      segments: 10,
      color: cp.activated ? '#0284c7' : INK,
      lineWidth: 2.0,
    });
    sketchLine(ctx, sx - 7, sy + 28, sx + 7, sy + 28, cp.seed + 3, boilFrame, {
      lineWidth: 1.8,
      overshoot: 1.5,
      passes: 1,
    });

    // Flag body
    sketchRect(ctx, sx + 17, sy - 24, 34, 20, cp.seed + 5, boilFrame, {
      fill: cp.activated ? '#38bdf8' : '#cbd5e1',
      shadow: true,
      lineWidth: 2,
    });

    // Crisp inner highlight along top of flag
    sketchLine(ctx, sx + 4, sy - 30, sx + 30, sy - 30, cp.seed + 11, boilFrame, {
      color: cp.activated ? 'rgba(255, 255, 255, 0.78)' : 'rgba(255, 255, 255, 0.5)',
      lineWidth: 1.7,
      wobble: 0.7,
      overshoot: 1,
      passes: 1,
    });

    if (cp.activated) {
      // Fluttering motion lines off right edge of flag
      const wave = Math.sin(time * 5 + cp.x) * 2.5;
      sketchLine(ctx, sx + 38, sy - 29 + wave * 0.4, sx + 49, sy - 31 - wave * 0.4, cp.seed + 17, boilFrame, {
        color: 'rgba(14, 165, 233, 0.7)',
        lineWidth: 1.8,
        passes: 1,
      });
      sketchLine(ctx, sx + 38, sy - 19 - wave * 0.4, sx + 47, sy - 18 + wave * 0.4, cp.seed + 21, boilFrame, {
        color: 'rgba(14, 165, 233, 0.7)',
        lineWidth: 1.8,
        passes: 1,
      });

      // Radiating celebration ticks around finial
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI * 0.85 + (i / 3) * Math.PI * 0.7;
        sketchLine(
          ctx,
          sx + Math.cos(a) * 9,
          sy - 39 + Math.sin(a) * 9,
          sx + Math.cos(a) * 16,
          sy - 39 + Math.sin(a) * 16,
          cp.seed + 30 + i * 4.1,
          boilFrame,
          { color: 'rgba(14, 165, 233, 0.78)', lineWidth: 1.7, wobble: 0.9, overshoot: 1, passes: 1 }
        );
      }
    }
  }
}
