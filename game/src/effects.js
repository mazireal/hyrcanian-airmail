// Feel systems: particle bursts, screen shake, floating score callouts,
// rain streaks and the stall buffet.

export class Effects {
  constructor() {
    this.particles = [];
    this.floaters = [];
    this.shake = 0;
  }

  burst(x, y, color, count = 14, speed = 130) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30,
        life: 0.5 + Math.random() * 0.6, age: 0, color, size: 2 + Math.random() * 3,
      });
    }
  }

  dust(x, y) { this.burst(x, y, 'rgba(196,170,120,0.8)', 10, 70); }
  sparks(x, y) { this.burst(x, y, '#ffd873', 16, 190); }

  callout(x, y, text, color = '#ffd873') {
    this.floaters.push({ x, y, text, color, age: 0, life: 1.4 });
  }

  addShake(amount) { this.shake = Math.min(16, this.shake + amount); }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const f of this.floaters) { f.age += dt; f.y -= dt * 34; }
    this.floaters = this.floaters.filter((f) => f.age < f.life);
  }

  offset(t) {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return {
      x: Math.sin(t * 61) * this.shake,
      y: Math.cos(t * 53) * this.shake * 0.7,
    };
  }

  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      ctx.globalAlpha = 1 - f.age / f.life;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}

export function drawRain(ctx, w, h, t, strength, wind = 0) {
  if (strength <= 0) return;
  ctx.strokeStyle = 'rgba(190,210,225,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const count = Math.floor(90 * strength);
  const slant = 7 + wind * 2.2;
  for (let i = 0; i < count; i++) {
    const x = ((i * 173 + t * 620) % (w + 80)) - 40;
    const y = (i * 97 + t * 980) % h;
    ctx.moveTo(x, y);
    ctx.lineTo(x - slant, y + 17);
  }
  ctx.stroke();
}
