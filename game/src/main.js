// Hyrcanian Airmail: fly the mail along the Caspian coast.
// Screens: campaign map, flight, sortie complete with an upgrade draft, and the crash report.

import { Input } from './input.js';
import { makePlane, stepFlight } from './flight.js';
import { buildWorld, drawSky, drawGround, drawRunway, drawScenery, drawRingsAndDrops, groundHeight, project } from './world.js';
import { drawPlane, drawSack } from './plane.js';
import { drawHud } from './hud.js';
import { MISSIONS, UPGRADES, scoreSortie } from './missions.js';
import { Effects, drawRain } from './effects.js';
import { Sound } from './audio.js';
import { loadProgress, saveProgress } from './save.js';
import { readShotParams, stageShot, markShotReady } from './shots.js';

const W = 1280, H = 720;
const canvas = document.getElementById('game');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const game = {
  progress: loadProgress(),
  screen: 'map',
  selected: 0,
  mission: MISSIONS[0],
  missionIndex: 0,
  world: null,
  plane: makePlane({ engine: 0, tank: 0, wing: 0, hull: 0 }),
  state: freshState(),
  effects: new Effects(),
  sound: new Sound(),
  input: new Input(canvas),
  result: null,
  draft: [],
  crashTip: '',
  time: 0,
  buttons: [],
  startMission,
  finishSortie,
};

function freshState() {
  return {
    ringsDone: 0, dropsDone: 0, ringsTotal: 0, dropsTotal: 0,
    score: 0, time: 0, objectiveText: '', gustWarning: 0,
    touchdownVy: 0, sacks: [], gustTimer: 6, gustActive: 0, wasStalled: false, lowFuelWarned: false,
  };
}

function startMission(index) {
  game.missionIndex = index;
  game.mission = MISSIONS[index];
  game.world = buildWorld(game.mission);
  Object.assign(game.plane, makePlane(game.progress.upgrades));
  game.plane.fuel = game.mission.fuel;
  Object.assign(game.state, freshState());
  game.state.ringsTotal = game.mission.rings.length;
  game.state.dropsTotal = game.mission.drops.length;
  game.state.objectiveText = nextObjective();
  game.result = null;
  game.screen = 'flight';
  statusEl.textContent = `${game.mission.name}: ${game.mission.brief}`;
}

function nextObjective() {
  const s = game.state;
  const ring = game.world?.rings.find((r) => !r.passed && !r.missed);
  const drop = game.world?.drops.find((d) => !d.done);
  if (!game.plane.airborne && game.plane.z < 200) return 'Throttle up with W, lift off with Up';
  if (ring && (!drop || ring.z < drop.z)) return 'Thread the amber ring';
  if (drop) return 'Drop a mail sack on the red circle (Space)';
  return 'Land on the destination strip';
}

function finishSortie() {
  game.result = scoreSortie(game.mission, game.state, game.plane);
  const p = game.progress;
  const prev = p.stars[game.mission.id] ?? 0;
  p.stars[game.mission.id] = Math.max(prev, game.result.stars);
  p.credits += game.result.credits;
  if (game.result.stars > 0) p.unlocked = Math.max(p.unlocked, game.missionIndex + 2);
  const pool = UPGRADES.filter((u) => p.upgrades[u.id] < 3);
  game.draft = pool.slice(0, 3);
  saveProgress(p);
  game.sound.fanfare();
}

function crash(reason) {
  game.crashTip = reason;
  game.screen = 'crashed';
  game.sound.crash();
  game.effects.addShake(14);
}

