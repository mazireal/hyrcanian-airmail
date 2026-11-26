// Deterministic screenshot staging. A ?shot=NAME&seed=N load puts the game
// into one frozen, seeded moment so screenshots are real renders of the game
// code, identical on every load. Cover first: the densest mid-flight moment.

export function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return null;
  return { shot, seed: Number(params.get('seed') ?? 1) };
}

export function stageShot(game, shot) {
  const { startMission, plane, state } = game;
  if (shot === 'map') {
    game.progress.unlocked = 4;
    game.progress.stars = { 'first-post': 3, 'tea-run': 2, lighthouse: 3 };
    game.progress.credits = 145;
    game.progress.upgrades = { engine: 1, tank: 1, wing: 0, hull: 1 };
    game.screen = 'map';
    game.selected = 2;
    return;
  }
  if (shot === 'complete') {
    startMission(1);
    state.ringsDone = 2; state.dropsDone = 3; state.time = 118; state.touchdownVy = -1.8;
    state.score = 1240;
    plane.landed = true; plane.airborne = false; plane.damage = 6;
    game.finishSortie();
    game.screen = 'complete';
    return;
  }
  if (shot === 'landing') {
    startMission(5);
    Object.assign(plane, {
      x: 4, y: 26, z: game.mission.length - 430, heading: 2, speed: 74,
      throttle: 0.32, pitch: -0.18, roll: 0.06, vy: -2.4, fuel: 41,
      airborne: true, engineOn: true,
    });
    state.ringsDone = 3; state.dropsDone = 1; state.score = 980; state.time = 141;
    state.objectiveText = 'Land on the lamp-lit strip';
    game.screen = 'flight';
    return;
  }
  // cover: mid-flight over the villages, ring dead ahead, gust warning lit.
  startMission(2);
  Object.assign(plane, {
    x: -148, y: 86, z: 1330, heading: 356, speed: 96,
    throttle: 0.78, pitch: 0.12, roll: -0.34, vy: 1.6, fuel: 68,
    airborne: true, engineOn: true, damage: 0,
  });
  state.ringsDone = 1; state.dropsDone = 0; state.score = 150; state.time = 52;
  state.gustWarning = 2;
  state.objectiveText = 'Thread the ring, then supply the village';
  game.world.rings[0].passed = true;
  game.screen = 'flight';
}

export function markShotReady() {
  window.__SHOT_READY = true;
  document.title = 'SHOT_READY';
}
