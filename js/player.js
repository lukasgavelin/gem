import { sound } from './audio.js';
import { PPU } from './book.js';
import { BOIL_FPS, INK, hash2, sketchLine, sketchPoly } from './sketch2d.js';

export class PaperclipPlayer {
  constructor() {
    this.particles = [];
    this.speedLines = [];

    // Collision half-extents in world units
    this.halfW = 0.28;
    this.halfH = 0.48;

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;

    this.onGround = false;
    this.groundPlatform = null;
    this.wallDir = 0;
    this.lastWallDir = 0;
    this.wallCoyoteTimer = 0;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    this.canDash = true;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirX = 1;
    this.dashDirY = 0;

    this.scaleX = 1;
    this.scaleY = 1;
    this.spinAngle = 0;
    this.blinkTimer = 2.5;
    this.speedLineTimer = 0;
    this.isWallSliding = false;
    this.wallSlideTimer = 0;

    this.dead = false;
    this.respawnTimer = 0;
    this.spawnPos = { x: 0, y: 0 };
  }

  spawn(pos) {
    this.spawnPos = { ...pos };
    this.x = pos.x;
    this.y = pos.y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.groundPlatform = null;
    this.wallDir = 0;
    this.lastWallDir = 0;
    this.wallCoyoteTimer = 0;
    this.canDash = true;
    this.dashTimer = 0;
    this.dead = false;
    this.spinAngle = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.speedLines = [];
    this.speedLineTimer = 0;
    this.isWallSliding = false;
    this.wallSlideTimer = 0;
  }