function updateFlight(dt) {
  const plane = game.plane, s = game.state, mission = game.mission;
  const ctl = game.input.controls();
  if (ctl.pause) { game.screen = 'map'; return; }
  if (ctl.mute) game.effects.callout(W / 2, 130, game.sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON', '#c9d4de');
  s.time += dt;
  if (plane.fuel < 22 && !s.lowFuelWarned) {
    s.lowFuelWarned = true;
    game.effects.callout(W / 2, H * 0.36, 'LOW FUEL — THROTTLE BACK', '#ff8a75');
  }

  s.gustTimer -= dt;
  if (mission.gust > 0 && s.gustTimer <= 0) {
    s.gustWarning = 2.2;
    s.gustActive = 3.2;
    s.gustTimer = 9 + Math.random() * 7;
  }
  s.gustWarning = Math.max(0, s.gustWarning - dt);
  s.gustActive = Math.max(0, s.gustActive - dt);
  const gustX = s.gustActive > 0 ? mission.gust * Math.sin(s.time * 2.2) : 0;
  const turbulence = mission.time === 'storm' ? Math.sin(s.time * 5.1) * 2.4 : 0;

  const dest = game.world.destRunway;
  const onRunway = plane.z > dest.z0 && plane.z < dest.z1 && Math.abs(plane.x - dest.x) < 12;
  const prevVy = plane.vy;
  stepFlight(plane, ctl, {
    windX: mission.wind + gustX,
    liftY: turbulence,
    groundY: groundHeight(plane.x, plane.z),
    onRunway,
  }, dt);
  if (plane.stalled) { s.wasStalled = true; game.effects.addShake(0.7); }
  if (plane.landed) {
    s.touchdownVy = prevVy;
    game.effects.dust(W / 2, H * 0.66);
    game.sound.thud();
    finishSortie();
    game.screen = 'complete';
    return;
  }
  if (plane.crashed) {
    crash(s.wasStalled && plane.y < 30
      ? 'The wing stalled at low height. Keep the speed up and push the nose down to recover.'
      : plane.fuel <= 0
        ? 'The tanks ran dry. Throttle back in the cruise and watch the fuel gauge.'
        : 'The ground arrived faster than the strip. Line up early and touch down gently.');
    return;
  }

  for (const ring of game.world.rings) {
    if (ring.passed || ring.missed) continue;
    if (plane.z >= ring.z) {
      const dist = Math.hypot(plane.x - ring.x, plane.y - ring.y);
      if (dist <= ring.r) {
        ring.passed = true;
        s.ringsDone++;
        s.score += 150;
        game.sound.ring();
        game.effects.callout(W / 2, H * 0.4, '+150 RING');
        game.effects.sparks(W / 2, H * 0.42);
      } else {
        ring.missed = true;
        game.effects.callout(W / 2, H * 0.4, 'RING MISSED', '#c9d4de');
      }
    }
  }

  if (ctl.drop && plane.airborne) {
    s.sacks.push({ x: plane.x, y: plane.y - 2, z: plane.z, vy: plane.vy, vz: plane.speed * 0.4 });
    game.sound.drop();
  }
  for (const sack of s.sacks) {
    sack.vy -= 22 * dt;
    sack.y += sack.vy * dt;
    sack.z += sack.vz * dt;
    sack.vz *= (1 - dt * 0.7);
    if (sack.y <= groundHeight(sack.x, sack.z) + 0.5) {
      sack.dead = true;
      const target = game.world.drops.find((d) => !d.done && Math.hypot(sack.x - d.x, sack.z - d.z) < 30);
      if (target) {
        target.done = true;
        s.dropsDone++;
        s.score += 200;
        game.sound.delivered();
        game.effects.callout(W / 2, H * 0.44, '+200 MAIL DELIVERED');
      } else {
        game.effects.callout(W / 2, H * 0.44, 'SACK LOST IN THE FIELDS', '#c9d4de');
      }
    }
  }
  s.sacks = s.sacks.filter((sack) => !sack.dead);
  s.objectiveText = nextObjective();
  game.sound.update(plane);
}

function camera() {
  const p = game.plane;
  return { x: p.x * 0.55, y: p.y + 7, z: p.z - 17, heading: p.heading };
}

function renderFlight() {
  const cam = camera();
  const off = game.effects.offset(game.time);
  ctx.save();
  ctx.translate(off.x, off.y);
  drawSky(ctx, cam, game.mission, W, H, game.time);
  drawGround(ctx, cam, game.world, W, H);
  drawRunway(ctx, cam, game.world.runway, W, H, game.mission.time === 'night');
  drawRunway(ctx, cam, game.world.destRunway, W, H, true);
  drawScenery(ctx, cam, game.world, W, H, game.time);
  drawRingsAndDrops(ctx, cam, game.world, W, H, game.time);
  for (const sack of game.state.sacks) drawSack(ctx, sack, project, cam, W, H);
  drawPlane(ctx, game.plane, W, H, game.time);
  if (game.mission.time === 'storm') drawRain(ctx, W, H, game.time, 1, game.mission.wind);
  ctx.restore();
  game.effects.draw(ctx);
  drawHud(ctx, game.plane, game.mission, game.state, W, H, game.time);
}

function button(x, y, w, h, label, action, enabled = true) {
  game.buttons.push({ x, y, w, h, action, enabled });
  const hover = game.input.mouse.x >= x && game.input.mouse.x <= x + w && game.input.mouse.y >= y && game.input.mouse.y <= y + h;
  ctx.fillStyle = !enabled ? 'rgba(60,70,80,0.7)' : hover ? '#c96a3b' : '#a8502f';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 6);
}

