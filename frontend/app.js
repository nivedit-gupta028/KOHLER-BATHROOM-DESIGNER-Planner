import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const state = { 
  layout: null, 
  scene: null, 
  camera: null, 
  renderer: null, 
  controls: null, 
  raycaster: null, 
  pointer: new THREE.Vector2(), 
  fixtureGroups: [], 
  meshes: [], 
  activeGroup: null, 
  roomGroup: null,
  waterTimeUniforms: [],
  lights: {},
  roomMeshes: {}
};

const $ = (id) => document.getElementById(id);
const form = $('optimize-form');
const solveButton = $('solve-button');
const viewport = $('viewport');

function money(value) { 
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0); 
}

function number(value, digits = 1) { 
  return Number(value || 0).toFixed(digits); 
}

function updateArea() { 
  const lEl = $('length');
  const wEl = $('width');
  if (lEl && wEl && $('area-readout')) {
    $('area-readout').textContent = `${number(Number(lEl.value) * Number(wEl.value))} sq ft`;
  }
}

if ($('length') && $('width')) {
  $('length').addEventListener('input', updateArea);
  $('width').addEventListener('input', updateArea);
  updateArea();
}

function showError(message) {
  const errEl = $('viewport-empty');
  if (!errEl) return;
  errEl.classList.remove('hidden');
  errEl.innerHTML = `<div class="text-center"><div class="mb-2 font-display text-xl text-red-300">Unable to resolve room</div><div class="text-xs uppercase tracking-[0.12em] text-muted">${message}</div></div>`;
}

function clearViewport() {
  if (!state.scene) return;
  if (state.roomGroup) state.scene.remove(state.roomGroup);
  state.roomGroup = new THREE.Group();
  state.scene.add(state.roomGroup);
  state.fixtureGroups = [];
  state.meshes = [];
  state.waterTimeUniforms = [];
  state.activeGroup = null;
  const hud = $('hud');
  if (hud) hud.classList.add('hidden');
}

function material(color, options = {}) { 
  return new THREE.MeshStandardMaterial({ 
    color, 
    roughness: options.roughness ?? 0.35, 
    metalness: options.metalness ?? 0.08, 
    emissive: options.emissive || 0x000000, 
    emissiveIntensity: options.emissiveIntensity || 0,
    side: options.side || THREE.FrontSide
  }); 
}

function addPart(group, geometry, mat, x, y, z) { 
  const mesh = new THREE.Mesh(geometry, mat); 
  mesh.position.set(x, y, z); 
  mesh.castShadow = true; 
  mesh.receiveShadow = true; 
  mesh.userData.fixtureGroup = group; 
  group.add(mesh); 
  state.meshes.push(mesh); 
  return mesh; 
}

function labelSprite(text) {
  const canvas = document.createElement('canvas'); 
  canvas.width = 460; 
  canvas.height = 80;
  const ctx = canvas.getContext('2d'); 
  ctx.fillStyle = '#f7f2e9'; 
  ctx.font = '600 24px DM Sans, sans-serif'; 
  ctx.fillText(text, 14, 48);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ 
    map: new THREE.CanvasTexture(canvas), 
    transparent: true, 
    depthTest: false 
  }));
  sprite.scale.set(1.9, 0.33, 1); 
  return sprite;
}

// ─── Realistic Water Physics ────────────────────────────────────────────
const GPM_TO_M3S = 6.309e-5;
const FT_TO_M = 0.3048;
const GRAVITY = 9.81;

function createAnimatedWaterPoolMaterial(gpm = 2.0) {
  const timeUniform = { value: 0 };
  state.waterTimeUniforms.push(timeUniform);
  const ampScale = Math.min(1.0, gpm / 5.0);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x3d9ecc,
    transmission: 0.88,
    opacity: 1.0,
    transparent: true,
    roughness: 0.02,
    metalness: 0.0,
    ior: 1.333,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.8,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uAmp = { value: ampScale };
    shader.vertexShader = `
      uniform float uTime;
      uniform float uAmp;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float amp = uAmp;
      float w1 = sin(position.x * 8.0 + position.z * 4.0 + uTime * 3.8) * 0.012 * amp;
      float w2 = cos(position.z * 9.0 - position.x * 3.0 + uTime * 2.9) * 0.009 * amp;
      float w3 = sin(position.x * 22.0 - uTime * 7.0) * 0.003 * amp;
      float w4 = cos((position.x + position.z) * 3.5 + uTime * 1.6) * 0.014 * amp;
      transformed.y += w1 + w2 + w3 + w4;
      `
    );
  };
  return mat;
}

function createAnimatedStreamMaterial(gpm = 2.0) {
  const timeUniform = { value: 0 };
  state.waterTimeUniforms.push(timeUniform);
  const turbScale = Math.max(0.5, 2.0 - gpm * 0.15);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x88d8ff,
    transmission: 0.97,
    opacity: 1.0,
    transparent: true,
    roughness: 0.0,
    metalness: 0.0,
    ior: 1.333,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uTurb = { value: turbScale };
    shader.vertexShader = `
      uniform float uTime;
      uniform float uTurb;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      float t = (position.y + 0.5);
      float instab = (1.0 - t) * 0.006 * uTurb;
      float jitter = sin(position.y * 28.0 - uTime * 22.0 + position.x * 5.0) * instab;
      float jitter2 = cos(position.y * 20.0 - uTime * 18.0 + position.z * 6.0) * instab * 0.7;
      transformed.x += jitter;
      transformed.z += jitter2;
      `
    );
  };
  return mat;
}

function createRippleSystem(group, x, y, z, count = 4) {
  const rings = [];
  const mats = [];

  for (let i = 0; i < count; i++) {
    const geo = new THREE.RingGeometry(0.015, 0.06, 40);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xd0eeff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, y + 0.005, z);
    ring.visible = false;
    ring.userData.phase = i / count;
    ring.userData.t = i / count;
    group.add(ring);
    rings.push(ring);
    mats.push(mat);
  }

  return {
    rings,
    mats,
    visible: false,
    setVisible(v) {
      this.visible = v;
      rings.forEach(r => { r.visible = v; });
    },
    update(dt) {
      if (!this.visible) return;
      const speed = 1.8;
      for (let i = 0; i < rings.length; i++) {
        rings[i].userData.t += dt * speed;
        if (rings[i].userData.t > 1.0) rings[i].userData.t = 0.0;
        const t = rings[i].userData.t;
        const sc = 0.5 + t * 2.5;
        rings[i].scale.setScalar(sc);
        mats[i].opacity = t < 0.25 ? (t / 0.25) * 0.7 : Math.max(0, 0.7 * (1.0 - (t - 0.25) / 0.75));
      }
    }
  };
}

function createCausticSpot(group, x, y, z) {
  const geo = new THREE.PlaneGeometry(0.28, 0.28, 12, 12);
  geo.rotateX(-Math.PI / 2);
  const timeUnif = { value: 0 };
  state.waterTimeUniforms.push(timeUnif);

  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const spot = new THREE.Mesh(geo, mat);
  spot.position.set(x, y + 0.002, z);
  spot.visible = false;
  group.add(spot);

  return {
    mesh: spot,
    mat,
    timeUnif,
    t: 0,
    setVisible(v) { spot.visible = v; if (!v) mat.opacity = 0; },
    update(dt) {
      if (!spot.visible) return;
      this.t += dt;
      const flicker = 0.25 + 0.18 * Math.sin(this.t * 7.3) + 0.10 * Math.cos(this.t * 11.1);
      spot.position.x = x + Math.sin(this.t * 3.5) * 0.03;
      spot.position.z = z + Math.cos(this.t * 4.2) * 0.03;
      mat.opacity = flicker * 0.55;
    }
  };
}