  _spawnParticles(x, y, count, color = '#67e8f9', speed = 4.5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.8) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd + 1.5,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 14,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.55,
        color,
        size: 5 + Math.random() * 4,
      });
    }
  }

  _spawnWallSparks(x, y, wallDir) {
    const colors = ['#fbbf24', '#fde68a', '#cbd5e1'];
    for (let i = 0; i < 2; i++) {
      const vx = -wallDir * (1.8 + Math.random() * 2.8);
      const vy = 1.0 + Math.random() * 2.8;
      this.particles.push({
        x,
        y: y + (Math.random() - 0.5) * 0.4,
        vx,
        vy,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 18,
        life: 0.18 + Math.random() * 0.14,
        maxLife: 0.32,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 2.5,
      });
    }
  }

  _spawnSpeedLines(isDashing, speed) {
    if (speed < 0.1) return;
    const ux = this.vx / speed;
    const uy = this.vy / speed;
    const px = -uy;
    const py = ux;
    const count = isDashing ? 2 : 1;

    for (let i = 0; i < count; i++) {
      const side = (Math.random() - 0.5) * 0.72;
      const back = 0.25 + Math.random() * 0.25;
      const len = isDashing ? 0.65 + Math.random() * 0.55 : 0.38 + Math.random() * 0.32;
      const x1 = this.x + px * side - ux * back;
      const y1 = this.y + py * side - uy * back;
      const x2 = x1 - ux * len;
      const y2 = y1 - uy * len;
      const maxLife = isDashing ? 0.18 : 0.13;

      this.speedLines.push({
        x1,
        y1,
        x2,
        y2,
        life: maxLife,
        maxLife,
        seed: Math.random() * 1000,
        color: isDashing ? '#2563eb' : INK,
        width: isDashing ? 2.4 : 1.7,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotSpeed * dt;
    }

    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const sl = this.speedLines[i];
      sl.life -= dt;
      if (sl.life <= 0) {
        this.speedLines.splice(i, 1);
      }
    }
  }

  update(dt, input, world) {
    this.updateParticles(dt);

    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.spawn(this.spawnPos);
      }
      return { reachedGoal: false, starsCollectedNow: 0, died: false };
    }

    const moveSpeed = 8.4;
    const groundAccel = 65;
    const airAccel = 44;
    const gravity = -34;
    const maxFall = -20;
    const wallSlideSpeed = -4.2;
    const jumpVel = 13.8;

    const dirX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dirX !== 0) this.facing = dirX;

    if (this.onGround) {
      this.coyoteTimer = 0.11;
      this.canDash = true;
      this.wallCoyoteTimer = 0;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      if (this.wallDir !== 0) {
        this.lastWallDir = this.wallDir;
        this.wallCoyoteTimer = 0.1;
      } else {
        this.wallCoyoteTimer = Math.max(0, this.wallCoyoteTimer - dt);
      }
    }

    if (input.jumpPressed) {
      this.jumpBufferTimer = 0.12;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);

    // Spring-dash
    if (input.dashPressed && this.canDash && this.dashCooldown <= 0) {
      this.canDash = false;
      this.dashTimer = 0.15;
      this.dashCooldown = 0.24;

      const aimX = dirX !== 0 ? dirX : this.facing;
      const aimY = input.up ? 0.62 : 0.22;
      const len = Math.hypot(aimX, aimY);
      this.dashDirX = aimX / len;
      this.dashDirY = aimY / len;

      this.vx = this.dashDirX * 17.5;
      this.vy = this.dashDirY * 15.5;
      this.spinAngle = Math.PI * 2 * -this.facing;
      this.scaleX = 1.35;
      this.scaleY = 0.72;
      sound.playDash();
      this._spawnParticles(this.x, this.y, 10, '#67e8f9', 5.5);
    }

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vy += gravity * 0.25 * dt;
    } else {
      const targetVx = dirX * moveSpeed;
      const isSlippery = this.onGround && this.groundPlatform && this.groundPlatform.slippery;
      const accel = this.onGround ? (isSlippery ? 13 : groundAccel) : airAccel;
      if (this.vx < targetVx) {
        this.vx = Math.min(targetVx, this.vx + accel * dt);
      } else if (this.vx > targetVx) {
        this.vx = Math.max(targetVx, this.vx - accel * dt);
      }

      this.vy += gravity * dt;
      this.isWallSliding = false;
      if (!this.onGround && this.wallDir !== 0 && this.vy < wallSlideSpeed && dirX === this.wallDir) {
        this.vy = wallSlideSpeed;
        this.canDash = true;
        this.isWallSliding = true;
      }
      if (this.vy < maxFall) this.vy = maxFall;
    }

    if (this.isWallSliding) {
      this.wallSlideTimer -= dt;
      if (this.wallSlideTimer <= 0) {
        this.wallSlideTimer = 0.085;
        this._spawnWallSparks(this.x + this.wallDir * this.halfW, this.y - 0.1, this.wallDir);
        sound.playWallScratch();
      }
    } else {
      this.wallSlideTimer = 0;
    }

    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        this.vy = jumpVel;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.scaleX = 0.74;
        this.scaleY = 1.35;
        sound.playJump();
        this._spawnParticles(this.x, this.y - this.halfH, 6, '#cbd5e1', 3.2);
      } else if (this.wallDir !== 0 || this.wallCoyoteTimer > 0) {
        const wDir = this.wallDir !== 0 ? this.wallDir : this.lastWallDir;
        this.vx = -wDir * 10.5;
        this.vy = jumpVel * 0.96;
        this.facing = -wDir;
        this.wallDir = 0;
        this.wallCoyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.scaleX = 0.75;
        this.scaleY = 1.32;
        sound.playJump();
        this._spawnParticles(this.x, this.y, 7, '#cbd5e1', 3.8);
      }
    }

    if (!input.jumpHeld && this.vy > 5.5 && this.dashTimer <= 0) {
      this.vy *= Math.pow(0.45, dt * 12);
    }

    // Carry player with moving platform before physics step
    if (this.onGround && this.groundPlatform) {
      this.x += this.groundPlatform.x - this.groundPlatform.prevX;
      this.y += this.groundPlatform.y - this.groundPlatform.prevY;
    }

    const prevX = this.x;
    const prevY = this.y;

    // Move & Collide X
    this.x += this.vx * dt;
    this.wallDir = 0;

    if (this.x - this.halfW < -2) {
      this.x = -2 + this.halfW;
      this.vx = 0;
    } else if (this.x + this.halfW > 410) {
      this.x = 410 - this.halfW;
      this.vx = 0;
    }

    for (const p of world.platforms) {
      if (p.crumbleState === 'fallen') continue;
      if (this._overlaps(this.x, this.y, this.halfW, this.halfH, p.x, p.y, p.w / 2, p.h / 2)) {
        const cameFromLeft = prevX + this.halfW <= p.x - p.w / 2 + 0.08;
        const cameFromRight = prevX - this.halfW >= p.x + p.w / 2 - 0.08;
        const overlapY = this.halfH + p.h / 2 - Math.abs(prevY - p.y);

        // Only resolve horizontally if we actually approached from the side (never snap when landing on top!)
        if (overlapY > 0.05 && (cameFromLeft || cameFromRight)) {
          if (cameFromLeft && this.vx > 0) {
            this.x = p.x - p.w / 2 - this.halfW;
            this.vx = 0;
            if (overlapY >= 0.2) this.wallDir = 1;
          } else if (cameFromRight && this.vx < 0) {
            this.x = p.x + p.w / 2 + this.halfW;
            this.vx = 0;
            if (overlapY >= 0.2) this.wallDir = -1;
          }
        }
      }
    }

    // Move & Collide Y
    const wasOnGround = this.onGround;
    this.y += this.vy * dt;
    this.onGround = false;
    this.groundPlatform = null;

    for (const p of world.platforms) {
      if (p.crumbleState === 'fallen') continue;
      if (this._overlaps(this.x, this.y, this.halfW, this.halfH, p.x, p.y, p.w / 2, p.h / 2)) {
        if (this.vy <= 0) {
          this.y = p.y + p.h / 2 + this.halfH;
          if (p.bounce > 0) {
            this.vy = p.bounce;
            this.canDash = true;
            this.onGround = false;
            p.bounceAnim = 1.0;
            this.scaleX = 0.68;
            this.scaleY = 1.45;
            sound.playBounce();
            this._spawnParticles(this.x, this.y - this.halfH, 10, '#93c5fd', 5.0);
          } else {
            if (!wasOnGround && this.vy < -4) {
              this.scaleX = 1.3;
              this.scaleY = 0.72;
              sound.playLand();
              this._spawnParticles(this.x, this.y - this.halfH, 4, '#cbd5e1', 2.4);
            }
            this.vy = 0;
            this.onGround = true;
            this.groundPlatform = p;
            if (p.crumble && p.crumbleState === 'solid') {
              p.crumbleState = 'shaking';
              p.crumbleTimer = 0.55;
            }
          }
        } else if (prevY + this.halfH <= p.y - p.h / 2 + 0.14) {
          this.y = p.y - p.h / 2 - this.halfH;
          this.vy = 0;
        }
      }
    }

    for (const h of world.hazards) {
      if (this._overlaps(this.x, this.y, this.halfW * 0.85, this.halfH * 0.85, h.x, h.y, h.w / 2, h.h / 2)) {
        this._die();
        return { reachedGoal: false, starsCollectedNow: 0, died: true };
      }
    }

    if (this.y < -7.2) {
      this._die();
      return { reachedGoal: false, starsCollectedNow: 0, died: true };
    }

    let starsCollectedNow = 0;
    for (const s of world.stars) {
      if (!s.collected && Math.hypot(this.x - s.x, this.y - s.y) < 0.78) {
        s.collected = true;
        starsCollectedNow++;
        sound.playStar();
        this._spawnParticles(s.x, s.y, 12, '#67e8f9', 5.2);
      }
    }

    for (const cp of world.checkpoints) {
      if (!cp.activated && Math.hypot(this.x - cp.x, this.y - cp.y) < 1.5) {
        cp.activated = true;
        this.spawnPos = { x: cp.x, y: cp.y + 0.4 };
        sound.playCheckpoint();
        this._spawnParticles(cp.x, cp.y + 0.4, 10, '#38bdf8', 4.5);
      }
    }

    const speed = Math.hypot(this.vx, this.vy);
    const isDashing = this.dashTimer > 0;
    if (isDashing || speed > 9.2) {
      this.speedLineTimer -= dt;
      if (this.speedLineTimer <= 0) {
        this.speedLineTimer = isDashing ? 0.022 : 0.048;
        this._spawnSpeedLines(isDashing, speed);
      }
    } else {
      this.speedLineTimer = 0;
    }

    const reachedGoal =
      world.goal && Math.hypot(this.x - world.goal.x, this.y - world.goal.y) < world.goal.radius;

    this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 14);
    this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 14);
    this.spinAngle += (0 - this.spinAngle) * Math.min(1, dt * 10);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.2 + Math.random() * 2.5;
    }

    return { reachedGoal, starsCollectedNow, died: false };
  }

  _die() {
    this.dead = true;
    this.respawnTimer = 0.45;
    sound.playHazard();
    this._spawnParticles(this.x, this.y, 14, '#182230', 6.0);
  }

  _overlaps(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
  }

  draw(ctx, camX, camY, viewW, viewH, time) {
    const toSX = (wx) => viewW / 2 + (wx - camX) * PPU;
    const toSY = (wy) => viewH / 2 - (wy - camY) * PPU;
    const boilFrame = Math.floor(time * BOIL_FPS) % 3;

    // 1. Draw boiling speed/motion lines trailing behind the paperclip
    for (const sl of this.speedLines) {
      const alpha = Math.max(0, sl.life / sl.maxLife) * 0.85;
      sketchLine(
        ctx,
        toSX(sl.x1),
        toSY(sl.y1),
        toSX(sl.x2),
        toSY(sl.y2),
        sl.seed,
        boilFrame,
        {
          color: sl.color,
          lineWidth: sl.width,
          wobble: 1.6,
          overshoot: 2.0,
          passes: 1,
          alpha,
        }
      );
    }

    // 2. Draw sketchy 2D particles
    for (const p of this.particles) {
      const sx = toSX(p.x);
      const sy = toSY(p.y);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      const s = p.size * (0.4 + 0.6 * alpha);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    if (this.dead) return;

    // 2. Draw 2D Boiling-Line Paperclip Character
    const sx = toSX(this.x);
    const sy = toSY(this.y);

    ctx.save();
    ctx.translate(sx, sy);
    const lean = this.vx * 0.025;
    ctx.rotate(lean - this.spinAngle);
    ctx.scale(this.scaleX, this.scaleY);

    // Classic paperclip loop in pixel space (approx 30px wide x 50px tall)
    const rawPts = [
      { x: -4, y: 8 },
      { x: -4, y: -15 },
      { x: 0, y: -21 },
      { x: 5, y: -21 },
      { x: 9, y: -15 },
      { x: 9, y: 18 },
      { x: 4, y: 24 },
      { x: -5, y: 24 },
      { x: -10, y: 18 },
      { x: -10, y: -17 },
      { x: -5, y: -25 },
      { x: 6, y: -25 },
      { x: 12, y: -17 },
      { x: 12, y: 9 },
    ];

    // Subtle paper drop shadow behind the paperclip
    ctx.save();
    ctx.translate(4, 5);
    ctx.strokeStyle = 'rgba(24, 34, 48, 0.16)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    rawPts.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
    ctx.restore();

    // Boiling wire color (bright cobalt when dash is ready, cool slate when spent)
    const wireColor = this.canDash ? '#2563eb' : '#64748b';

    // Outer dark graphite sketch stroke + inner cobalt wire stroke (both boiling!)
    sketchPoly(ctx, rawPts, false, 777, boilFrame, {
      color: INK,
      lineWidth: 4.8,
      wobble: 1.5,
      overshoot: 1.2,
      passes: 1,
      alpha: 0.95,
    });
    sketchPoly(ctx, rawPts, false, 779, boilFrame, {
      color: wireColor,
      lineWidth: 2.5,
      wobble: 1.3,
      overshoot: 0.8,
      passes: 2,
      alpha: 0.95,
    });

    // Expressive boiling ink-dot eyes
    const blinking = this.blinkTimer < 0.1;
    const eyeShift = this.facing * 2.5;
    const eyeY = -8;
    const eyeH = blinking ? 1.0 : 3.2;

    const drawEye = (ex, seed) => {
      const jx = hash2(seed, boilFrame) * 0.9;
      const jy = hash2(seed + 4, boilFrame) * 0.9;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(ex + eyeShift + jx, eyeY + jy, 2.7, eyeH, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawEye(-3.5, 810);
    drawEye(4.5, 820);

    ctx.restore();
  }
}
