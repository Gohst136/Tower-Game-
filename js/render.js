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

  function draw(ctx, size, world) {
    const { width, height } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = world.cx !== undefined ? world.cx : width / 2;
    const cy = world.cy !== undefined ? world.cy : height / 2;

    // background rings
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let r = 40; r < Math.max(width, height); r += 40) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // range circle
    ctx.save();
    ctx.strokeStyle = "rgba(126,168,255,0.25)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, world.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // laser flashes
    world.flashes.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.strokeStyle = "#7ea8ff";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#7ea8ff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      ctx.restore();
    });

    // nova shockwave rings
    (world.novaRings || []).forEach((r) => {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(r.alpha, 0, 1);
      ctx.strokeStyle = "#c9aaff";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#a78bfa";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // kill particles
    (world.particles || []).forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Utils.clamp(p.alpha, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // enemies
    world.enemies.forEach((e) => {
      ctx.save();
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // hp bar
      const barW = e.radius * 2.4;
      const hpRatio = Utils.clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW, 3);
      ctx.fillStyle = hpRatio > 0.4 ? "#7bf0a4" : "#ff6161";
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW * hpRatio, 3);
      ctx.restore();
    });

    // tower
    ctx.save();
    const pulse = 1 + Math.sin(world.time * 3) * 0.03;
    const towerR = 22 * pulse;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, towerR);
    grad.addColorStop(0, "#9fc4ff");
    grad.addColorStop(1, "#3d7fff");
    ctx.fillStyle = grad;
    ctx.shadowColor = "#3d7fff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, towerR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  global.Render = { resize, draw };
})(window);
