// The mail plane: a canvas-and-wood biplane drawn from behind, banking with the roll,
// shuddering in a stall, trailing smoke as damage climbs.

export function drawPlane(ctx, plane, w, h, t) {
  const cx = w / 2;
  const cy = h * 0.62 - plane.pitch * 26 + Math.sin(t * 2.1) * 2;
  const bank = plane.roll * 0.62;
  const scale = 1.78;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bank);
  ctx.scale(scale, scale);
  if (plane.stalled) ctx.translate(Math.sin(t * 47) * 1.6, Math.cos(t * 53) * 1.2);

  // Tailplane and fin.
  ctx.fillStyle = '#8c3b2e';
  ctx.beginPath();
  ctx.moveTo(-34, 16); ctx.lineTo(34, 16); ctx.lineTo(26, 24); ctx.lineTo(-26, 24); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-3, 6); ctx.lineTo(3, 6); ctx.lineTo(2, -14); ctx.lineTo(-4, -14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(-2.4, -13, 4.8, 5);

  // Lower and upper wings with struts.
  ctx.fillStyle = '#a8502f';
  ctx.fillRect(-58, 10, 116, 7);
  ctx.fillStyle = '#bc5c36';
  ctx.fillRect(-64, -12, 128, 8);
  ctx.strokeStyle = '#5b4230';
  ctx.lineWidth = 1.6;
  for (const sx of [-46, -20, 20, 46]) {
    ctx.beginPath(); ctx.moveTo(sx, -4); ctx.lineTo(sx * 0.92, 10); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(232,220,192,0.9)';
  ctx.fillRect(-64, -12, 10, 8);
  ctx.fillRect(54, -12, 10, 8);

  // Fuselage with shading and a mail sack in the rear cockpit.
  const body = ctx.createLinearGradient(0, -16, 0, 22);
  body.addColorStop(0, '#d97b4a'); body.addColorStop(0.55, '#b3542f'); body.addColorStop(1, '#7e3a22');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 4, 13, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d2b1f';
  ctx.beginPath(); ctx.ellipse(0, -4, 7.5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath(); ctx.ellipse(0, 6, 6.4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7c5a36';
  ctx.fillRect(-5, 3.4, 10, 2);
  ctx.fillStyle = '#2e2a26';
  ctx.font = 'bold 5px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POST', 0, 8.4);

  // Pilot head and scarf.
  ctx.fillStyle = '#e9b98a';
  ctx.beginPath(); ctx.arc(0, -6, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5b4230';
  ctx.beginPath(); ctx.arc(0, -7.4, 3.8, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -4);
  ctx.quadraticCurveTo(10 + Math.sin(t * 9) * 2, -2, 15 + Math.sin(t * 11) * 3, 1);
  ctx.stroke();

  // Propeller blur ahead of the nose.
  if (plane.engineOn && plane.speed > 4) {
    ctx.strokeStyle = 'rgba(40,34,28,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -16, 17, 3.4, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Landing gear, down when slow and low.
  if (plane.y < 60 && plane.speed < 88) {
    ctx.strokeStyle = '#3d2b1f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-11, 26); ctx.moveTo(8, 16); ctx.lineTo(11, 26); ctx.stroke();
    ctx.fillStyle = '#22201e';
    ctx.beginPath(); ctx.arc(-12, 28, 4, 0, Math.PI * 2); ctx.arc(12, 28, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Smoke trail when hurt.
  if (plane.damage > 25 && !plane.crashed) {
    ctx.fillStyle = `rgba(60,58,56,${0.16 + plane.damage / 260})`;
    for (let i = 0; i < 5; i++) {
      const px = cx + Math.sin(t * 3 + i * 1.7) * 6 - plane.roll * i * 5;
      const py = cy + 16 + i * 13;
      ctx.beginPath(); ctx.arc(px, py, 5 + i * 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawSack(ctx, sack, projectFn, cam, w, h) {
  const p = projectFn(cam, sack.x, sack.y, sack.z, w, h);
  if (!p) return;
  const s = p.scale;
  ctx.fillStyle = '#e8dcc0';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 3.2 * s, 4 * s, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7c5a36';
  ctx.fillRect(p.x - 3 * s, p.y - 1 * s, 6 * s, 1.4 * s);
}
