// Canvas rendering for the battle view. window.Render
(function (global) {
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize(canvas) {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    return { width: rect.width, height: rect.height };
  }

  // ---------- Procedural enemy silhouettes (no image assets needed) ----------
  // Deterministic (angle-based) jitter so a rock's outline doesn't
  // flicker between frames, just slowly tumbles via the caller's rotation.
  function rockPath(ctx, r) {
    const points = 9;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const jitter = 1 + 0.22 * Math.sin(a * 2.7 + 1.3) + 0.12 * Math.sin(a * 5.1);
      const rad = r * jitter;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function crystalPath(ctx, r) {
    const spikes = 7;
    ctx.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rad = r * (i % 2 === 0 ? 1 : 0.58);
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function cometPath(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0);
    ctx.quadraticCurveTo(r * 0.6, r * 0.9, -r, r * 0.5);
    ctx.quadraticCurveTo(-r * 1.3, 0, -r, -r * 0.5);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.9, r * 1.4, 0);
    ctx.closePath();
  }

  function drawEnemyBody(ctx, e) {
    const r = e.radius;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.spin || 0);
    ctx.fillStyle = e.color;

    if (e.shape === "comet") {
      cometPath(ctx, r);
      ctx.fill();
    } else if (e.shape === "crystal") {
      crystalPath(ctx, r);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (e.shape === "fracture") {
      rockPath(ctx, r);
      ctx.fill();
      // crack line hinting it's about to split
      ctx.strokeStyle = "rgba(40,20,0,0.6)";
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.5);
      ctx.lineTo(r * 0.1, 0);
      ctx.lineTo(-r * 0.2, r * 0.6);
      ctx.stroke();
    } else if (e.shape === "ship") {
      drawMothership(ctx, r);
    } else {
      rockPath(ctx, r);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMothership(ctx, r) {
    // saucer hull
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.15, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // raised dome
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.12, r * 0.55, r * 0.4, 0, Math.PI, 0);
    ctx.fill();
    // rim running lights
    ctx.fillStyle = "#7bffb0";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const lx = Math.cos(a) * r * 1.0, ly = Math.sin(a) * r * 0.42;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.2, r * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw(ctx, size, world) {
    const { width, height } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = world.cx !== undefined ? world.cx : width / 2;
    const cy = world.cy !== undefined ? world.cy : height / 2;

    // background sensor rings
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let r = 40; r < Math.max(width, height); r += 40) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // defense range circle
    ctx.save();
    ctx.strokeStyle = "rgba(126,168,255,0.25)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, world.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // laser flashes (blue = planetary cannon firing, red = mothership firing back)
    world.flashes.forEach((f) => {
      const color = f.color || "#7ea8ff";
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.restore();
    });

    // ability shockwave rings (Sonneneruption/Gravitationsfeld/Notreparatur pulses)
    (world.rings || []).forEach((r) => {
      const color = r.color || "#c9aaff";
      ctx.save();
      ctx.globalAlpha = Utils.clamp(r.alpha, 0, 1);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Ionenkette bolts
    (world.chainLines || []).forEach((l) => {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(l.alpha, 0, 1);
      ctx.strokeStyle = "#7ee8ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#aef6ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      ctx.restore();
    });

    // impact/debris particles
    (world.particles || []).forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(p.alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // enemies: meteors, comet fragments, crystal meteors, and alien motherships
    world.enemies.forEach((e) => {
      drawEnemyBody(ctx, e);

      ctx.save();
      // shield ring (Kristallmeteor's energy shield, depletes before real HP)
      if (e.maxShieldHp && e.shieldHp > 0) {
        ctx.strokeStyle = "rgba(77,212,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 4, 0, Math.PI * 2 * Utils.clamp(e.shieldHp / e.maxShieldHp, 0, 1));
        ctx.stroke();
      }

      // hp bar
      const barW = e.radius * 2.4;
      const hpRatio = Utils.clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW, 3);
      ctx.fillStyle = hpRatio > 0.4 ? "#7bf0a4" : "#ff6161";
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW * hpRatio, 3);
      ctx.restore();
    });

    // the defended planet (was a plain tech-orb tower)
    ctx.save();
    const pulse = 1 + Math.sin(world.time * 1.1) * 0.015;
    const planetR = (world.towerRadius || 22) * pulse;
    const grad = ctx.createRadialGradient(cx - planetR * 0.35, cy - planetR * 0.35, planetR * 0.15, cx, cy, planetR);
    grad.addColorStop(0, "#a9e4ff");
    grad.addColorStop(0.45, "#3d8fdb");
    grad.addColorStop(0.8, "#1c4f7a");
    grad.addColorStop(1, "#0b2740");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#3d8fdb";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, planetR, 0, Math.PI * 2);
    ctx.fill();

    // simple continents, clipped to the planet disc
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(80,200,140,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx - planetR * 0.25, cy - planetR * 0.15, planetR * 0.5, planetR * 0.32, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + planetR * 0.4, cy + planetR * 0.35, planetR * 0.35, planetR * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // active Planetenschild glow
    if (world.shieldActive) {
      ctx.save();
      const shieldPulse = 1 + Math.sin(world.time * 6) * 0.06;
      ctx.strokeStyle = "rgba(77,212,255,0.8)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#4dd4ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, planetR * 1.5 * shieldPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  global.Render = { resize, draw };
})(window);