function createSteamSystem(group, cx, baseY, cz, spreadR, count = 55) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  const life = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spreadR;
    pos[i * 3]     = cx + Math.cos(a) * r;
    pos[i * 3 + 1] = baseY + Math.random() * 0.25;
    pos[i * 3 + 2] = cz + Math.sin(a) * r;
    vel.push({ x: (Math.random() - 0.5) * 0.006, y: 0.018 + Math.random() * 0.022, z: (Math.random() - 0.5) * 0.006 });
    life[i] = Math.random();
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe8f4ff, size: 0.06, transparent: true, opacity: 0.0,
    depthWrite: false, sizeAttenuation: true
  });
  const sys = new THREE.Points(geo, mat);
  sys.visible = false;
  group.add(sys);

  let active = false;
  let t = 0;

  return {
    _geo: geo,
    get visible() { return active; },
    setVisible(v, currentPoolY) {
      active = v;
      sys.visible = v;
      if (v) {
        const positions = geo.attributes.position.array;
        const surface = currentPoolY ?? baseY;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * spreadR;
          positions[i * 3]     = cx + Math.cos(a) * r;
          positions[i * 3 + 1] = surface + Math.random() * 0.1;
          positions[i * 3 + 2] = cz + Math.sin(a) * r;
          life[i] = Math.random();
        }
      } else { t = 0; mat.opacity = 0; }
    },
    update(dt, currentPoolY) {
      if (!active) return;
      t += dt;
      const surface = currentPoolY ?? baseY;
      const rampIn = Math.min(1.0, t / 2.5);
      mat.opacity = rampIn * (0.22 + 0.08 * Math.sin(t * 2.1));

      const positions = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        life[i] += dt * 0.55;
        if (life[i] > 1.0) {
          life[i] = 0;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * spreadR;
          positions[i * 3]     = cx + Math.cos(a) * r;
          positions[i * 3 + 1] = surface;
          positions[i * 3 + 2] = cz + Math.sin(a) * r;
        }
        const lt = life[i];
        positions[i * 3]     += vel[i].x;
        positions[i * 3 + 1] += vel[i].y * (1.0 + lt);
        positions[i * 3 + 2] += vel[i].z;
        positions[i * 3]     += Math.sin(t * 3.2 + i) * 0.0018;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

function createDrainVortex(group, drainX, drainY, drainZ, radius, count = 60) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const radii  = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    phases[i] = (i / count) * Math.PI * 2;
    radii[i]  = radius * (0.3 + Math.random() * 0.7);
    pos[i * 3]     = drainX + Math.cos(phases[i]) * radii[i];
    pos[i * 3 + 1] = drainY + Math.random() * 0.05;
    pos[i * 3 + 2] = drainZ + Math.sin(phases[i]) * radii[i];
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xb0d8f0, size: 0.022, transparent: true, opacity: 0.0,
    depthWrite: false, sizeAttenuation: true
  });
  const sys = new THREE.Points(geo, mat);
  sys.visible = false;
  group.add(sys);

  let active = false;
  let t = 0;

  return {
    _geo: geo,
    get visible() { return active; },
    setVisible(v) {
      active = v;
      sys.visible = v;
      if (!v) { t = 0; mat.opacity = 0; }
    },
    update(dt, currentPoolY) {
      if (!active) return;
      t += dt;
      mat.opacity = Math.min(0.65, t * 0.4);

      const positions = geo.attributes.position.array;
      const surface = currentPoolY ?? drainY;
      const rotSpeed = 3.2;
      const inwardSpeed = 0.008;

      for (let i = 0; i < count; i++) {
        phases[i] += rotSpeed * dt;
        radii[i]  -= inwardSpeed * dt;
        if (radii[i] < 0.01) {
          radii[i]  = radius * (0.5 + Math.random() * 0.5);
          phases[i] = Math.random() * Math.PI * 2;
        }
        positions[i * 3]     = drainX + Math.cos(phases[i]) * radii[i];
        positions[i * 3 + 1] = surface + (radii[i] / radius) * 0.04;
        positions[i * 3 + 2] = drainZ + Math.sin(phases[i]) * radii[i];
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

function createSplashDroplets(group, impactX, impactY, impactZ, gpm, count = 45) {
  const geo = new THREE.BufferGeometry();
  const pos  = new Float32Array(count * 3);
  const velArr = [];
  const life = new Float32Array(count);

  const speed = 0.04 + gpm * 0.006;

  function resetDrop(i) {
    pos[i * 3]     = impactX;
    pos[i * 3 + 1] = impactY;
    pos[i * 3 + 2] = impactZ;
    const angle = Math.random() * Math.PI * 2;
    const vMag  = speed * (0.5 + Math.random());
    velArr[i] = {
      x: Math.cos(angle) * vMag,
      y: 0.06 + Math.random() * 0.08,
      z: Math.sin(angle) * vMag
    };
    life[i] = Math.random() * 0.6;
  }

  for (let i = 0; i < count; i++) resetDrop(i);

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd0eeff, size: 0.016, transparent: true, opacity: 0.0,
    depthWrite: false, sizeAttenuation: true
  });
  const sys = new THREE.Points(geo, mat);
  sys.visible = false;
  group.add(sys);

  let active = false;
  const GRAV = 0.12;

  return {
    get visible() { return active; },
    setVisible(v, currentSurfaceY) {
      active = v;
      sys.visible = v;
      if (v) {
        for (let i = 0; i < count; i++) {
          const surfY = currentSurfaceY ?? impactY;
          pos[i * 3 + 1] = surfY;
          resetDrop(i);
        }
        mat.opacity = 0.8;
      } else { mat.opacity = 0; }
    },
    update(dt, currentSurfaceY) {
      if (!active) return;
      const surfY = currentSurfaceY ?? impactY;
      const positions = geo.attributes.position.array;

      for (let i = 0; i < count; i++) {
        life[i] += dt * 1.8;
        if (life[i] > 1.0) {
          resetDrop(i);
          life[i] = 0;
          positions[i * 3]     = impactX;
          positions[i * 3 + 1] = surfY;
          positions[i * 3 + 2] = impactZ;
        }
        const lt = life[i];
        positions[i * 3]     += velArr[i].x * dt * 28.0;
        positions[i * 3 + 1] += (velArr[i].y - GRAV * lt) * dt * 28.0;
        positions[i * 3 + 2] += velArr[i].z * dt * 28.0;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 0.75 + 0.12 * Math.sin(Date.now() * 0.01);
    }
  };
}

function createWaterSystem(group, cfg) {
  const {
    gpm, streamTop, streamBottom, areaM2,
    poolY, poolMaxY, poolMesh,
    autoOffDist = 28.0,
    drainX = streamBottom.x, drainZ = streamBottom.z,
    drainRadius = 0.08,
    steamSpread = 0.3,
    confinedRadius = null
  } = cfg;

  const streamRadius = 0.013 + gpm * 0.004;
  const streamH = Math.max(0.05, streamTop.y - streamBottom.y);

  const streamGeo = new THREE.CylinderGeometry(
    streamRadius * 0.55,
    streamRadius,
    streamH, 18, 28, true
  );
  const streamMat = createAnimatedStreamMaterial(gpm);
  const stream = new THREE.Mesh(streamGeo, streamMat);
  stream.position.set(streamTop.x, streamBottom.y + streamH / 2, streamTop.z);
  stream.visible = false;
  group.add(stream);

  poolMesh.position.y = poolY;
  poolMesh.visible = false;
  group.add(poolMesh);

  const rippleSys = createRippleSystem(group, streamBottom.x, poolY, streamBottom.z, 5);
  const caustic = createCausticSpot(group, streamBottom.x, poolY, streamBottom.z);
  const steam = createSteamSystem(group, drainX, poolY, drainZ, steamSpread);
  const vortex = createDrainVortex(group, drainX, poolY, drainZ, drainRadius);
  const splashDroplets = createSplashDroplets(group, streamBottom.x, poolY, streamBottom.z, gpm);

  function clampToBasin(positions, cx, cz, R, count) {
    for (let i = 0; i < count; i++) {
      const dx = positions[i * 3]     - cx;
      const dz = positions[i * 3 + 2] - cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > R) {
        const scale = R / dist;
        positions[i * 3]     = cx + dx * scale;
        positions[i * 3 + 2] = cz + dz * scale;
      }
    }
  }

  const flowM3S = gpm * GPM_TO_M3S;

  const sys = {
    active: false,
    poolLevel: poolY,
    stream,
    pool: poolMesh,

    toggle(forceState = null) {
      sys.active = forceState !== null ? forceState : !sys.active;
      stream.visible   = sys.active;
      poolMesh.visible = sys.active;
      rippleSys.setVisible(sys.active);
      caustic.setVisible(sys.active);
      steam.setVisible(sys.active, sys.poolLevel);
      vortex.setVisible(sys.active);
      if (splashDroplets) splashDroplets.setVisible(sys.active, sys.poolLevel);

      if (!sys.active) {
        sys.poolLevel = poolY;
        poolMesh.position.y = poolY;
      }
    },

    update(dt, camera) {
      if (!sys.active) return;

      if (camera) {
        const groupPos = new THREE.Vector3();
        group.getWorldPosition(groupPos);
        if (camera.position.distanceTo(groupPos) > autoOffDist) {
          sys.toggle(false);
          return;
        }
      }

      const dhM = (flowM3S / Math.max(areaM2, 0.001)) * dt;
      const dhFt = dhM / FT_TO_M;
      sys.poolLevel = Math.min(sys.poolLevel + dhFt, poolMaxY);
      poolMesh.position.y = sys.poolLevel;

      const fillRatio = (sys.poolLevel - poolY) / Math.max(poolMaxY - poolY, 0.01);

      if (poolMesh.material && poolMesh.material.color) {
        const rc = THREE.MathUtils.lerp(0.35, 0.08, fillRatio);
        const gc = THREE.MathUtils.lerp(0.72, 0.42, fillRatio);
        const bc = THREE.MathUtils.lerp(0.92, 0.70, fillRatio);
        poolMesh.material.color.setRGB(rc, gc, bc);
      }

      rippleSys.rings.forEach(r => { r.position.y = sys.poolLevel + 0.005; });
      caustic.mesh.position.y = sys.poolLevel + 0.002;

      if (confinedRadius) {
        const maxScale = confinedRadius / 0.06;
        rippleSys.rings.forEach(r => {
          if (r.scale.x > maxScale) r.scale.setScalar(maxScale);
        });
      }

      const currentStreamH = Math.max(0.02, streamTop.y - sys.poolLevel);
      stream.scale.y = currentStreamH / streamH;
      stream.position.y = sys.poolLevel + currentStreamH / 2;

      rippleSys.update(dt);
      caustic.update(dt);
      steam.update(dt, sys.poolLevel);
      vortex.update(dt, sys.poolLevel);
      if (splashDroplets) splashDroplets.update(dt, sys.poolLevel);

      if (confinedRadius) {
        if (steam.visible && steam._geo) {
          clampToBasin(steam._geo.attributes.position.array, drainX, drainZ, confinedRadius, 55);
          steam._geo.attributes.position.needsUpdate = true;
        }
        if (vortex.visible && vortex._geo) {
          clampToBasin(vortex._geo.attributes.position.array, drainX, drainZ, confinedRadius, 60);
          vortex._geo.attributes.position.needsUpdate = true;
        }
      }
    }
  };
  return sys;
}

// ─── Procedural Geometry Fallbacks ─────────────────────────────────────
function buildProceduralVanity(group, width, depth, height) {
  const ceramic = material(0xfcfcfc, { roughness: 0.12, metalness: 0.04 });
  const richWood = material(0x4a2a18, { roughness: 0.58, metalness: 0.02 });
  const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
  const marble = material(0xf4f4f2, { roughness: 0.16, metalness: 0.05 });
  const darkMetal = material(0x222222, { roughness: 0.35, metalness: 0.85 });

  const cabH = 2.65;
  const T = 0.08;
  const ctW = width * 0.98;
  const ctD = depth * 0.96;
  const counterTopY = cabH + T;

  addPart(group, new THREE.BoxGeometry(ctW * 0.94, 0.1, ctD * 0.9), material(0x18120c, { roughness: 0.9 }), 0, 0.05, -0.01);
  addPart(group, new THREE.BoxGeometry(ctW, cabH - 0.1, ctD), richWood, 0, 0.1 + (cabH - 0.1) / 2, 0);
  addPart(group, new THREE.BoxGeometry(ctW + 0.04, T, ctD + 0.04), marble, 0, cabH + T / 2, 0);
  addPart(group, new THREE.BoxGeometry(ctW + 0.04, 0.12, 0.03), marble, 0, counterTopY + 0.06, -ctD / 2);

  const sinkR = Math.min(ctW * 0.28, ctD * 0.36);
  const sinkH = 0.48;

  addPart(group, new THREE.CylinderGeometry(sinkR, sinkR * 0.7, sinkH, 36, 1, true), ceramic, 0, counterTopY + sinkH / 2, 0.04);
  addPart(group, new THREE.CircleGeometry(sinkR * 0.7, 36).rotateX(-Math.PI / 2), ceramic, 0, counterTopY + 0.02, 0.04);
  addPart(group, new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), darkMetal, 0, counterTopY + 0.025, 0.04);

  const faucetZ = -ctD * 0.32;
  const fBase = addPart(group, new THREE.CylinderGeometry(0.035, 0.04, sinkH + 0.35, 16), chrome, 0, counterTopY + (sinkH + 0.35) / 2, faucetZ);
  fBase.userData.isFaucet = true;
  const fSpout = addPart(group, new THREE.CylinderGeometry(0.02, 0.02, Math.abs(faucetZ) + 0.04, 16), chrome, 0, counterTopY + sinkH + 0.35, faucetZ / 2 + 0.02);
  fSpout.rotation.x = Math.PI / 2;
  fSpout.userData.isFaucet = true;
  const fTip = addPart(group, new THREE.CylinderGeometry(0.022, 0.016, 0.08, 16), chrome, 0, counterTopY + sinkH + 0.31, 0.04);
  fTip.userData.isFaucet = true;

  const poolR = sinkR * 0.68;
  const poolGeo = new THREE.CylinderGeometry(poolR, poolR, 0.005, 32, 6);
  const poolMesh = new THREE.Mesh(poolGeo, createAnimatedWaterPoolMaterial(1.2));
  poolMesh.position.set(0, counterTopY + 0.03, 0.04);

  group.userData.waterSystem = createWaterSystem(group, {
    gpm: 1.2,
    streamTop:    { x: 0, y: counterTopY + sinkH + 0.27, z: 0.04 },
    streamBottom: { x: 0, y: counterTopY + 0.03, z: 0.04 },
    areaM2:  Math.PI * (poolR * FT_TO_M) ** 2,
    poolY:   counterTopY + 0.03,
    poolMaxY: counterTopY + sinkH - 0.05,
    poolMesh,
    autoOffDist: 28.0,
    drainX: 0, drainZ: 0.04,
    drainRadius: 0.065,
    steamSpread: poolR * 0.65,
    confinedRadius: poolR
  });

  return counterTopY + 0.9;
}

