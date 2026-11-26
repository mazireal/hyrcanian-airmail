// Flight model: throttle, lift, stall, turns, wind and fuel.
// Units are game units: speed in knots-ish, altitude in metres, distance in metres.

export function makePlane(upgrades) {
  return {
    x: 0, y: 2, z: 0,          // lateral, altitude, distance along the route
    heading: 0,                 // degrees, 0 = along the route
    speed: 0,                   // knots
    throttle: 0,
    pitch: 0,                   // -1 dive .. 1 climb
    roll: 0,                    // -1 .. 1 bank
    vy: 0,                      // vertical speed m/s
    fuel: 100,
    damage: 0,                  // 0 pristine .. 100 wrecked
    stalled: false,
    airborne: false,
    landed: false,
    crashed: false,
    engineOn: true,
    maxSpeed: 118 + upgrades.engine * 9,
    stallSpeed: 46 - upgrades.wing * 4,
    fuelBurn: 0.62 - upgrades.tank * 0.05,
    hull: 1 + upgrades.hull * 0.35,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// One physics step. `env` carries wind and the ground height under the plane.
export function stepFlight(p, ctl, env, dt) {
  if (p.crashed || p.landed) return;

  if (ctl.throttleUp) p.throttle = clamp(p.throttle + dt * 0.55, 0, 1);
  if (ctl.throttleDown) p.throttle = clamp(p.throttle - dt * 0.7, 0, 1);

  const pitchTarget = (ctl.pitchUp ? 1 : 0) + (ctl.pitchDown ? -1 : 0);
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 3.2);
  const rollTarget = (ctl.rollRight ? 1 : 0) + (ctl.rollLeft ? -1 : 0);
  p.roll += (rollTarget - p.roll) * Math.min(1, dt * 3.6);

  p.engineOn = p.fuel > 0;
  if (p.engineOn) p.fuel = Math.max(0, p.fuel - p.throttle * p.fuelBurn * dt);

  // Speed chases the throttle setting; climbing bleeds it, diving gains it.
  const targetSpeed = p.engineOn ? p.throttle * p.maxSpeed : 0;
  p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 0.45);
  p.speed = clamp(p.speed - p.pitch * dt * 7.5, 0, p.maxSpeed + 34);

  p.stalled = p.airborne && p.speed < p.stallSpeed;
  const lift = clamp((p.speed - p.stallSpeed) / 26, 0, 1);
  let climb = p.pitch * 13 * lift;
  // Ground effect: the wing floats a little in the last metres before touchdown.
  if (p.airborne && p.y - env.groundY < 9 && climb < 0) climb *= 0.55;
  if (p.stalled) climb = -11 - (p.stallSpeed - p.speed) * 0.35;
  p.vy += (climb - p.vy) * Math.min(1, dt * 2.4);

  // Banked flight turns the nose and slides the plane sideways.
  p.heading = (p.heading + p.roll * dt * 26 * clamp(p.speed / 70, 0.25, 1.2) + 360) % 360;
  const drift = Math.sin((p.heading * Math.PI) / 180);
  p.x += (drift * p.speed * 0.16 + env.windX) * dt;
  p.z += Math.cos((p.heading * Math.PI) / 180) * p.speed * 0.52 * dt;
  if (p.z < 0) p.z = 0;
  p.y += p.vy * dt + env.liftY * dt;

  if (!p.airborne && p.speed > p.stallSpeed + 6 && p.pitch > 0.25) p.airborne = true;

  const ground = env.groundY;
  if (p.y <= ground + 1.2) {
    p.y = ground + 1.2;
    if (!p.airborne) { p.vy = 0; return; }
    const gentle = p.vy > -4.2 && Math.abs(p.roll) < 0.35 && p.speed < 96;
    if (env.onRunway && gentle) {
      p.landed = true;
      p.airborne = false;
      p.vy = 0;
    } else if (env.onRunway) {
      p.damage += (Math.abs(p.vy) * 4 + Math.abs(p.roll) * 22) / p.hull;
      p.vy = Math.abs(p.vy) * 0.32;
      p.y += 2.2;
      if (p.damage >= 100) p.crashed = true;
    } else {
      p.crashed = true;
      p.damage = 100;
    }
  }
}

export function headingLabel(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}
