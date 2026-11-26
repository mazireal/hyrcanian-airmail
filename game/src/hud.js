// Flight instruments: compass strip, airspeed and altitude tapes, artificial
// horizon, fuel and throttle bars, objective banner and warnings.

import { headingLabel } from './flight.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,18,28,0.62)';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill(); ctx.stroke();
}

function tape(ctx, x, y, w, h, value, step, label, format) {
  panel(ctx, x, y, w, h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#dfe9f2';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  const base = Math.round(value / step) * step;
  for (let v = base - step * 3; v <= base + step * 3; v += step) {
    const yy = y + h / 2 - (v - value) * (h / (step * 4));
    if (yy < y + 8 || yy > y + h - 4) continue;
    ctx.fillText(format(v), x + w / 2, yy + 5);
    ctx.fillRect(x + 6, yy, 8, 1.6);
    ctx.fillRect(x + w - 14, yy, 8, 1.6);
  }
  ctx.restore();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2 - 7); ctx.lineTo(x + 10, y + h / 2); ctx.lineTo(x, y + h / 2 + 7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9fc3dd';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(label, x + w / 2, y + h + 15);
}

export function drawHud(ctx, plane, mission, state, w, h, t) {
  // Compass strip across the top.
  panel(ctx, w / 2 - 190, 12, 380, 40);
  ctx.save();
  ctx.beginPath(); ctx.rect(w / 2 - 190, 12, 380, 40); ctx.clip();
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const deg = ((plane.heading + d) % 360 + 360) % 360;
    const x = w / 2 + d * 3;
    ctx.fillStyle = d === 0 ? '#ffb340' : '#dfe9f2';
    ctx.fillText(d % 45 === 0 ? headingLabel(deg) : String(Math.round(deg / 10)), x, 38);
  }
  ctx.restore();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 52); ctx.lineTo(w / 2 + 7, 52); ctx.lineTo(w / 2, 62);
  ctx.closePath(); ctx.fill();

  tape(ctx, 16, h * 0.3, 84, 190, plane.speed, 10, 'KNOTS', (v) => String(Math.max(0, Math.round(v))));
  tape(ctx, w - 100, h * 0.3, 84, 190, plane.y, 50, 'ALT M', (v) => String(Math.max(0, Math.round(v))));

  // Artificial horizon.
  const hx = w / 2, hy = h - 74;
  panel(ctx, hx - 58, hy - 46, 116, 92);
  ctx.save();
  ctx.beginPath(); ctx.rect(hx - 52, hy - 40, 104, 80); ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-plane.roll * 0.6);
  const pitchShift = plane.pitch * 18;
  ctx.fillStyle = '#4d8fc4';
  ctx.fillRect(-70, -70 + pitchShift, 140, 70);
  ctx.fillStyle = '#8a6a3d';
  ctx.fillRect(-70, pitchShift, 140, 70);
  ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(-70, pitchShift); ctx.lineTo(70, pitchShift); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffb340';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx - 26, hy); ctx.lineTo(hx - 8, hy); ctx.lineTo(hx, hy + 6); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx + 26, hy);
  ctx.stroke();
  ctx.fillStyle = '#9fc3dd';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`VS ${plane.vy >= 0 ? '+' : ''}${plane.vy.toFixed(1)}`, hx, hy + 62);

  // Fuel and throttle.
  panel(ctx, 16, h - 96, 196, 80);
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fc3dd';
  ctx.fillText('FUEL', 28, h - 72);
  ctx.fillText('THROTTLE', 28, h - 40);
  bar(ctx, 96, h - 82, 104, 11, plane.fuel / 100, plane.fuel < 22 ? '#ff5f4d' : '#57d977');
  bar(ctx, 96, h - 50, 104, 11, plane.throttle, '#ffb340');

  // Objective and progress.
  panel(ctx, w - 300, h - 96, 284, 80);
  ctx.fillStyle = '#ffd873';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(mission.name.toUpperCase(), w - 286, h - 72);
  ctx.fillStyle = '#dfe9f2';
  ctx.font = '13px sans-serif';
  ctx.fillText(state.objectiveText, w - 286, h - 50);
  ctx.fillStyle = '#9fc3dd';
  ctx.fillText(`Rings ${state.ringsDone}/${state.ringsTotal}   Mail ${state.dropsDone}/${state.dropsTotal}   Score ${state.score}`, w - 286, h - 28);

  // Warnings, telegraphed in words.
  const warnings = [];
  if (plane.stalled) warnings.push('STALL — PUSH THE NOSE DOWN');
  if (plane.airborne && plane.y < 26 && plane.vy < -3) warnings.push('TERRAIN — CLIMB');
  if (plane.fuel < 22 && plane.fuel > 0) warnings.push('LOW FUEL');
  if (!plane.engineOn && plane.airborne) warnings.push('ENGINE OUT — GLIDE TO THE STRIP');
  if (state.gustWarning > 0) warnings.push('WIND GUST FROM THE SEA');
  if (warnings.length && Math.floor(t * 2.4) % 2 === 0) {
    ctx.fillStyle = 'rgba(120,20,14,0.78)';
    ctx.fillRect(w / 2 - 230, 76, 460, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warnings[0], w / 2, 99);
  }
}

function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
