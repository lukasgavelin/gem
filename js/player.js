import * as THREE from 'three';
import { sound } from './audio.js';
import { BOIL_FPS } from './sketch2d.js';
import { getPlayer2DTexture } from './textures3d.js';

export class PaperclipPlayer {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.speedLines = [];
    this.particlePool = [];
    this.speedLinePool = [];

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

    this._initMesh();
  }

  _initMesh() {
    this.group = new THREE.Group();

    // Classic paperclip loop in 3D world units (~0.56 wide x 0.96 tall)
    const pts = [
      [-0.08, -0.15, 0.02],
      [-0.08, 0.28, 0.02],
      [0.0, 0.39, 0.015],
      [0.09, 0.39, 0.01],
      [0.17, 0.28, 0.005],
      [0.17, -0.34, 0.0],
      [0.08, -0.45, -0.005],
      [-0.09, -0.45, -0.01],
      [-0.19, -0.34, -0.015],
      [-0.19, 0.32, -0.02],
      [-0.09, 0.46, -0.02],
      [0.11, 0.46, -0.015],
      [0.22, 0.32, -0.01],
      [0.22, -0.17, 0.0],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
    const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.042, 10, false);
    this.wireMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.28,
      metalness: 0.65,
    });
    this.wireMesh = new THREE.Mesh(tubeGeo, this.wireMat);
    this.wireMesh.castShadow = true;
    this.group.add(this.wireMesh);

    // Expressive 3D ink-dot eyes
    const eyeGeo = new THREE.SphereGeometry(0.052, 10, 10);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x182230, roughness: 0.4 });
    this.leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    this.leftEye.position.set(-0.07, 0.15, 0.07);
    this.rightEye.position.set(0.08, 0.15, 0.07);
    this.group.add(this.leftEye, this.rightEye);

    // 2D boiling-line paperclip sprite for low dimensionMix
    this.sprite2DMat = new THREE.MeshBasicMaterial({
      map: getPlayer2DTexture(true, 0),
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.sprite2D = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.15), this.sprite2DMat);
    this.sprite2D.position.z = 0.03;
    this.sprite2D.visible = false;
    this.group.add(this.sprite2D);

    this.scene.add(this.group);

    // Translucent ghost mesh for best-run replay
    this.ghostGroup = new THREE.Group();
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      wireframe: false,
    });
    const ghostWire = new THREE.Mesh(tubeGeo, ghostMat);
    this.ghostGroup.add(ghostWire);
    this.ghostGroup.visible = false;
    this.scene.add(this.ghostGroup);

    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);
    this.particleGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    this.lineGeo = new THREE.BoxGeometry(1, 0.035, 0.035);
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
    while (this.speedLines.length > 0) {
      const sl = this.speedLines.pop();
      sl.mesh.visible = false;
      this.speedLinePool.push({ mesh: sl.mesh, mat: sl.mat });
    }
    this.speedLineTimer = 0;
    this.isWallSliding = false;
    this.wallSlideTimer = 0;
  }

  _acquireParticle(color, roughness = 0.6) {
    if (this.particlePool.length > 0) {
      const item = this.particlePool.pop();
      item.mat.color.set(color);
      item.mat.roughness = roughness;
      item.mat.opacity = 1;
      item.mesh.visible = true;
      return item;
    }
    const mat = new THREE.MeshStandardMaterial({ color, roughness, transparent: true });
    const mesh = new THREE.Mesh(this.particleGeo, mat);
    this.fxGroup.add(mesh);
    return { mesh, mat };
  }

  _acquireSpeedLine(isDashing) {
    const hex = isDashing ? 0x2563eb : 0x182230;
    if (this.speedLinePool.length > 0) {
      const item = this.speedLinePool.pop();
      item.mat.color.setHex(hex);
      item.mat.opacity = 0.85;
      item.mesh.visible = true;
      return item;
    }
    const mat = new THREE.MeshBasicMaterial({
      color: hex,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(this.lineGeo, mat);
    this.fxGroup.add(mesh);
    return { mesh, mat };
  }

  _spawnParticles(x, y, count, color = '#67e8f9', speed = 4.5) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.8) * speed;
      const { mesh, mat } = this._acquireParticle(color, 0.6);
      mesh.position.set(x, y, (Math.random() - 0.5) * 0.3);
      mesh.castShadow = true;
      mesh.scale.setScalar(1);

      this.particles.push({
        x,
        y,
        z: mesh.position.z,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd + 1.5,
        vz: (Math.random() - 0.5) * 2.2,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 14,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.55,
        baseScale: 1,
        mesh,
        mat,
      });
    }
  }

  _spawnWallSparks(x, y, wallDir) {
    const colors = ['#fbbf24', '#fde68a', '#cbd5e1'];
    for (let i = 0; i < 2; i++) {
      const vx = -wallDir * (1.8 + Math.random() * 2.8);
      const vy = 1.0 + Math.random() * 2.8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const { mesh, mat } = this._acquireParticle(color, 0.5);
      mesh.position.set(x, y + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.2);
      mesh.castShadow = false;
      mesh.scale.setScalar(0.65);

      this.particles.push({
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        vx,
        vy,
        vz: (Math.random() - 0.5) * 1.5,
        rot: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 18,
        life: 0.18 + Math.random() * 0.14,
        maxLife: 0.32,
        baseScale: 0.65,
        mesh,
        mat,
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
      const maxLife = isDashing ? 0.18 : 0.13;

      const { mesh, mat } = this._acquireSpeedLine(isDashing);
      mesh.position.set(x1 - (ux * len) / 2, y1 - (uy * len) / 2, (Math.random() - 0.5) * 0.25);
      mesh.scale.set(len, 1, 1);
      mesh.rotation.z = Math.atan2(uy, ux);

      this.speedLines.push({
        life: maxLife,
        maxLife,
        mesh,
        mat,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.particlePool.push({ mesh: p.mesh, mat: p.mat });
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rot += p.rotSpeed * dt;
      const alpha = Math.max(0, p.life / p.maxLife);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.set(p.rot, p.rot * 0.7, p.rot);
      p.mesh.scale.setScalar((p.baseScale || 1) * (0.4 + 0.6 * alpha));
      p.mat.opacity = alpha;
    }

    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const sl = this.speedLines[i];
      sl.life -= dt;
      if (sl.life <= 0) {
        sl.mesh.visible = false;
        this.speedLinePool.push({ mesh: sl.mesh, mat: sl.mat });
        this.speedLines.splice(i, 1);
      } else {
        sl.mat.opacity = Math.max(0, sl.life / sl.maxLife) * 0.85;
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
      return {
        reachedGoal: false,
        starsCollectedNow: 0,
        died: false,
        bounced: false,
        dashed: false,
        checkpointActivated: false,
        crumbleTriggered: false,
      };
    }

    let bounced = false;
    let dashed = false;
    let checkpointActivated = false;
    let crumbleTriggered = false;

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
      dashed = true;
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

    // Magnetic field assist & dash recharge (Kapitel 3)
    if (world.magnets) {
      for (const m of world.magnets) {
        if (Math.hypot(this.x - m.x, this.y - m.y) < m.radius) {
          if (!this.onGround && this.dashTimer <= 0) {
            const dx = m.x - this.x;
            const dy = m.y - 0.4 - this.y;
            this.vx += dx * 4.5 * dt;
            this.vy = Math.min(11, this.vy + (22 + Math.max(0, dy * 6)) * dt);
          }
          if (!this.canDash) {
            this.canDash = true;
            sound.playMagnet();
            this._spawnParticles(this.x, this.y, 6, '#38bdf8', 3.5);
          }
        }
      }
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

    const maxWorldX = world.maxX || 1212;
    if (this.x - this.halfW < -2) {
      this.x = -2 + this.halfW;
      this.vx = 0;
    } else if (this.x + this.halfW > maxWorldX) {
      this.x = maxWorldX - this.halfW;
      this.vx = 0;
    }

    for (const p of world.platforms) {
      if (p.crumbleState === 'fallen') continue;
      if (Math.abs(p.x - this.x) > p.w * 0.5 + 2.5) continue;
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
      if (Math.abs(p.x - this.x) > p.w * 0.5 + 2.5) continue;
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
            bounced = true;
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
              crumbleTriggered = true;
            }
          }
        } else if (prevY + this.halfH <= p.y - p.h / 2 + 0.14) {
          this.y = p.y - p.h / 2 - this.halfH;
          this.vy = 0;
        }
      }
    }

    for (const h of world.hazards) {
      if (Math.abs(h.x - this.x) > h.w * 0.5 + 2.0) continue;
      if (this._overlaps(this.x, this.y, this.halfW * 0.85, this.halfH * 0.85, h.x, h.y, h.w / 2, h.h / 2)) {
        this._die();
        return {
          reachedGoal: false,
          starsCollectedNow: 0,
          died: true,
          bounced,
          dashed,
          checkpointActivated,
          crumbleTriggered,
        };
      }
    }

    if (this.y < -7.2) {
      this._die();
      return {
        reachedGoal: false,
        starsCollectedNow: 0,
        died: true,
        bounced,
        dashed,
        checkpointActivated,
        crumbleTriggered,
      };
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
        checkpointActivated = true;
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

    return {
      reachedGoal,
      starsCollectedNow,
      died: false,
      bounced,
      dashed,
      checkpointActivated,
      crumbleTriggered,
    };
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

  updateGhost(ghostPose, dimensionMix = 1) {
    if (!this.ghostGroup) return;
    if (!ghostPose) {
      this.ghostGroup.visible = false;
      return;
    }
    this.ghostGroup.visible = true;
    this.ghostGroup.position.set(ghostPose.x, ghostPose.y, -0.04);
    this.ghostGroup.rotation.y = (ghostPose.facing || 1) * 0.18 * dimensionMix;
    this.ghostGroup.scale.set(1, 1, 0.15 + 0.85 * dimensionMix);
  }

  syncVisuals(time = 0, dimensionMix = 1) {
    this.group.visible = true;
    if (this.dead) {
      const t = Math.max(0, Math.min(1, 1 - this.respawnTimer / 0.45));
      this.group.position.set(this.x, this.y + Math.sin(t * Math.PI) * 0.65, 0.2);
      this.group.rotation.z += 0.35;
      const s = Math.max(0.01, 1 - t);
      this.group.scale.set(s * (dimensionMix < 0.35 ? this.facing : 1), s, s);
      return;
    }

    this.group.position.set(this.x, this.y, 0.02);
    const lean = -this.vx * 0.025;
    this.group.rotation.z = lean + this.spinAngle;

    const use2D = dimensionMix < 0.35;
    this.sprite2D.visible = use2D;
    this.wireMesh.visible = !use2D;
    this.leftEye.visible = !use2D;
    this.rightEye.visible = !use2D;

    if (use2D) {
      this.group.rotation.y = 0;
      this.group.scale.set(this.scaleX * this.facing, this.scaleY, 1);
      const boilFrame = Math.floor(time * BOIL_FPS) % 3;
      const tex = getPlayer2DTexture(this.canDash, boilFrame);
      if (this.sprite2DMat.map !== tex) {
        this.sprite2DMat.map = tex;
      }
      return;
    }

    this.group.rotation.y = (this.facing * 0.18 + this.spinAngle * 0.4) * dimensionMix;
    this.group.scale.set(this.scaleX, this.scaleY, 0.15 + 0.85 * dimensionMix);

    this.wireMat.color.setHex(this.canDash ? 0x2563eb : 0x64748b);

    const blinking = this.blinkTimer < 0.1;
    const eyeShift = this.facing * 0.045;
    const eyeScaleY = blinking ? 0.25 : 1.15;
    this.leftEye.position.x = -0.07 + eyeShift;
    this.rightEye.position.x = 0.08 + eyeShift;
    this.leftEye.scale.set(1, eyeScaleY, 1);
    this.rightEye.scale.set(1, eyeScaleY, 1);
  }
}