function createRoundedBasinGeometry(width, depth, radius) {
  const shape = new THREE.Shape();
  const x = width / 2;
  const z = depth / 2;
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z);
  shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  return new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2);
}

function buildProceduralBathtub(group, width, depth, height) {
  const ceramic = material(0xfcfcfc, { roughness: 0.12, metalness: 0.04 });
  const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
  const darkMetal = material(0x222222, { roughness: 0.35, metalness: 0.85 });

  const tubH = 1.8;
  const wallT = 0.12;
  const innerW = width - wallT * 2;
  const innerD = depth - wallT * 2;

  addPart(group, new THREE.BoxGeometry(innerW, wallT, innerD), ceramic, 0, wallT / 2, 0);
  addPart(group, new THREE.BoxGeometry(width, tubH, wallT), ceramic, 0, tubH / 2, depth / 2 - wallT / 2);
  addPart(group, new THREE.BoxGeometry(width, tubH, wallT), ceramic, 0, tubH / 2, -depth / 2 + wallT / 2);
  addPart(group, new THREE.BoxGeometry(wallT, tubH, depth), ceramic, -width / 2 + wallT / 2, tubH / 2, 0);
  addPart(group, new THREE.BoxGeometry(wallT, tubH, depth), ceramic, width / 2 - wallT / 2, tubH / 2, 0);

  const faucetZ = -depth / 2 + wallT + 0.15;
  const fBase = addPart(group, new THREE.CylinderGeometry(0.04, 0.04, tubH * 0.65, 16), chrome, 0, tubH * 0.8, faucetZ);
  fBase.userData.isFaucet = true;

  const spoutArm = addPart(group, new THREE.CylinderGeometry(0.03, 0.03, 0.65, 16), chrome, 0, tubH + 0.15, faucetZ + 0.32);
  spoutArm.rotation.x = Math.PI / 2;
  spoutArm.userData.isFaucet = true;

  const spoutTipZ = faucetZ + 0.65;
  addPart(group, new THREE.CylinderGeometry(0.09, 0.09, 0.015, 24), darkMetal, 0, wallT + 0.008, spoutTipZ);

  const poolGeo = createRoundedBasinGeometry(innerW * 0.92, innerD * 0.92, Math.min(innerW, innerD) * 0.14);
  const poolMesh = new THREE.Mesh(poolGeo, createAnimatedWaterPoolMaterial(5.0));
  poolMesh.position.set(0, wallT + 0.02, 0);

  group.userData.waterSystem = createWaterSystem(group, {
    gpm: 5.0,
    streamTop:    { x: 0, y: tubH + 0.1, z: spoutTipZ },
    streamBottom: { x: 0, y: wallT + 0.02, z: spoutTipZ },
    areaM2:  (innerW * FT_TO_M) * (innerD * FT_TO_M),
    poolY:   wallT + 0.02,
    poolMaxY: tubH - 0.15,
    poolMesh,
    autoOffDist: 28.0,
    drainX: 0, drainZ: spoutTipZ,
    drainRadius: 0.11,
    steamSpread: innerW * 0.3
  });

  return tubH + 0.6;
}

function buildProceduralToilet(group, width, depth, height) {
  const ceramic = material(0xfcfcfc, { roughness: 0.12, metalness: 0.04 });
  const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });

  const tH = 2.4;
  const tW = 1.3;
  const tD = 2.1;

  addPart(group, new THREE.CylinderGeometry(tW * 0.35, tW * 0.44, tH * 0.5, 32), ceramic, 0, tH * 0.25, 0.1);
  const bowl = addPart(group, new THREE.BoxGeometry(tW * 0.68, tH * 0.28, tD * 0.65), ceramic, 0, tH * 0.48, 0.22);
  bowl.geometry.computeVertexNormals();

  const seat = addPart(group, new THREE.TorusGeometry(tW * 0.26, 0.045, 16, 32), material(0x222222, { roughness: 0.6 }), 0, tH * 0.64, 0.25);
  seat.rotation.x = Math.PI / 2;

  const tankH = tH * 0.68;
  const tankD = 0.55;
  addPart(group, new THREE.BoxGeometry(tW * 0.85, tankH, tankD), ceramic, 0, tH * 0.66, -tD * 0.25);
  const lever = addPart(group, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 24), chrome, 0, tH * 0.66 + tankH / 2 + 0.01, -tD * 0.25);
  lever.userData.isFaucet = true;

  return tH + 0.5;
}

