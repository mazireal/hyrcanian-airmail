// The Hyrcanian mail route: six sorties from the home strip at Bandar Post,
// each with rings to thread, villages to supply, and a landing to grease.

export const MISSIONS = [
  {
    id: 'first-post', name: 'First Post', seed: 101, length: 2600, time: 'day', sunBearing: 40,
    brief: 'Thread three rings over the rice terraces and land back at the home strip.',
    rings: [{ x: 0, y: 60, z: 700, r: 17 }, { x: -40, y: 78, z: 1300, r: 17 }, { x: 30, y: 64, z: 1900, r: 17 }],
    drops: [], villages: [{ x: -90, z: 1000 }],
    wind: 0, gust: 0, fuel: 100, par: 95,
  },
  {
    id: 'tea-run', name: 'Tea Garden Run', seed: 202, length: 3200, time: 'day', sunBearing: 70,
    brief: 'Drop mail sacks on three tea villages. Space releases a sack — lead the target.',
    rings: [{ x: 20, y: 70, z: 900, r: 16 }, { x: -30, y: 84, z: 2100, r: 16 }],
    drops: [{ x: -70, z: 1200 }, { x: 60, z: 1800 }, { x: -20, z: 2500 }],
    villages: [{ x: -70, z: 1200 }, { x: 60, z: 1800 }, { x: -20, z: 2500 }],
    wind: 1.2, gust: 0, fuel: 100, par: 130,
  },
  {
    id: 'lighthouse', name: 'Lighthouse Turn', seed: 303, length: 3600, time: 'dusk', sunBearing: 300,
    brief: 'Sea gusts shove the plane sideways. Thread four rings past the lighthouse.',
    rings: [{ x: -120, y: 66, z: 800, r: 16 }, { x: -160, y: 92, z: 1500, r: 15 }, { x: -60, y: 74, z: 2200, r: 15 }, { x: 10, y: 60, z: 2900, r: 16 }],
    drops: [{ x: -110, z: 1850 }],
    villages: [{ x: -110, z: 1850 }, { x: 80, z: 1200 }],
    wind: 2.6, gust: 5.5, fuel: 100, par: 150,
  },
  {
    id: 'terraces', name: 'Rice Terrace Slalom', seed: 404, length: 3800, time: 'day', sunBearing: 120,
    brief: 'Low rings between the terraces. Tight turns, no room for a lazy bank.',
    rings: [{ x: 60, y: 44, z: 700, r: 14 }, { x: -70, y: 40, z: 1300, r: 14 }, { x: 80, y: 48, z: 1900, r: 13 }, { x: -60, y: 42, z: 2500, r: 13 }, { x: 0, y: 52, z: 3100, r: 15 }],
    drops: [{ x: 40, z: 2200 }],
    villages: [{ x: 40, z: 2200 }, { x: -120, z: 900 }],
    wind: 1.6, gust: 2.5, fuel: 95, par: 160,
  },
  {
    id: 'storm', name: 'Storm Post', seed: 505, length: 4000, time: 'storm', sunBearing: 200,
    brief: 'A Caspian storm is rolling in. Four villages wait on their mail and the tanks are half full.',
    rings: [{ x: 0, y: 80, z: 1000, r: 16 }, { x: -50, y: 95, z: 2400, r: 15 }],
    drops: [{ x: -60, z: 1300 }, { x: 50, z: 1900 }, { x: -30, z: 2800 }, { x: 30, z: 3400 }],
    villages: [{ x: -60, z: 1300 }, { x: 50, z: 1900 }, { x: -30, z: 2800 }, { x: 30, z: 3400 }],
    wind: 4.2, gust: 9, fuel: 58, par: 190,
  },
  {
    id: 'night', name: 'Night Mail', seed: 606, length: 3800, time: 'night', sunBearing: 20,
    brief: 'Follow the lit rings down the coast and put her on the lamp-lit strip.',
    rings: [{ x: -40, y: 70, z: 800, r: 16 }, { x: 30, y: 86, z: 1600, r: 15 }, { x: -20, y: 64, z: 2400, r: 15 }, { x: 0, y: 54, z: 3100, r: 16 }],
    drops: [{ x: 0, z: 2000 }],
    villages: [{ x: 0, z: 2000 }, { x: -90, z: 1400 }],
    wind: 1.8, gust: 3, fuel: 100, par: 170,
  },
];

export const UPGRADES = [
  { id: 'engine', name: 'Bigger Engine', desc: '+9 knots top speed per level' },
  { id: 'tank', name: 'Long-Range Tank', desc: 'Burns less fuel per level' },
  { id: 'wing', name: 'Slotted Wing', desc: 'Stalls 4 knots slower per level' },
  { id: 'hull', name: 'Reinforced Hull', desc: 'Hard landings hurt less per level' },
];

export function freshProgress() {
  return {
    unlocked: 1,
    stars: {},
    credits: 0,
    upgrades: { engine: 0, tank: 0, wing: 0, hull: 0 },
  };
}

// Scores a finished sortie: objectives, landing smoothness, time, damage.
export function scoreSortie(mission, state, plane) {
  const ringPts = state.ringsDone * 150;
  const dropPts = state.dropsDone * 200;
  const landingPts = plane.landed
    ? Math.max(0, 240 - Math.round(Math.abs(state.touchdownVy) * 26)) + (Math.abs(state.touchdownVy) < 1.5 ? 40 : 0)
    : 0;
  const timePts = Math.max(0, Math.round((mission.par - state.time) * 2));
  const damagePts = -Math.round(plane.damage * 3);
  const total = Math.max(0, ringPts + dropPts + landingPts + timePts + damagePts);
  const maxPts = mission.rings.length * 150 + mission.drops.length * 200 + 240 + 120;
  const frac = total / maxPts;
  const stars = !plane.landed ? 0 : frac > 0.72 ? 3 : frac > 0.45 ? 2 : 1;
  return { ringPts, dropPts, landingPts, timePts, damagePts, total, stars, credits: Math.round(total / 12) };
}
