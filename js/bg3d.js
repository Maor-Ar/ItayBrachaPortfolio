/* ============================================
   3D Background - Audio-Reactive Particle Field
   Responds to background music & music players
   via window.__audioReactive (set by audio-engine.js)
   ============================================ */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  let particles = [];
  let mouse = { x: -1000, y: -1000 };
  let hueShift = 0;
  let targetHue = 200;

  // Shared audio state (written by audio-engine.js)
  window.__audioReactive = window.__audioReactive || {
    bass: 0, mid: 0, high: 0, energy: 0, peak: false
  };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticles() {
    const count = Math.min(Math.floor((W * H) / 10000), 140);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: Math.random() * 2 + 0.5,
        baseVx: (Math.random() - 0.5) * 0.3,
        baseVy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        pulse: Math.random() * Math.PI * 2,
        hueOffset: Math.random() * 60 - 30,
        orbitSpeed: 0.002 + Math.random() * 0.004,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitRadius: 30 + Math.random() * 80,
      });
    }
  }

  // Nebula blobs
  const nebulae = [];
  for (let i = 0; i < 5; i++) {
    nebulae.push({
      x: Math.random(), y: Math.random(),
      size: 200 + Math.random() * 400,
      hueOff: Math.random() * 60,
      phase: Math.random() * Math.PI * 2,
      speed: 0.0003 + Math.random() * 0.0005,
      driftX: (Math.random() - 0.5) * 0.00005,
      driftY: (Math.random() - 0.5) * 0.00005
    });
  }

  function draw() {
    const ar = window.__audioReactive;
    const bass = ar.bass || 0;
    const mid = ar.mid || 0;
    const high = ar.high || 0;
    const energy = ar.energy || 0;

    ctx.clearRect(0, 0, W, H);
    hueShift += (targetHue - hueShift) * 0.02;

    // --- Nebulae ---
    nebulae.forEach(n => {
      n.phase += n.speed;
      n.x += n.driftX; n.y += n.driftY;
      if (n.x < -0.2 || n.x > 1.2) n.driftX *= -1;
      if (n.y < -0.2 || n.y > 1.2) n.driftY *= -1;
      const px = n.x * W + Math.sin(n.phase) * 60;
      const py = n.y * H + Math.cos(n.phase * 0.7) * 40;
      const sz = n.size * (1 + bass * 0.8);
      const al = 0.03 + energy * 0.08;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, sz);
      grad.addColorStop(0, `hsla(${hueShift + n.hueOff}, 70%, 45%, ${al})`);
      grad.addColorStop(0.5, `hsla(${hueShift + n.hueOff + 30}, 60%, 30%, ${al * 0.4})`);
      grad.addColorStop(1, `hsla(${hueShift + n.hueOff}, 50%, 20%, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(px - sz, py - sz, sz * 2, sz * 2);
    });

    // --- Connections ---
    const connDist = 120 + bass * 80;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connDist) {
          const alpha = (1 - dist / connDist) * (0.1 + energy * 0.2) * Math.min(p.z, q.z);
          ctx.beginPath();
          ctx.strokeStyle = `hsla(${hueShift + mid * 40}, 80%, ${55 + high * 20}%, ${alpha})`;
          ctx.lineWidth = 0.5 + energy * 1;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }

    // --- Particles ---
    for (const p of particles) {
      p.pulse += 0.02 + energy * 0.04;
      const orbitBoost = 1 + bass * 3;
      p.orbitPhase += p.orbitSpeed * orbitBoost;
      const ox = Math.cos(p.orbitPhase) * p.orbitRadius * 0.01 * (1 + mid * 2);
      const oy = Math.sin(p.orbitPhase) * p.orbitRadius * 0.01 * (1 + mid * 2);

      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let mx = 0, my = 0;
      if (dist < 200) {
        const f = (200 - dist) / 200 * 0.0002;
        mx = -dx * f; my = -dy * f;
      }

      let kx = 0, ky = 0;
      if (ar.peak) {
        const a = Math.atan2(p.y - H / 2, p.x - W / 2);
        kx = Math.cos(a) * bass * 2;
        ky = Math.sin(a) * bass * 2;
      }

      p.x += (p.baseVx + ox + mx + kx) * p.z;
      p.y += (p.baseVy + oy + my + ky) * p.z;

      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      const glow = 0.3 + Math.sin(p.pulse) * 0.2 + energy * 0.3;
      const sz = p.size * p.z * (1 + bass * 0.8);
      const ph = hueShift + p.hueOffset + high * 60;

      ctx.beginPath();
      ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${ph}, 85%, ${60 + energy * 20}%, ${glow})`;
      ctx.fill();

      const gsz = sz * (3 + energy * 4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, gsz, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${ph}, 80%, 55%, ${glow * (0.04 + energy * 0.07)})`;
      ctx.fill();
    }

    // --- Peak flash ---
    if (ar.peak) {
      ctx.fillStyle = `hsla(${hueShift}, 80%, 70%, ${0.02 + bass * 0.05})`;
      ctx.fillRect(0, 0, W, H);
      ar.peak = false;
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => { resize(); createParticles(); });
  document.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.bgSetHue = function (hue) { targetHue = hue; };

  resize();
  createParticles();
  draw();
})();