// ─── Precision OBJ Normalization & Fixture Builders ─────────────────────────
const KNOWN_ASSETS = new Set([
  '1946-LA.obj', '1946-RW.obj', '20705-N.obj', '22170.obj', '2269-1.obj',
  '23188-HC.obj', '31110-G.obj', '31620.obj', '45210.obj', '454-4V.obj',
  '45906.obj', '5172-HC.obj', '77983-4.obj', '77990-9.obj', '8648.obj', '933.obj'
]);

function getMappedAsset(fixture) {
  if (fixture.asset_file && KNOWN_ASSETS.has(fixture.asset_file)) {
    return fixture.asset_file;
  }
  if (fixture.category === 'Toilet') return '5172-HC.obj';
  if (fixture.category === 'Bathtub') return '1946-LA.obj';
  if (fixture.category === 'Vanity') return '2269-1.obj';
  if (fixture.category === 'Shower') return '8648.obj';
  return null;
}

function buildAssetToilet(group, width, depth, height, fixture) {
  const assetName = getMappedAsset(fixture) || '5172-HC.obj';
  const loader = new OBJLoader();
  let loaded = false;

  loader.load(`/static/assets/${assetName}`, (model) => {
    loaded = true;
    const porcelain = material(0xfcfcfc, { roughness: 0.10, metalness: 0.04 });
    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);

    model.traverse((child) => {
      if (child.isMesh) {
        child.material = porcelain;
        child.geometry.computeVertexNormals();
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.fixtureGroup = group;
        state.meshes.push(child);
      }
    });

    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());

    const scale = Math.min(
      width / Math.max(size.x, 0.01),
      height / Math.max(size.y, 0.01),
      depth / Math.max(size.z, 0.01)
    );
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());

    model.position.x = -center.x;
    model.position.y = -box.min.y;
    model.position.z = -depth / 2 - box.min.z + 0.04;
    group.add(model);

    const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
    const lever = addPart(group, new THREE.CylinderGeometry(0.025, 0.025, 0.015, 16), chrome, -width * 0.35, height * 0.88, -depth * 0.28);
    lever.userData.isFaucet = true;
  }, undefined, () => {
    if (!loaded) buildProceduralToilet(group, width, depth, height);
  });

  return height + 0.55;
}

function buildAssetBathtub(group, width, depth, height, fixture) {
  const assetName = getMappedAsset(fixture) || '1946-LA.obj';
  const loader = new OBJLoader();
  let loaded = false;

  loader.load(`/static/assets/${assetName}`, (model) => {
    loaded = true;
    const tubMat = material(0xfafafa, { roughness: 0.12, metalness: 0.04 });
    model.rotation.set(0, 0, 0);
    model.updateMatrixWorld(true);

    model.traverse((child) => {
      if (child.isMesh) {
        child.material = tubMat;
        child.geometry.computeVertexNormals();
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.fixtureGroup = group;
        state.meshes.push(child);
      }
    });

    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());

    model.scale.set(
      width / Math.max(size.x, 0.01),
      height / Math.max(size.y, 0.01),
      depth / Math.max(size.z, 0.01)
    );
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x = -center.x;
    model.position.y = -box.min.y;
    model.position.z = -center.z;
    group.add(model);

    const drainX = -width * 0.32;
    const drainZ = 0;
    const drainY = 0.06;
    const darkMetal = material(0x222222, { roughness: 0.35, metalness: 0.85 });
    addPart(group, new THREE.CylinderGeometry(0.06, 0.06, 0.01, 24), darkMetal, drainX, drainY, drainZ);

    const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
    const faucetZ = -depth / 2 + 0.15;
    const fBase = addPart(group, new THREE.CylinderGeometry(0.035, 0.035, height * 0.75, 16), chrome, drainX, height * 0.85, faucetZ);
    fBase.userData.isFaucet = true;
    const spoutArm = addPart(group, new THREE.CylinderGeometry(0.025, 0.025, 0.55, 16), chrome, drainX, height + 0.18, faucetZ + 0.26);
    spoutArm.rotation.x = Math.PI / 2;
    spoutArm.userData.isFaucet = true;

    const spoutTipZ = faucetZ + 0.52;
    const spoutTipY = height + 0.12;

    const poolW = width * 0.82;
    const poolD = depth * 0.76;
    const poolGeo = new THREE.PlaneGeometry(poolW, poolD, 32, 32);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMesh = new THREE.Mesh(poolGeo, createAnimatedWaterPoolMaterial(5.0));
    poolMesh.position.set(0, drainY + 0.02, 0);

    group.userData.waterSystem = createWaterSystem(group, {
      gpm: 5.0,
      streamTop:    { x: drainX, y: spoutTipY, z: spoutTipZ },
      streamBottom: { x: drainX, y: drainY + 0.02, z: spoutTipZ },
      areaM2:    (poolW * FT_TO_M) * (poolD * FT_TO_M),
      poolY:     drainY + 0.02,
      poolMaxY:  height - 0.12,
      poolMesh,
      autoOffDist: 28.0,
      drainX,  drainZ,
      drainRadius: 0.09,
      steamSpread: poolW * 0.35
    });
  }, undefined, () => {
    if (!loaded) buildProceduralBathtub(group, width, depth, height);
  });

  return height + 0.65;
}

function buildAssetVanity(group, width, depth, height, fixture) {
  const richWood = material(0x4a2a18, { roughness: 0.58, metalness: 0.02 });
  const marble = material(0xf4f4f2, { roughness: 0.16, metalness: 0.05 });
  const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
  const darkMetal = material(0x222222, { roughness: 0.35, metalness: 0.85 });

  const cabH = Math.min(2.55, height * 0.78);
  const T = 0.08;
  const ctW = width * 0.98;
  const ctD = depth * 0.96;
  const counterTopY = cabH + T;

  addPart(group, new THREE.BoxGeometry(ctW * 0.94, 0.1, ctD * 0.9), material(0x18120c, { roughness: 0.9 }), 0, 0.05, -0.01);
  addPart(group, new THREE.BoxGeometry(ctW, cabH - 0.1, ctD), richWood, 0, 0.1 + (cabH - 0.1) / 2, 0);
  addPart(group, new THREE.BoxGeometry(ctW + 0.04, T, ctD + 0.04), marble, 0, cabH + T / 2, 0);
  addPart(group, new THREE.BoxGeometry(ctW + 0.04, 0.12, 0.03), marble, 0, counterTopY + 0.06, -ctD / 2);

  const assetName = getMappedAsset(fixture) || '2269-1.obj';
  const loader = new OBJLoader();
  let loaded = false;

  loader.load(`/static/assets/${assetName}`, (basin) => {
    loaded = true;
    const ceramic = material(0xfcfcfc, { roughness: 0.08, metalness: 0.03 });
    basin.updateMatrixWorld(true);

    basin.traverse((child) => {
      if (child.isMesh) {
        child.material = ceramic;
        child.geometry.computeVertexNormals();
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.fixtureGroup = group;
        state.meshes.push(child);
      }
    });

    let bBox = new THREE.Box3().setFromObject(basin);
    let bSize = bBox.getSize(new THREE.Vector3());

    const basinScale = Math.min((ctW * 0.56) / Math.max(bSize.x, 0.01), (ctD * 0.78) / Math.max(bSize.z, 0.01));
    basin.scale.setScalar(basinScale);
    basin.updateMatrixWorld(true);

    bBox = new THREE.Box3().setFromObject(basin);
    const bCenter = bBox.getCenter(new THREE.Vector3());
    basin.position.x = -bCenter.x;
    basin.position.y = counterTopY - bBox.min.y;
    basin.position.z = 0.02 - bCenter.z;
    group.add(basin);

    const drainY = counterTopY + 0.08;
    addPart(group, new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24), darkMetal, 0, drainY, 0.04);

    const faucetZ = -ctD * 0.28;
    const fBase = addPart(group, new THREE.CylinderGeometry(0.035, 0.04, 0.65, 16), chrome, 0, counterTopY + 0.32, faucetZ);
    fBase.userData.isFaucet = true;
    const fSpout = addPart(group, new THREE.CylinderGeometry(0.02, 0.02, Math.abs(faucetZ) + 0.04, 16), chrome, 0, counterTopY + 0.62, faucetZ / 2 + 0.02);
    fSpout.rotation.x = Math.PI / 2;
    fSpout.userData.isFaucet = true;
    const fTip = addPart(group, new THREE.CylinderGeometry(0.022, 0.016, 0.08, 16), chrome, 0, counterTopY + 0.58, 0.04);
    fTip.userData.isFaucet = true;

    const poolR = Math.min(ctW * 0.2, ctD * 0.26);
    const poolGeo = new THREE.CylinderGeometry(poolR, poolR, 0.005, 32, 6);
    const poolMesh = new THREE.Mesh(poolGeo, createAnimatedWaterPoolMaterial(1.2));
    poolMesh.position.set(0, drainY + 0.01, 0.04);

    group.userData.waterSystem = createWaterSystem(group, {
      gpm: 1.2,
      streamTop:    { x: 0, y: counterTopY + 0.54, z: 0.04 },
      streamBottom: { x: 0, y: drainY + 0.01, z: 0.04 },
      areaM2:  Math.PI * (poolR * FT_TO_M) ** 2,
      poolY:   drainY + 0.01,
      poolMaxY: counterTopY + 0.38,
      poolMesh,
      autoOffDist: 28.0,
      drainX: 0, drainZ: 0.04,
      drainRadius: 0.06,
      steamSpread: poolR * 0.7,
      confinedRadius: poolR
    });
  }, undefined, () => {
    if (!loaded) buildProceduralVanity(group, width, depth, height);
  });

  return counterTopY + 0.9;
}

