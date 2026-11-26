// The Hyrcanian coast: seeded terrain, scenery and the chase-view renderer.
// Sea to the west, rice terraces and tea slopes on the plain, Alborz foothills rising east.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Coastline wanders with distance; east of it the land rises toward the hills.
export function coastX(z) {
  return -120 + Math.sin(z * 0.0011) * 60 + Math.sin(z * 0.00037) * 90;
}

export function groundHeight(x, z) {
  const coast = coastX(z);
  if (x < coast) return -2; // Caspian shallows
  const east = clamp((x - 260) / 700, 0, 1);
  const hills = east * east * 130 + Math.sin(z * 0.002 + x * 0.004) * 6 * east;
  const terrace = Math.round(clamp((x - coast) / 90, 0, 4)) * 1.6;
  return hills + terrace;
}

const FIELD_COLORS = ['#7fae4c', '#93bd57', '#6d9c42', '#a8c46a', '#5d8f4e', '#b5a558', '#87b06b'];

// Builds the static scenery for one mission from its seed.
export function buildWorld(mission) {
  const rng = makeRng(mission.seed);
  const world = { mission, fields: [], trees: [], houses: [], clouds: [], boats: [], rings: [], drops: [] };
  const length = mission.length;
  for (let z = 0; z < length; z += 90) {
    const coast = coastX(z);
    for (let x = coast + 14; x < 560; x += 74) {
      world.fields.push({ x, z, w: 70, d: 86, color: FIELD_COLORS[Math.floor(rng() * FIELD_COLORS.length)], terrace: rng() < 0.3 });
    }
    if (rng() < 0.75) world.trees.push({ x: coast + 30 + rng() * 420, z: z + rng() * 80, s: 0.7 + rng() * 0.9 });
    if (rng() < 0.4) world.boats.push({ x: coast - 60 - rng() * 160, z: z + rng() * 90, hue: rng() });
    world.clouds.push({ x: -500 + rng() * 1100, y: 150 + rng() * 90, z: z + rng() * 300, s: 0.6 + rng() * 1.3 });
  }
  for (const v of mission.villages) {
    for (let i = 0; i < 7; i++) {
      world.houses.push({ x: v.x + (rng() - 0.5) * 60, z: v.z + (rng() - 0.5) * 70, s: 0.8 + rng() * 0.7, roof: rng() });
    }
  }
  world.rings = mission.rings.map((r, i) => ({ ...r, id: i, passed: false, missed: false }));
  world.drops = mission.drops.map((d, i) => ({ ...d, id: i, done: false, sack: null }));
  world.runway = { x: 0, z0: -40, z1: 190 };
  world.destRunway = { x: mission.destX ?? 0, z0: length - 240, z1: length - 10 };
  return world;
}

// Projects a world point into screen space for the chase camera.
export function project(cam, x, y, z, w, h) {
  const dz = z - cam.z;
  if (dz < 2) return null;
  const scale = 620 / dz;
  return {
    x: w / 2 + (x - cam.x) * scale,
    y: h * 0.46 - (y - cam.y) * scale,
    scale,
    dz,
  };
}

function skyColors(time) {
  if (time === 'dusk') return ['#2c3e63', '#7a5a7e', '#e08a5a'];
  if (time === 'night') return ['#0a1226', '#16244a', '#2c3e63'];
  if (time === 'storm') return ['#3d4a55', '#5c6d76', '#8b9aa0'];
  return ['#5ea9dd', '#8fc7ea', '#cfe9f7'];
}

export function drawSky(ctx, cam, mission, w, h, t) {
  const [top, mid, low] = skyColors(mission.time);
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, low);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun or moon, fixed bearing so turns swing it across the sky.
  const bearing = ((mission.sunBearing - cam.heading + 540) % 360) - 180;
  const sx = w / 2 + (bearing / 60) * w * 0.5;
  const sy = mission.time === 'night' ? h * 0.16 : h * 0.2;
  if (sx > -80 && sx < w + 80) {
    ctx.beginPath();
    ctx.arc(sx, sy, mission.time === 'night' ? 22 : 30, 0, Math.PI * 2);
    ctx.fillStyle = mission.time === 'night' ? '#e8ecf4' : '#fff3c4';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, mission.time === 'night' ? 34 : 52, 0, Math.PI * 2);
    ctx.fillStyle = mission.time === 'night' ? 'rgba(200,212,240,0.16)' : 'rgba(255,240,180,0.2)';
    ctx.fill();
  }
  // Alborz ridge silhouette on the eastern horizon.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.46);
  for (let i = 0; i <= 24; i++) {
    const px = (i / 24) * w;
    const lift = Math.sin(i * 1.7 + cam.z * 0.0004) * 14 + Math.sin(i * 0.6) * 22;
    ctx.lineTo(px, h * 0.46 - 26 - lift);
  }
  ctx.lineTo(w, h * 0.46);
  ctx.closePath();
  ctx.fillStyle = mission.time === 'night' ? '#1b2a4a' : '#5d7d94';
  ctx.fill();
  void t;
}