function starsText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

function renderMap() {
  const cam = { x: 0, y: 90, z: 0, heading: 0 };
  drawSky(ctx, cam, MISSIONS[0], W, H, game.time);
  ctx.fillStyle = 'rgba(10,18,28,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HYRCANIAN AIRMAIL', 48, 70);
  ctx.fillStyle = '#dfe9f2';
  ctx.font = '16px sans-serif';
  ctx.fillText('Fly the mail along the Caspian coast. Arrows fly, W/S throttle, Space drops a sack.', 48, 100);
  ctx.fillText(`Credits: ${game.progress.credits}`, 48, 128);

  MISSIONS.forEach((m, i) => {
    const y = 160 + i * 74;
    const locked = i >= game.progress.unlocked;
    const selected = i === game.selected;
    ctx.fillStyle = selected ? 'rgba(201,106,59,0.85)' : 'rgba(20,34,50,0.8)';
    ctx.beginPath(); ctx.roundRect(48, y, 560, 62, 8); ctx.fill();
    ctx.fillStyle = locked ? '#8a97a5' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${i + 1}. ${m.name}`, 68, y + 27);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ffd873';
    ctx.fillText(locked ? 'LOCKED' : starsText(game.progress.stars[m.id] ?? 0), 68, y + 50);
    ctx.fillStyle = '#9fc3dd';
    ctx.fillText(m.time.toUpperCase(), 470, y + 50);
    game.buttons.push({ x: 48, y, w: 560, h: 62, enabled: !locked, action: () => { game.selected = i; game.sound.click(); } });
  });

  const m = MISSIONS[game.selected];
  ctx.fillStyle = 'rgba(20,34,50,0.88)';
  ctx.beginPath(); ctx.roundRect(648, 160, 584, 300, 10); ctx.fill();
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(m.name, 676, 198);
  ctx.fillStyle = '#dfe9f2';
  ctx.font = '16px sans-serif';
  wrapText(m.brief, 676, 230, 530, 22);
  ctx.font = '15px sans-serif';
  ctx.fillText(`Rings: ${m.rings.length}    Mail drops: ${m.drops.length}    Par: ${m.par}s`, 676, 330);
  ctx.fillText(`Wind: ${m.gust > 4 ? 'strong gusts' : m.wind > 0 ? 'sea breeze' : 'calm'}    Fuel: ${m.fuel}%`, 676, 356);
  button(676, 386, 220, 52, 'FLY SORTIE', () => startMission(game.selected));

  ctx.fillStyle = 'rgba(20,34,50,0.88)';
  ctx.beginPath(); ctx.roundRect(648, 480, 584, 190, 10); ctx.fill();
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('AIRCRAFT', 676, 510);
  ctx.font = '15px sans-serif';
  UPGRADES.forEach((u, i) => {
    const lvl = game.progress.upgrades[u.id];
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText(`${u.name}: ${'●'.repeat(lvl)}${'○'.repeat(3 - lvl)}`, 676, 542 + i * 30);
    ctx.fillStyle = '#9fc3dd';
    ctx.fillText(u.desc, 900, 542 + i * 30);
  });
}

function wrapText(text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > maxW) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  ctx.fillText(line, x, y);
}

function renderComplete() {
  renderFlightBackdrop();
  const r = game.result;
  ctx.fillStyle = 'rgba(10,18,28,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SORTIE COMPLETE', W / 2, 84);
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(starsText(r.stars), W / 2, 128);

  const stats = [
    ['Rings threaded', `${game.state.ringsDone}/${game.state.ringsTotal}`, r.ringPts],
    ['Mail delivered', `${game.state.dropsDone}/${game.state.dropsTotal}`, r.dropPts],
    ['Landing', `${Math.abs(game.state.touchdownVy).toFixed(1)} m/s touchdown`, r.landingPts],
    ['Time', `${Math.round(game.state.time)}s (par ${game.mission.par}s)`, r.timePts],
    ['Damage', `${Math.round(game.plane.damage)}%`, r.damagePts],
  ];
  ctx.font = '17px sans-serif';
  stats.forEach(([label, value, pts], i) => {
    const y = 176 + i * 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText(label, W / 2 - 300, y);
    ctx.fillText(value, W / 2 - 60, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd873';
    ctx.fillText(String(pts), W / 2 + 300, y);
  });
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`TOTAL ${r.total}   ·   +${r.credits} credits`, W / 2, 372);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#ffd873';
  ctx.fillText('CHOOSE ONE UPGRADE', W / 2, 424);
  game.draft.forEach((u, i) => {
    const x = W / 2 - 330 + i * 226;
    button(x, 444, 206, 96, u.name, () => {
      game.progress.upgrades[u.id]++;
      saveProgress(game.progress);
      game.draft = [];
      game.sound.click();
    });
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText(u.desc, x + 103, 566);
    ctx.font = 'bold 17px sans-serif';
  });
  button(W / 2 - 110, 610, 220, 50, 'BACK TO MAP', () => { game.screen = 'map'; });
}

function renderCrashed() {
  renderFlightBackdrop();
  ctx.fillStyle = 'rgba(40,10,8,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff8a75';
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE MAIL DID NOT GET THROUGH', W / 2, 130);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  wrapText(game.crashTip, W / 2 - 320, 190, 640, 26);
  ctx.fillText(`Rings ${game.state.ringsDone}/${game.state.ringsTotal} · Mail ${game.state.dropsDone}/${game.state.dropsTotal} · ${Math.round(game.state.time)}s flown`, W / 2, 300);
  button(W / 2 - 240, 350, 220, 52, 'FLY AGAIN', () => startMission(game.missionIndex));
  button(W / 2 + 20, 350, 220, 52, 'BACK TO MAP', () => { game.screen = 'map'; });
}

function renderFlightBackdrop() {
  const cam = camera();
  drawSky(ctx, cam, game.mission, W, H, game.time);
  drawGround(ctx, cam, game.world, W, H);
  drawScenery(ctx, cam, game.world, W, H, game.time);
}

function handleButtons() {
  if (!game.input.mouse.clicked) return;
  for (const b of game.buttons) {
    if (!b.enabled) continue;
    const m = game.input.mouse;
    if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) { b.action(); break; }
  }
}

function render() {
  game.buttons = [];
  if (game.screen === 'map') renderMap();
  else if (game.screen === 'flight') renderFlight();
  else if (game.screen === 'complete') renderComplete();
  else if (game.screen === 'crashed') renderCrashed();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.time += dt;
  if (game.input.anyInput) game.sound.start();
  if (game.screen === 'flight') updateFlight(dt);
  if (game.screen === 'map' && game.input.hit('Enter')) startMission(game.selected);
  if (game.screen === 'map' && game.input.hit('ArrowDown')) game.selected = Math.min(MISSIONS.length - 1, game.selected + 1);
  if (game.screen === 'map' && game.input.hit('ArrowUp')) game.selected = Math.max(0, game.selected - 1);
  game.effects.update(dt);
  render();
  handleButtons();
  game.input.endFrame();
  requestAnimationFrame(frame);
}

const shotParams = readShotParams();
if (shotParams) {
  stageShot(game, shotParams.shot);
  render();
  markShotReady();
} else {
  requestAnimationFrame(frame);
}