function buildAssetShower(group, width, depth, height, fixture) {
  const chrome = material(0xd8d8d8, { roughness: 0.08, metalness: 0.95 });
  const darkMetal = material(0x222222, { roughness: 0.35, metalness: 0.85 });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    roughness: 0.02,
    transmission: 0.92,
    thickness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const glassHeight = 6.4;
  const glassThickness = 0.03;

  addPart(group, new THREE.BoxGeometry(width, glassHeight, glassThickness), glassMat, 0, glassHeight / 2, -depth / 2 + glassThickness / 2);
  addPart(group, new THREE.BoxGeometry(width, glassHeight, glassThickness), glassMat, 0, glassHeight / 2, depth / 2 - glassThickness / 2);
  addPart(group, new THREE.BoxGeometry(glassThickness, glassHeight, depth), glassMat, width / 2 - glassThickness / 2, glassHeight / 2, 0);
  addPart(group, new THREE.BoxGeometry(glassThickness, glassHeight, depth), glassMat, -width / 2 + glassThickness / 2, glassHeight / 2, 0);

  const wallZ = -depth / 2 + 0.06;
  const colH = 4.2;
  const colY = 4.2;
  const sCol = addPart(group, new THREE.CylinderGeometry(0.035, 0.035, colH, 16), chrome, 0, colY, wallZ);
  sCol.userData.isFaucet = true;

  const armLen = 1.1;
  const sArm = addPart(group, new THREE.CylinderGeometry(0.03, 0.03, armLen, 16).rotateX(Math.PI / 2), chrome, 0, colY + colH / 2, wallZ + armLen / 2);
  sArm.userData.isFaucet = true;

  const headZ = wallZ + armLen;
  const headY = colY + colH / 2 - 0.06;
  const sHead = addPart(group, new THREE.CylinderGeometry(0.32, 0.32, 0.04, 32), chrome, 0, headY, headZ);
  sHead.userData.isFaucet = true;

  const pCount = 700;
  const SHOWER_FLOOR = 0.08;
  const headSpread = 0.42;

  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  const pVelY = new Float32Array(pCount);
  const pVelX = new Float32Array(pCount);
  const pVelZ = new Float32Array(pCount);
  const pLife = new Float32Array(pCount);
  const pSize = new Float32Array(pCount);

  function resetDroplet(i) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * headSpread;
    pPos[i * 3]     = Math.cos(angle) * r;
    pPos[i * 3 + 1] = headY - 0.04 - Math.random() * 0.3;
    pPos[i * 3 + 2] = headZ + Math.sin(angle) * r;
    pVelY[i] = -(0.5 + Math.random() * 0.4);
    pVelX[i] = (Math.random() - 0.5) * 0.012;
    pVelZ[i] = (Math.random() - 0.5) * 0.012;
    pLife[i] = 0;
    pSize[i] = 0.025 + Math.random() * 0.045;
  }

  for (let i = 0; i < pCount; i++) {
    resetDroplet(i);
    pPos[i * 3 + 1] = Math.random() * headY;
  }

  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.82 }
    },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (280.0 / -mvPosition.z);
        float yNorm = clamp(position.y / 6.5, 0.0, 1.0);
        vAlpha = 0.55 + 0.45 * yNorm;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vAlpha;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float alpha = smoothstep(0.5, 0.18, d) * vAlpha * uOpacity;
        gl_FragColor = vec4(0.72, 0.92, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false
  });

  const pSystem = new THREE.Points(pGeo, pMat);
  pSystem.visible = false;
  group.add(pSystem);

  const sCount = 120;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sCount * 3);
  const sVel = [];
  const sLife = new Float32Array(sCount);

  for (let i = 0; i < sCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.3;
    sPos[i * 3]     = Math.cos(angle) * r;
    sPos[i * 3 + 1] = SHOWER_FLOOR;
    sPos[i * 3 + 2] = headZ + Math.sin(angle) * r;
    sVel.push({
      x: (Math.random() - 0.5) * 0.15,
      y: Math.random() * 0.2 + 0.04,
      z: (Math.random() - 0.5) * 0.15
    });
    sLife[i] = Math.random();
  }

  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({
    color: 0xd8f4ff,
    size: 0.028,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    sizeAttenuation: true
  });
  const splashSystem = new THREE.Points(sGeo, sMat);
  splashSystem.visible = false;
  group.add(splashSystem);

  let showerActive = false;
  let showerTime = 0;
  const GRAVITY_FT = GRAVITY * 0.04;

  group.userData.waterSystem = {
    active: false,
    toggle(forceState = null) {
      showerActive = forceState !== null ? forceState : !showerActive;
      this.active = showerActive;
      pSystem.visible = showerActive;
      splashSystem.visible = showerActive;
      if (showerActive) {
        sMat.opacity = 0.72;
      } else {
        showerTime = 0;
      }
    },
    update(dt, camera) {
      if (!showerActive) return;

      if (camera) {
        const groupPos = new THREE.Vector3();
        group.getWorldPosition(groupPos);
        if (camera.position.distanceTo(groupPos) > 28.0) {
          this.toggle(false);
          return;
        }
      }

      showerTime += dt;
      const pos = pGeo.attributes.position.array;

      for (let i = 0; i < pCount; i++) {
        pVelY[i] -= GRAVITY_FT * dt;
        pos[i * 3]     += pVelX[i];
        pos[i * 3 + 1] += pVelY[i];
        pos[i * 3 + 2] += pVelZ[i];
        pLife[i] += dt;

        if (pos[i * 3 + 1] <= SHOWER_FLOOR) {
          resetDroplet(i);
        }
      }
      pGeo.attributes.position.needsUpdate = true;
      pMat.uniforms.uTime.value = showerTime;

      const sPositions = sGeo.attributes.position.array;
      for (let i = 0; i < sCount; i++) {
        sLife[i] += dt * 1.5;
        if (sLife[i] > 1.0) {
          sLife[i] = 0;
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.3;
          sPositions[i * 3]     = Math.cos(angle) * r;
          sPositions[i * 3 + 1] = SHOWER_FLOOR;
          sPositions[i * 3 + 2] = headZ + Math.sin(angle) * r;
          sVel[i] = {
            x: (Math.random() - 0.5) * 0.15,
            y: Math.random() * 0.2 + 0.04,
            z: (Math.random() - 0.5) * 0.15
          };
        }
        const lt = sLife[i];
        sPositions[i * 3]     += sVel[i].x * dt;
        sPositions[i * 3 + 1] += (sVel[i].y - GRAVITY_FT * lt * 2.0) * dt;
        sPositions[i * 3 + 2] += sVel[i].z * dt;
      }
      sGeo.attributes.position.needsUpdate = true;
      sMat.opacity = 0.60 + 0.12 * Math.sin(showerTime * 4.2);
    }
  };

  const assetName = getMappedAsset(fixture) || '8648.obj';
  const loader = new OBJLoader();
  let loaded = false;

  loader.load(`/static/assets/${assetName}`, (base) => {
    loaded = true;
    const baseMat = material(0x222222, { roughness: 0.95 });
    base.rotation.x = -Math.PI / 2;
    base.updateMatrixWorld(true);

    base.traverse((child) => {
      if (child.isMesh) {
        child.material = baseMat;
        child.geometry.computeVertexNormals();
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.fixtureGroup = group;
        state.meshes.push(child);
      }
    });

    let box = new THREE.Box3().setFromObject(base);
    let size = box.getSize(new THREE.Vector3());

    base.scale.set(width / Math.max(size.x, 0.01), 0.12 / Math.max(size.y, 0.01), depth / Math.max(size.z, 0.01));
    base.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(base);
    const center = box.getCenter(new THREE.Vector3());
    base.position.x = -center.x;
    base.position.y = -box.min.y;
    base.position.z = -center.z;
    group.add(base);

    addPart(group, new THREE.PlaneGeometry(0.35, 0.35).rotateX(-Math.PI / 2), darkMetal, 0, 0.105, 0);
  }, undefined, () => {
    if (!loaded) {
      addPart(group, new THREE.BoxGeometry(width, 0.1, depth), material(0x222222, { roughness: 0.95 }), 0, 0.05, 0);
      addPart(group, new THREE.PlaneGeometry(0.35, 0.35).rotateX(-Math.PI / 2), darkMetal, 0, 0.105, 0);
    }
  });

  return 7.2;
}

