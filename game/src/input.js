// Keyboard and mouse input for Hyrcanian Airmail.
// Arrows fly the plane, W/S work the throttle, Space drops a mail sack,
// Enter confirms menus, mouse clicks menu buttons.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyInput = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.anyInput = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('pointerdown', () => { this.mouse.down = true; this.mouse.clicked = true; this.anyInput = true; });
    window.addEventListener('pointerup', () => { this.mouse.down = false; });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  // Continuous flight controls read by the physics step.
  // Holding the pointer steers too: left of centre banks left, right banks right.
  controls() {
    const mouseRoll = this.mouse.down ? (this.mouse.x < 560 ? -1 : this.mouse.x > 720 ? 1 : 0) : 0;
    return {
      pitchUp: this.down('ArrowUp') || this.down('KeyI'),
      pitchDown: this.down('ArrowDown') || this.down('KeyK'),
      rollLeft: this.down('ArrowLeft') || this.down('KeyJ') || mouseRoll < 0,
      rollRight: this.down('ArrowRight') || this.down('KeyL') || mouseRoll > 0,
      throttleUp: this.down('KeyW'),
      throttleDown: this.down('KeyS'),
      drop: this.hit('Space'),
      confirm: this.hit('Enter'),
      pause: this.hit('KeyP') || this.hit('Escape'),
      mute: this.hit('KeyM'),
    };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