export function drawGround(ctx, cam, world, w, h) {
  const step = 46;
  const zStart = Math.floor(cam.z / step) * step;
  // Horizon band so the far strips meet the sky with no gap.
  const horizonY = h * 0.46;
  const farCoast = project(cam, coastX(cam.z + 1800), 0, cam.z + 1800, w, h);
  const farTop = project(cam, cam.x, 0, cam.z + step * 40, w, h);
  const bandH = farTop ? Math.max(10, farTop.y - horizonY + 4) : 10;
  ctx.fillStyle = world.mission.time === 'night' ? '#12304d' : '#2e7fa8';
  ctx.fillRect(0, horizonY - 2, farCoast ? farCoast.x : w / 2, bandH);
  ctx.fillStyle = world.mission.time === 'night' ? '#274d2e' : '#79a84f';
  ctx.fillRect(farCoast ? farCoast.x : w / 2, horizonY - 2, w, bandH);
  for (let z = zStart + step * 40; z > zStart; z -= step) {
    const near = project(cam, cam.x, 0, z, w, h);
    const far = project(cam, cam.x, 0, z + step, w, h);
    if (!near || !far) continue;
    const coast = coastX(z);
    // Sea band west of the coast, land east of it.
    const coastNear = project(cam, coast, 0, z, w, h);
    const coastFar = project(cam, coast, 0, z + step, w, h);
    ctx.fillStyle = world.mission.time === 'night' ? '#12304d' : '#2e7fa8';
    ctx.beginPath();
    ctx.moveTo(0, far.y); ctx.lineTo(coastFar.x, far.y); ctx.lineTo(coastNear.x, near.y); ctx.lineTo(0, near.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = world.mission.time === 'night' ? '#274d2e' : '#79a84f';
    ctx.beginPath();
    ctx.moveTo(coastFar.x, far.y); ctx.lineTo(w, far.y); ctx.lineTo(w, near.y); ctx.lineTo(coastNear.x, near.y);
    ctx.closePath(); ctx.fill();
  }
  // Field patches and terraces.
  for (const f of world.fields) {
    const a = project(cam, f.x, groundHeight(f.x, f.z), f.z, w, h);
    const b = project(cam, f.x + f.w, groundHeight(f.x + f.w, f.z), f.z, w, h);
    const c = project(cam, f.x + f.w, groundHeight(f.x + f.w, f.z + f.d), f.z + f.d, w, h);
    const d = project(cam, f.x, groundHeight(f.x, f.z + f.d), f.z + f.d, w, h);
    if (!a || !b || !c || !d || a.dz > 1500) continue;
    ctx.fillStyle = world.mission.time === 'night' ? shade(f.color, 0.45) : f.color;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    if (f.terrace) {
      ctx.strokeStyle = 'rgba(40,70,30,0.35)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function drawRunway(ctx, cam, runway, w, h, lit) {
  const a = project(cam, runway.x - 11, 0, runway.z0, w, h);
  const b = project(cam, runway.x + 11, 0, runway.z0, w, h);
  const c = project(cam, runway.x + 11, 0, runway.z1, w, h);
  const d = project(cam, runway.x - 11, 0, runway.z1, w, h);
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = '#4a4f55';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8e4d8';
  ctx.lineWidth = Math.max(1, a.scale * 0.4);
  ctx.beginPath();
  ctx.moveTo((a.x + b.x) / 2, a.y); ctx.lineTo((d.x + c.x) / 2, d.y);
  ctx.stroke();
  if (lit) {
    ctx.fillStyle = '#ffd873';
    for (let z = runway.z0; z <= runway.z1; z += 28) {
      for (const side of [-12, 12]) {
        const p = project(cam, runway.x + side, 0.4, z, w, h);
        if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, p.scale * 0.5), 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
}

export function drawScenery(ctx, cam, world, w, h, t) {
  const night = world.mission.time === 'night';
  for (const boat of world.boats) {
    const p = project(cam, boat.x, 0, boat.z, w, h);
    if (!p || p.dz > 1200) continue;
    const s = p.scale;
    ctx.fillStyle = night ? '#20344d' : '#31556e';
    ctx.fillRect(p.x - 3 * s, p.y - 0.6 * s, 6 * s, 1.1 * s);
    ctx.fillStyle = '#e9e2d0';
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 4.4 * s); ctx.lineTo(p.x, p.y - 0.6 * s); ctx.lineTo(p.x + 2.4 * s, p.y - 0.6 * s); ctx.closePath(); ctx.fill();
  }
  for (const tree of world.trees) {
    const gy = groundHeight(tree.x, tree.z);
    const p = project(cam, tree.x, gy, tree.z, w, h);
    if (!p || p.dz > 1100) continue;
    const s = p.scale * tree.s;
    ctx.fillStyle = night ? '#17351f' : '#2f6b33';
    ctx.beginPath(); ctx.arc(p.x, p.y - 3.4 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b4230';
    ctx.fillRect(p.x - 0.3 * s, p.y - 1.6 * s, 0.6 * s, 1.6 * s);
  }
  for (const house of world.houses) {
    const gy = groundHeight(house.x, house.z);
    const p = project(cam, house.x, gy, house.z, w, h);
    if (!p || p.dz > 1100) continue;
    const s = p.scale * house.s;
    ctx.fillStyle = night ? '#3d3a4a' : '#e6dcc4';
    ctx.fillRect(p.x - 2.2 * s, p.y - 2.4 * s, 4.4 * s, 2.4 * s);
    ctx.fillStyle = house.roof < 0.5 ? '#a8502f' : '#7c5a36';
    ctx.beginPath(); ctx.moveTo(p.x - 2.7 * s, p.y - 2.4 * s); ctx.lineTo(p.x, p.y - 4.2 * s); ctx.lineTo(p.x + 2.7 * s, p.y - 2.4 * s); ctx.closePath(); ctx.fill();
    if (night) { ctx.fillStyle = '#ffd873'; ctx.fillRect(p.x - 0.5 * s, p.y - 1.5 * s, s, s); }
  }
  for (const cloud of world.clouds) {
    const p = project(cam, cloud.x, cloud.y, cloud.z, w, h);
    if (!p || p.dz > 1600) continue;
    const s = p.scale * cloud.s;
    ctx.fillStyle = world.mission.time === 'storm' ? 'rgba(70,82,92,0.85)' : 'rgba(255,255,255,0.82)';
    for (const [ox, oy, r] of [[0, 0, 9], [-8, 1.5, 6.5], [8, 1.2, 7], [3, -2.4, 6]]) {
      ctx.beginPath(); ctx.arc(p.x + ox * s, p.y + oy * s, r * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  void t;
}

export function drawRingsAndDrops(ctx, cam, world, w, h, t) {
  for (const ring of world.rings) {
    const p = project(cam, ring.x, ring.y, ring.z, w, h);
    if (!p || p.dz > 1400) continue;
    const r = ring.r * p.scale;
    ctx.lineWidth = Math.max(2, p.scale * 0.9);
    ctx.strokeStyle = ring.passed ? '#57d977' : ring.missed ? '#8a8f96' : '#ffb340';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.92, 0, 0, Math.PI * 2); ctx.stroke();
    if (!ring.passed && !ring.missed) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(1, p.scale * 0.3);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 0.82, r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const drop of world.drops) {
    const gy = groundHeight(drop.x, drop.z);
    const p = project(cam, drop.x, gy, drop.z, w, h);
    if (!p || p.dz > 1400) continue;
    const r = 26 * p.scale;
    ctx.strokeStyle = drop.done ? '#57d977' : '#ff5f4d';
    ctx.lineWidth = Math.max(2, p.scale * 0.7);
    ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
    if (!drop.done) {
      const bob = Math.sin(t * 3 + drop.id) * 2;
      ctx.fillStyle = '#ff5f4d';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r * 0.5 - 8 + bob);
      ctx.lineTo(p.x - 6, p.y - r * 0.5 - 20 + bob);
      ctx.lineTo(p.x + 6, p.y - r * 0.5 - 20 + bob);
      ctx.closePath(); ctx.fill();
    }
  }
}