// ─── Primary Fixture Adder ─────────────────────────────────────────────
function addFixture(fixture, room) {
  const width = Math.max(Number(fixture.footprint_width_ft), 0.5);
  const depth = Math.max(Number(fixture.footprint_depth_ft), 0.5);
  const height = Math.max(Number(fixture.dimensions?.height || Number(fixture.height_in) * (1 / 12)), 0.1);

  // Directly place fixture along the resolved room coordinate grid without cluster collisions
  const x = -room.length_ft / 2 + Number(fixture.x_ft) + width / 2;
  const z = -room.width_ft / 2 + Number(fixture.y_ft) + depth / 2;

  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const rot = Number(fixture.z_rotation || 0);
  group.rotation.y = rot;

  group.userData.fixture = fixture;
  group.userData.targetScale = 1;

  let labelHeight = 3.0;

  if (fixture.category === 'Toilet') {
    labelHeight = buildAssetToilet(group, width, depth, height, fixture);
  } else if (fixture.category === 'Bathtub') {
    labelHeight = buildAssetBathtub(group, width, depth, height, fixture);
  } else if (fixture.category === 'Vanity') {
    labelHeight = buildAssetVanity(group, width, depth, height, fixture);
  } else if (fixture.category === 'Shower') {
    labelHeight = buildAssetShower(group, width, depth, height, fixture);
  } else if (fixture.category === 'Mirror') {
    const mH = 2.2;
    const mW = width * 0.95;
    labelHeight = 6.2;

    addPart(group, new THREE.BoxGeometry(mW, mH, 0.06), new THREE.MeshPhysicalMaterial({ 
      color: 0x91adb0, metalness: 0.9, roughness: 0.0, clearcoat: 1 
    }), 0, 4.8, -depth / 2 + 0.04);

    addPart(group, new THREE.BoxGeometry(mW + 0.06, mH + 0.06, 0.02), material(0xffffff, { 
      emissive: 0xffeacc, emissiveIntensity: 1.5 
    }), 0, 4.8, -depth / 2 + 0.02);

  } else if (fixture.category === 'Sensor') {
    const led = material(0xffffff, { emissive: 0x66bbff, emissiveIntensity: 2.2 });
    labelHeight = 0.8;
    addPart(group, new THREE.CylinderGeometry(0.25, 0.25, 0.05, 32), material(0x222222, { roughness: 0.7 }), 0, 0.025, 0);
    addPart(group, new THREE.RingGeometry(0.16, 0.22, 32).rotateX(-Math.PI / 2), led, 0, 0.052, 0);
  }

  const label = labelSprite(`${fixture.category} · ${fixture.product_id}`);
  label.position.y = labelHeight;
  label.rotation.y = -rot;
  group.add(label);

  state.roomGroup.add(group);
  state.fixtureGroups.push(group);
}

// ─── Design Languages Customizer ───────────────────────────────────────
const DESIGN_THEMES = {
  'Minimalist Modern': {
    floorColor: 0x5a544b, floorRoughness: 0.25, wallColor: 0x24221f, groutColor: 0x827768,
    ambientColor: 0xfff3e0, ambientIntensity: 2.2, keyColor: 0xffedc4, keyIntensity: 3.2,
    pointColor: 0xffb87a, pointIntensity: 2.2
  },
  'Japanese Zen': {
    floorColor: 0x3d352e, floorRoughness: 0.65, wallColor: 0x2c2621, groutColor: 0x221c17,
    ambientColor: 0xffeacc, ambientIntensity: 1.8, keyColor: 0xffdfa8, keyIntensity: 2.4,
    pointColor: 0xff9944, pointIntensity: 2.5
  },
  'Classic Luxury': {
    floorColor: 0xe8e8e5, floorRoughness: 0.12, wallColor: 0x1c1d1f, groutColor: 0xd4af37,
    ambientColor: 0xffffff, ambientIntensity: 2.5, keyColor: 0xfff8ee, keyIntensity: 3.8,
    pointColor: 0xffd199, pointIntensity: 3.0
  },
  'Industrial Loft': {
    floorColor: 0x38393b, floorRoughness: 0.50, wallColor: 0x1f1f20, groutColor: 0x151515,
    ambientColor: 0xcedae0, ambientIntensity: 2.0, keyColor: 0xffe8d6, keyIntensity: 3.0,
    pointColor: 0xff944d, pointIntensity: 2.8
  },
  'Scandinavian Spa': {
    floorColor: 0xc8c2b7, floorRoughness: 0.35, wallColor: 0x3d3a36, groutColor: 0xded9cf,
    ambientColor: 0xffffff, ambientIntensity: 2.6, keyColor: 0xfffcf5, keyIntensity: 3.2,
    pointColor: 0xffe0b2, pointIntensity: 1.8
  },
  'Biophilic Sanctuary': {
    floorColor: 0x4a4338, floorRoughness: 0.45, wallColor: 0x1e241e, groutColor: 0x332c22,
    ambientColor: 0xebf5df, ambientIntensity: 2.3, keyColor: 0xfff4d4, keyIntensity: 2.9,
    pointColor: 0xffc478, pointIntensity: 2.4
  },
  'Art Deco Elegance': {
    floorColor: 0x181819, floorRoughness: 0.15, wallColor: 0x121417, groutColor: 0xc5a059,
    ambientColor: 0xf5eedc, ambientIntensity: 2.4, keyColor: 0xffecc2, keyIntensity: 3.6,
    pointColor: 0xffc766, pointIntensity: 3.2
  },
  'Mediterranean Coastal': {
    floorColor: 0xb57a55, floorRoughness: 0.55, wallColor: 0x302924, groutColor: 0x8a5434,
    ambientColor: 0xf0faff, ambientIntensity: 2.8, keyColor: 0xffeed9, keyIntensity: 3.5,
    pointColor: 0xffb87a, pointIntensity: 2.0
  },
  'Urban Brutalist': {
    floorColor: 0x2e3033, floorRoughness: 0.60, wallColor: 0x191a1c, groutColor: 0x121314,
    ambientColor: 0xdde3e8, ambientIntensity: 1.9, keyColor: 0xf0f4f7, keyIntensity: 3.2,
    pointColor: 0xffffff, pointIntensity: 1.5
  },
  'Transitional Warmth': {
    floorColor: 0x6e6255, floorRoughness: 0.30, wallColor: 0x2d2925, groutColor: 0x8a7f72,
    ambientColor: 0xfff0dd, ambientIntensity: 2.4, keyColor: 0xffebd1, keyIntensity: 3.2,
    pointColor: 0xffad5c, pointIntensity: 2.6
  }
};

function applyAestheticTheme(themeName) {
  const t = DESIGN_THEMES[themeName] || DESIGN_THEMES['Minimalist Modern'];
  
  if (state.roomMeshes.floor) {
    state.roomMeshes.floor.material.color.setHex(t.floorColor);
    state.roomMeshes.floor.material.roughness = t.floorRoughness;
  }
  if (state.roomMeshes.backWall) state.roomMeshes.backWall.material.color.setHex(t.wallColor);
  if (state.roomMeshes.leftWall) state.roomMeshes.leftWall.material.color.setHex(t.wallColor);

  if (state.roomMeshes.seams) {
    state.roomMeshes.seams.forEach(s => s.material.color.setHex(t.groutColor));
  }

  if (state.lights.hemi) {
    state.lights.hemi.color.setHex(t.ambientColor);
    state.lights.hemi.intensity = t.ambientIntensity;
  }
  if (state.lights.key) {
    state.lights.key.color.setHex(t.keyColor);
    state.lights.key.intensity = t.keyIntensity;
  }
  if (state.lights.warm) {
    state.lights.warm.color.setHex(t.pointColor);
    state.lights.warm.intensity = t.pointIntensity;
  }
}

