import * as THREE from 'three';
import { BOIL_FPS, hash2 } from './sketch2d.js';
import {
  createChapterPaperTexture,
  createSignTexture,
  getDoodleTexture,
  getPlatformTexture,
} from './textures3d.js';

export class BookWorld {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.sections = [];
    this.platforms = [];
    this.hazards = [];
    this.stars = [];
    this.checkpoints = [];
    this.goal = null;
    this.motesPoints = null;
    this.moteBaseY = [];
    this.motePhases = [];
  }

  _clearGroup() {
    while (this.group.children.length > 0) {
      const child = this.group.children.pop();
      this.group.remove(child);
    }
  }

  loadWorld(worldData) {
    this._clearGroup();
    this.sections = worldData.sections;

    // 1. Chapter Paper Backdrops (z = -1.9)
    for (const sec of this.sections) {
      const span = sec.endX - sec.startX;
      const geo = new THREE.PlaneGeometry(span, 24);
      const tex = createChapterPaperTexture(sec.theme);
      tex.repeat.set(Math.max(1, span / 18), 1.6);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sec.startX + span / 2, 0, -1.9);
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // 2. Vertical Page-Crease Seams every 24 world units
    const creaseGeo = new THREE.BoxGeometry(0.06, 24, 0.08);
    const creaseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.22,
      roughness: 0.9,
    });
    for (let wx = 24; wx <= 408; wx += 24) {
      const crease = new THREE.Mesh(creaseGeo, creaseMat);
      crease.position.set(wx, 0, -1.86);
      this.group.add(crease);
    }

    // 3. Parallax Background Doodles (z = -1.35)
    this._buildSectionDoodles(this.sections);

    // 4. 3D Papercraft Platforms (z = 0)
    const sideMatMap = {
      eraser: 0x93c5fd,
      springpad: 0x67e8f9,
      iceblock: 0xa5f3fc,
      crumble: 0xfecdd3,
      woodblock: 0xcbd5e1,
      bookblock: 0x94a3b8,
    };

    this.platforms = worldData.platforms.map((p, idx) => {
      const depth = p.h > 2 ? 1.15 : 0.95;
      const geo = new THREE.BoxGeometry(p.w, p.h, depth);
      const frontTex = getPlatformTexture(p.style, 0, false);
      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: p.slippery ? 0.25 : 0.82,
        metalness: p.slippery ? 0.08 : 0.02,
      });
      const sideMat = new THREE.MeshStandardMaterial({
        color: sideMatMap[p.style] || 0xb8c7d9,
        roughness: 0.85,
      });
      // BoxGeometry faces: +x, -x, +y, -y, +z (front), -z (back)
      const mesh = new THREE.Mesh(geo, [sideMat, sideMat, frontMat, sideMat, frontMat, sideMat]);
      mesh.position.set(p.x, p.y, 0);
      if (p.tilt) mesh.rotation.z = p.tilt;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      // Dashed wireframe outline for fallen crumble blocks
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const ghost = new THREE.LineSegments(
        edgeGeo,
        new THREE.LineBasicMaterial({ color: 0x182230, transparent: true, opacity: 0.28 })
      );
      ghost.position.copy(mesh.position);
      ghost.rotation.copy(mesh.rotation);
      ghost.visible = false;
      this.group.add(ghost);

      // Moving platform track pins in background (z = -0.65)
      if (p.move) {
        const isX = p.move.axis === 'x';
        const x1 = isX ? p.x - p.move.range : p.x;
        const y1 = isX ? p.y : p.y - p.move.range;
        const x2 = isX ? p.x + p.move.range : p.x;
        const y2 = isX ? p.y : p.y + p.move.range;
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const railGeo = new THREE.CylinderGeometry(0.03, 0.03, len, 6);
        const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set((x1 + x2) / 2, (y1 + y2) / 2, -0.65);
        if (isX) rail.rotation.z = Math.PI / 2;
        this.group.add(rail);

        const pinGeo = new THREE.SphereGeometry(0.09, 10, 10);
        const p1 = new THREE.Mesh(pinGeo, railMat);
        p1.position.set(x1, y1, -0.65);
        const p2 = new THREE.Mesh(pinGeo, railMat);
        p2.position.set(x2, y2, -0.65);
        this.group.add(p1, p2);
      }

      return {
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
        mesh,
        frontMat,
        ghost,
      };
    });

    // 5. Tutorial & Chapter Signposts (z = -0.75)
    for (const sign of worldData.signs || []) {
      const tex = createSignTexture(sign);
      const geo = new THREE.PlaneGeometry(4.2, 1.85);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(sign.x, sign.y, -0.75);
      this.group.add(mesh);
    }

    // 6. 3D Ink Spikes (Hazards)
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x182230, roughness: 0.7 });
    const spikeGeo = new THREE.ConeGeometry(0.16, 0.38, 5);
    this.hazards = worldData.hazards.map((h, idx) => {
      const hGroup = new THREE.Group();
      hGroup.position.set(h.x, h.y, 0);

      const base = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, 0.8), spikeMat);
      base.castShadow = true;
      base.receiveShadow = true;
      hGroup.add(base);

      const spikeCount = Math.max(3, Math.floor(h.w / 0.45));
      for (let i = 0; i < spikeCount; i++) {
        const t = spikeCount === 1 ? 0 : i / (spikeCount - 1) - 0.5;
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(t * (h.w - 0.3), h.h / 2 + 0.16, 0);
        spike.castShadow = true;
        hGroup.add(spike);
      }

      this.group.add(hGroup);
      return { ...h, seed: 900 + idx * 27.3, group: hGroup };
    });

    // 7. 3D Checkpoints
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x182230, roughness: 0.6 });
    this.checkpoints = worldData.checkpoints.map((cp, idx) => {
      const cpGroup = new THREE.Group();
      cpGroup.position.set(cp.x, cp.y, -0.15);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 8), poleMat);
      pole.position.y = 0.2;
      pole.castShadow = true;
      cpGroup.add(pole);

      const finialMat = new THREE.MeshStandardMaterial({ color: 0x182230, roughness: 0.4 });
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), finialMat);
      finial.position.y = 0.9;
      cpGroup.add(finial);

      const flagMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.38, 0.05), flagMat);
      flag.position.set(0.35, 0.66, 0);
      flag.castShadow = true;
      cpGroup.add(flag);

      this.group.add(cpGroup);
      return {
        ...cp,
        activated: false,
        seed: 2100 + idx * 23.9,
        group: cpGroup,
        flag,
        flagMat,
        finialMat,
      };
    });

    // 8. 3D Extruded Stars
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.36 : 0.15;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(sx, sy);
      else starShape.lineTo(sx, sy);
    }
    starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    starGeo.center();

    this.stars = worldData.stars.map((s, idx) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x0891b2,
        emissiveIntensity: 0.25,
        roughness: 0.35,
      });
      const mesh = new THREE.Mesh(starGeo, mat);
      mesh.position.set(s.x, s.y, 0);
      mesh.castShadow = true;
      this.group.add(mesh);

      return {
        ...s,
        baseY: s.y,
        collected: false,
        seed: 1500 + idx * 19.1,
        mesh,
      };
    });

    // 9. 3D Goal Bookmark Ribbon
    const ribbonShape = new THREE.Shape();
    ribbonShape.moveTo(-0.38, 0.85);
    ribbonShape.lineTo(0.38, 0.85);
    ribbonShape.lineTo(0.38, -0.75);
    ribbonShape.lineTo(0, -0.35);
    ribbonShape.lineTo(-0.38, -0.75);
    ribbonShape.closePath();

    const ribbonGeo = new THREE.ExtrudeGeometry(ribbonShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    ribbonGeo.center();
    const ribbonMesh = new THREE.Mesh(
      ribbonGeo,
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45 })
    );
    ribbonMesh.position.set(worldData.goal.x, worldData.goal.y, 0);
    ribbonMesh.castShadow = true;
    this.group.add(ribbonMesh);

    this.goal = { ...worldData.goal, radius: 1.0, seed: 2800, mesh: ribbonMesh };

    // 10. 3D Floating Graphite Dust Motes
    const moteCount = 180;
    const positions = new Float32Array(moteCount * 3);
    this.moteBaseY = [];
    this.motePhases = [];
    for (let i = 0; i < moteCount; i++) {
      const x = Math.random() * 420 - 5;
      const y = (Math.random() - 0.5) * 12;
      const z = (Math.random() - 0.5) * 2.8;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      this.moteBaseY.push(y);
      this.motePhases.push(Math.random() * Math.PI * 2);
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x475569,
      size: 0.075,
      transparent: true,
      opacity: 0.35,
    });
    this.motesPoints = new THREE.Points(moteGeo, moteMat);
    this.group.add(this.motesPoints);
  }

  _buildSectionDoodles(sections) {
    const themeKinds = {
      svenska: ['abc', 'quote', 'spiral', 'paperclip'],
      matte: ['triangle', 'compass', 'pi', 'math_eq'],
      no: ['flask', 'atom'],
      slojd: ['scissors', 'spiral'],
    };

    const geo = new THREE.PlaneGeometry(1.5, 1.5);
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const pool = themeKinds[sec.theme] || themeKinds.slojd;
      const minX = Math.max(sec.startX + 4, 4);
      const maxX = Math.min(sec.endX - 4, 408);
      const span = Math.max(10, maxX - minX);
      const count = Math.max(6, Math.round(span / 7.5));

      for (let i = 0; i < count; i++) {
        const x = minX + ((i + 0.5) / count) * span;
        const y = i % 2 === 0 ? 3.2 + (i % 3) * 0.65 : -3.8 - (i % 3) * 0.45;
        const kind = pool[i % pool.length];
        const tex = getDoodleTexture(kind, 3300 + sIdx * 211 + i * 41.2);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, -1.35);
        this.group.add(mesh);
      }
    }
  }

  update(time, dt) {
    const boilFrame = Math.floor(time * BOIL_FPS) % 3;

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

      // Sync 3D mesh state
      const isFallen = p.crumbleState === 'fallen';
      p.mesh.visible = !isFallen;
      p.ghost.visible = isFallen;

      const shakeSeed = p.seed + Math.floor(time * 32) * 1.7;
      const shakeX = p.crumbleState === 'shaking' ? hash2(shakeSeed, boilFrame) * 0.06 : 0;
      const shakeY = p.crumbleState === 'shaking' ? hash2(shakeSeed + 5.1, boilFrame) * 0.05 : 0;
      p.mesh.position.set(p.x + shakeX, p.y + shakeY, 0);

      if (p.bounceAnim > 0) {
        const s = Math.sin(p.bounceAnim * Math.PI) * 0.28;
        p.mesh.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.3);
      } else {
        p.mesh.scale.set(1, 1, 1);
      }

      const desiredTex = getPlatformTexture(p.style, boilFrame, p.crumbleState === 'shaking');
      if (p.frontMat.map !== desiredTex) {
        p.frontMat.map = desiredTex;
        p.frontMat.needsUpdate = true;
      }
    }

    for (const cp of this.checkpoints) {
      if (cp.activated) {
        cp.flagMat.color.setHex(0x38bdf8);
        cp.finialMat.color.setHex(0x0284c7);
        cp.flag.rotation.y = Math.sin(time * 6 + cp.x) * 0.24;
      }
    }

    for (const s of this.stars) {
      s.mesh.visible = !s.collected;
      if (!s.collected) {
        s.y = s.baseY + Math.sin(time * 3.2 + s.x) * 0.12;
        s.mesh.position.set(s.x, s.y, 0);
        s.mesh.rotation.y = time * 1.8 + s.x;
        s.mesh.rotation.z = Math.sin(time * 2 + s.x) * 0.12;
      }
    }

    if (this.goal && this.goal.mesh) {
      this.goal.mesh.rotation.y = Math.sin(time * 2.2) * 0.28;
      this.goal.mesh.rotation.z = Math.sin(time * 2.5) * 0.06;
    }

    if (this.motesPoints) {
      const posAttr = this.motesPoints.geometry.getAttribute('position');
      for (let i = 0; i < this.moteBaseY.length; i++) {
        posAttr.setY(i, this.moteBaseY[i] + Math.sin(time * 0.8 + this.motePhases[i]) * 0.25);
      }
      posAttr.needsUpdate = true;
    }
  }
}