// ─── Scene & Engine Setup ──────────────────────────────────────────────
function buildScene(layout) {
  if (!state.renderer) initScene();
  clearViewport();
  const room = layout.room;
  
  const floorMat = new THREE.MeshPhysicalMaterial({ color: 0x5d554b, roughness: 0.22, metalness: 0.08, clearcoat: 0.8 });
  const wallMat = material(0x25231f, { roughness: 0.9 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(room.length_ft, 0.12, room.width_ft), floorMat); 
  floor.position.y = -0.06; 
  floor.receiveShadow = true; 
  state.roomGroup.add(floor);
  state.roomMeshes.floor = floor;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(room.length_ft, 7.5, 0.08), wallMat); 
  backWall.position.set(0, 3.75, -room.width_ft / 2); 
  state.roomGroup.add(backWall);
  state.roomMeshes.backWall = backWall;

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 7.5, room.width_ft), wallMat); 
  leftWall.position.set(-room.length_ft / 2, 3.75, 0); 
  state.roomGroup.add(leftWall);
  state.roomMeshes.leftWall = leftWall;

  state.roomMeshes.seams = [];
  const groutMat = material(0x877765, { roughness: 0.95 });
  for (let x = -room.length_ft / 2 + 1; x < room.length_ft / 2; x += 1) { 
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, room.width_ft), groutMat); 
    seam.position.set(x, 0.01, 0); 
    state.roomGroup.add(seam); 
    state.roomMeshes.seams.push(seam);
  }
  for (let z = -room.width_ft / 2 + 1; z < room.width_ft / 2; z += 1) { 
    const seam = new THREE.Mesh(new THREE.BoxGeometry(room.length_ft, 0.014, 0.012), groutMat); 
    seam.position.set(0, 0.012, z); 
    state.roomGroup.add(seam); 
    state.roomMeshes.seams.push(seam);
  }

  layout.fixtures.forEach((fixture) => addFixture(fixture, room));

  if ($('scene-theme'))$('scene-theme').textContent = room.theme.toUpperCase(); 
  if ($('scene-room'))$('scene-room').textContent = `${number(room.length_ft)} × ${number(room.width_ft)} FT`;
  if ($('viewport-empty'))$('viewport-empty').classList.add('hidden');
  
  applyAestheticTheme(room.theme);

  state.controls.target.set(0, 1.2, 0); 
  state.controls.update();
}

function initScene() {
  state.scene = new THREE.Scene(); 
  state.scene.background = new THREE.Color(0x080807); 
  state.scene.fog = new THREE.Fog(0x080807, 16, 32);

  state.camera = new THREE.PerspectiveCamera(42, viewport.clientWidth / viewport.clientHeight, 0.1, 100); 
  state.camera.position.set(11, 8, 12);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
  state.renderer.setSize(viewport.clientWidth, viewport.clientHeight); 
  state.renderer.shadowMap.enabled = true; 
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping; 
  state.renderer.toneMappingExposure = 1.05; 
  viewport.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement); 
  state.controls.enableDamping = true; 
  state.controls.dampingFactor = 0.08; 
  state.controls.minDistance = 4; 
  state.controls.maxDistance = 25; 
  state.controls.maxPolarAngle = Math.PI / 2.03; 
  state.controls.target.set(0, 1.2, 0);

  const hemi = new THREE.HemisphereLight(0xfff1d9, 0x31281f, 2.2);
  state.scene.add(hemi);
  state.lights.hemi = hemi;

  const key = new THREE.DirectionalLight(0xffedc4, 3.2); 
  key.position.set(4, 10, 5); 
  key.castShadow = true; 
  key.shadow.mapSize.width = 2048; 
  key.shadow.mapSize.height = 2048; 
  key.shadow.bias = -0.0001; 
  state.scene.add(key); 
  state.lights.key = key;

  const warm = new THREE.PointLight(0xffb36c, 2.2, 15, 2); 
  warm.position.set(0, 4.8, -3); 
  state.scene.add(warm);
  state.lights.warm = warm;

  state.raycaster = new THREE.Raycaster();

  state.renderer.domElement.addEventListener('pointerdown', onSceneClick);
  window.addEventListener('resize', () => { 
    if (!state.renderer) return; 
    state.camera.aspect = viewport.clientWidth / viewport.clientHeight; 
    state.camera.updateProjectionMatrix(); 
    state.renderer.setSize(viewport.clientWidth, viewport.clientHeight); 
  });

  const clock = new THREE.Clock();
  const animate = () => {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    state.waterTimeUniforms.forEach(u => {
      u.value = elapsedTime;
    });

    state.controls.update();

    state.fixtureGroups.forEach((group) => {
      const target = group.userData.targetScale || 1;
      group.scale.lerp(new THREE.Vector3(target, target, target), 0.14);
      if (group.userData.waterSystem) {
        group.userData.waterSystem.update(dt, state.camera);
      }
    });
    state.renderer.render(state.scene, state.camera);
  };
  animate();
  initPrelimPanelControls();
}

// ─── Preliminary Information Display Panel ─────────────────────────────
function updatePrelimPanel(layout) {
  if (!layout || !layout.room) return;
  const room = layout.room;
  const totalCost = layout.total_cost || 0;
  const budget = layout.total_budget || Number($('budget')?.value || 8000);
  const variance = budget - totalCost;
  const roomArea = room.length_ft * room.width_ft;
  const allocatedSqft = layout.space_allocated_sqft || 0;
  const openWalkwayRatio = Math.max(0, Math.min(100, Math.round((1 - allocatedSqft / roomArea) * 100)));

  if ($('prelim-dims'))$('prelim-dims').textContent = `${number(room.length_ft)} × ${number(room.width_ft)} FT`;
  if ($('prelim-area'))$('prelim-area').textContent = `${number(roomArea)} sq ft gross`;
  if ($('prelim-circulation'))$('prelim-circulation').textContent = `${openWalkwayRatio}% Walkway`;
  if ($('prelim-clearance')) {$('prelim-clearance').textContent = openWalkwayRatio >= 50 ? '✓ NKBA Standards Met' : '⚠ Tight Circulation';
    $('prelim-clearance').className = openWalkwayRatio >= 50 ? 'prelim-sub text-emerald-400' : 'prelim-sub text-amber-400';
  }

  if ($('prelim-budget-var')) {$('prelim-budget-var').textContent = `${variance >= 0 ? '+' : '-'}${money(Math.abs(variance))}`;
    $('prelim-budget-var').className = `prelim-val ${variance >= 0 ? 'text-brass' : 'text-red-400'}`;
  }
  if ($('prelim-budget-status')) {$('prelim-budget-status').textContent = variance >= 0 ? 'Under Budget Margin' : 'Over Budget Variance';
  }

  if ($('prelim-water-rate')) {$('prelim-water-rate').textContent = `${number(layout.water_demand_gpm, 1)} GPM`;
  }

  if ($('prelim-fixture-count')) {$('prelim-fixture-count').textContent = `${layout.fixtures.length} fixture${layout.fixtures.length === 1 ? '' : 's'}`;
  }

  const listEl = $('prelim-fixtures-list');
  if (listEl) {
    if (layout.fixtures.length === 0) {
      listEl.innerHTML = '<div class="text-[11px] text-muted italic">No fixtures placed.</div>';
    } else {
      listEl.innerHTML = layout.fixtures.map(f => `
        <div class="flex items-center justify-between py-1 border-b border-[#1f1d19]">
          <div class="truncate mr-2">
            <span class="font-medium text-ivory">${f.model_name}</span>
            <span class="text-[9px] text-muted block">${f.category} · ${number(f.length_in)}"L × ${number(f.width_in)}"W</span>
          </div>
          <div class="text-right whitespace-nowrap">
            <span class="text-brass font-medium">${money(f.base_price_usd)}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

let prelimControlsBound = false;
function initPrelimPanelControls() {
  if (prelimControlsBound) return;
  prelimControlsBound = true;

  const btnToggle = $('btn-toggle-prelim');
  const panel = $('prelim-panel');
  const btnClose = $('prelim-close');

  if (btnToggle && panel) {
    btnToggle.addEventListener('click', () => {
      panel.classList.toggle('hidden');
    });
  }
  if (btnClose && panel) {
    btnClose.addEventListener('click', () => {
      panel.classList.add('hidden');
    });
  }

  const btnWater = $('btn-prelim-toggle-water');
  if (btnWater) {
    btnWater.addEventListener('click', () => {
      let anyActive = false;
      state.fixtureGroups.forEach(g => {
        if (g.userData.waterSystem && g.userData.waterSystem.active) anyActive = true;
      });
      const newState = !anyActive;
      state.fixtureGroups.forEach(g => {
        if (g.userData.waterSystem) g.userData.waterSystem.toggle(newState);
      });
      btnWater.innerHTML = newState ? '<span>🛑</span> Stop Water' : '<span>💧</span> Run Water Simulation';
    });
  }

  const btnResetCam = $('btn-prelim-reset-cam');
  if (btnResetCam) {
    btnResetCam.addEventListener('click', () => {
      if (state.camera && state.controls) {
        state.camera.position.set(11, 8, 12);
        state.controls.target.set(0, 1.2, 0);
        state.controls.update();
      }
    });
  }
}

function onSceneClick(event) {
  if (!state.renderer || !state.camera) return;
  const rect = state.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);

  const intersects = state.raycaster.intersectObjects(state.meshes, false);
  if (intersects.length === 0) return;

  const hitMesh = intersects[0].object;
  const group = hitMesh.userData?.fixtureGroup;
  if (!group) return;

  if (hitMesh.userData?.isFaucet) {
    if (group.userData.waterSystem) {
      group.userData.waterSystem.toggle();
      return;
    }
  }

  if (state.activeGroup && state.activeGroup !== group) {
    state.activeGroup.userData.targetScale = 1;
  }
  state.activeGroup = group;
  group.userData.targetScale = group.userData.targetScale === 1.08 ? 1 : 1.08;
  showHud(group.userData.fixture);
}

if ($('hud-close')) {
  $('hud-close').addEventListener('click', () => {$('hud').classList.add('hidden'); 
    if (state.activeGroup) state.activeGroup.userData.targetScale = 1; 
  });
}

function renderLayout(layout) {
  state.layout = layout; 
  if ($('metric-cost'))$('metric-cost').textContent = money(layout.total_cost); 
  if ($('metric-space'))$('metric-space').innerHTML = `${number(layout.space_allocated_sqft)} <small>SQ FT</small>`; 
  if ($('metric-water'))$('metric-water').innerHTML = `${number(layout.water_demand_gpm, 2)} <small>GPM</small>`; 

  if ($('space-limit'))$('space-limit').textContent = `${number(layout.space_limit_sqft)} sq ft`; 
  if ($('space-progress'))$('space-progress').style.width = `${Math.min(100, layout.space_allocated_sqft / layout.space_limit_sqft * 100)}%`; 
  if ($('fixture-count'))$('fixture-count').textContent = `${layout.fixtures.length} fixture${layout.fixtures.length === 1 ? '' : 's'}`; 
  if ($('bom-summary'))$('bom-summary').textContent = `${layout.fixtures.length} products · ${money(layout.total_cost)} total`; 
  if ($('bom-body')) {$('bom-body').innerHTML = layout.fixtures.length ? layout.fixtures.map((fixture) => 
      `<tr><td class="fixture-name">${fixture.model_name}<div class="mt-1 text-[10px] uppercase tracking-[.12em] text-muted">${fixture.product_id}</div></td><td><span class="category-pill">${fixture.category}</span></td><td>${number(fixture.length_in)} × ${number(fixture.width_in)} × ${number(fixture.height_in)} in</td><td>${fixture.material_name}</td><td class="price text-right">${money(fixture.base_price_usd)}</td></tr>`
    ).join('') : '<tr><td colspan="5" class="empty-row">No feasible layout found for these constraints.</td></tr>';
  }

  updatePrelimPanel(layout);
  buildScene(layout);
}

// ─── 10 Finishes & Construction Specs HUD ──────────────────────────────
const FINISH_PRESETS = [
  { name: 'White Porcelain', hex: 0xfcfcfc, r: 0.10, m: 0.02, bg: '#fcfcfc' },
  { name: 'Matte Black', hex: 0x1a1a1a, r: 0.45, m: 0.85, bg: '#1a1a1a' },
  { name: 'Polished Chrome', hex: 0xdfdfdf, r: 0.05, m: 0.98, bg: '#dfdfdf' },
  { name: 'Brushed Moderne Brass', hex: 0xc5a059, r: 0.28, m: 0.88, bg: '#c5a059' },
  { name: 'Brushed Nickel', hex: 0xb5afa6, r: 0.32, m: 0.82, bg: '#b5afa6' },
  { name: 'Rose Gold', hex: 0xc88a7c, r: 0.26, m: 0.85, bg: '#c88a7c' },
  { name: 'Gunmetal Steel', hex: 0x3a3d40, r: 0.30, m: 0.90, bg: '#3a3d40' },
  { name: 'Oil-Rubbed Bronze', hex: 0x3b2f2f, r: 0.40, m: 0.70, bg: '#3b2f2f' },
  { name: 'Carrara White Marble', hex: 0xf0f2f2, r: 0.18, m: 0.08, bg: '#f0f2f2' },
  { name: 'Matte Sage Glaze', hex: 0x7a8b7b, r: 0.35, m: 0.04, bg: '#7a8b7b' }
];

function showHud(fixture) {
  const hud = $('hud');
  if (!hud) return;
  hud.classList.remove('hidden');
  $('hud-title').textContent = fixture.model_name;
  $('hud-price').textContent = money(fixture.base_price_usd);$('hud-material').textContent = `${fixture.category} · ${fixture.product_id}`;

  const controls = $('hud-controls');
  const w = Number(fixture.width_in || 0).toFixed(1);
  const l = Number(fixture.length_in || 0).toFixed(1);
  const h = Number(fixture.height_in || 0).toFixed(1);
  const gpmVal = fixture.water_usage_gpm ? `${fixture.water_usage_gpm} GPM` : 'N/A';

  window.applyFinish = function(index) {
    const p = FINISH_PRESETS[index];
    const group = state.activeGroup;
    if (!group || !p) return;
    group.traverse((child) => {
      if (child.isMesh && child.material && child.userData.fixtureGroup === group) {
        if (!child.material.transparent) {
          child.material = new THREE.MeshStandardMaterial({
            color: p.hex,
            metalness: p.m,
            roughness: p.r
          });
        }
      }
    });
  };

  const hasWater = !!state.activeGroup?.userData?.waterSystem;

  controls.innerHTML = `
    <div class="flex flex-col gap-2 border-b border-[#2b2b2b] pb-3">
      <div class="flex justify-between items-center"><span class="text-xs text-[#888] uppercase tracking-wider">Dimensions</span><span class="text-sm font-semibold text-[#eee]">${l}" L × ${w}" W × ${h}" H</span></div>
      <div class="flex justify-between items-center"><span class="text-xs text-[#888] uppercase tracking-wider">Water Rate</span><span class="text-sm font-semibold text-[#88ccff]">${gpmVal}</span></div>
      <div class="flex justify-between items-center"><span class="text-xs text-[#888] uppercase tracking-wider">Base Price</span><span class="text-sm font-semibold text-[#d4af37]">${money(fixture.base_price_usd)}</span></div>
      <div class="flex justify-between items-center"><span class="text-xs text-[#888] uppercase tracking-wider">Clearance Floor Y</span><span class="text-sm font-semibold text-[#eee]">0.00 FT (Level Ground)</span></div>
    </div>
    
    <div class="flex flex-col gap-2 pt-2">
      <span class="text-xs text-[#aaa] uppercase tracking-wider">Select Material Finish</span>
      <div class="grid grid-cols-5 gap-2 pt-1">
        ${FINISH_PRESETS.map((p, i) => `
          <button onclick="window.applyFinish(${i})" class="w-8 h-8 rounded-full border-2 border-[#333] hover:border-[#d4af37] transition shadow-md" style="background-color: ${p.bg};" title="${p.name}"></button>
        `).join('')}
      </div>
      ${hasWater ? `
        <button onclick="state.activeGroup.userData.waterSystem.toggle()" class="mt-3 py-2 px-3 rounded bg-[#16212b] hover:bg-[#1f3040] text-xs font-semibold text-[#88ccff] border border-[#2b4156] transition flex items-center justify-center gap-1.5">
          <span>💧</span> Toggle Water Stream
        </button>
      ` : ''}
    </div>
  `;
}

// ─── Direct Layout Optimizer ───────────────────────────────────────────
async function optimize(event) {
  if (event) event.preventDefault(); 
  if (solveButton) {
    solveButton.disabled = true; 
    solveButton.innerHTML = '<span class="animate-pulse">◆</span> Resolving collection…';
  }
  try { 
    const response = await fetch('/api/optimize', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        length_ft: Number($('length')?.value || 10), 
        width_ft: Number($('width')?.value || 8), 
        budget: Number($('budget')?.value || 8000), 
        theme: $('theme')?.value || 'Minimalist Modern', 
        layout_style: $('layout_style')?.value || 'Zoned Wet/Dry' 
      }) 
    }); 
    const body = await response.json(); 
    if (!response.ok) throw new Error(body.detail || 'The optimizer returned an error.'); 
    renderLayout(body); 
  } catch (error) { 
    showError(error.message); 
  } finally { 
    if (solveButton) {
      solveButton.disabled = false; 
      solveButton.innerHTML = '<span>◆</span> Solve &amp; Generate Layout'; 
    }
  }
}

if (form) form.addEventListener('submit', optimize);

fetch('/api/optimize', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ length_ft: 10, width_ft: 8, budget: 8000, theme: 'Minimalist Modern', layout_style: 'Zoned Wet/Dry' }) 
}).then((res) => res.json()).then(renderLayout).catch(() => showError('Start the FastAPI server to resolve the room.'));