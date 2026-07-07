(function () {
  const canvas = document.getElementById("battle-canvas");
  const ctx = canvas.getContext("2d");

  const { state, offlineSeconds } = State.load();

  Sfx.sfxEnabled = state.sfxEnabled;
  Sfx.musicEnabled = state.musicEnabled;
  const unlockAudio = () => Sfx.unlock();
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("touchstart", unlockAudio, { once: true });

  Game.init(state);
  Game.onRunEnd = (wave, coins) => UI.showGameover(wave, coins);

  UI.init(state, Game);
  UI.refreshTopbar();
  UI.refreshStats();

  function resizeCanvas() {
    const size = Render.resize(canvas);
    Game.setSpawnRadius(Math.min(size.width, size.height) / 2 - 10);
    return size;
  }
  let canvasSize = resizeCanvas();
  window.addEventListener("resize", () => { canvasSize = resizeCanvas(); });
  window.addEventListener("orientationchange", () => { canvasSize = resizeCanvas(); });

  // Offline earnings popup
  const offlineReward = State.computeOfflineReward(state, offlineSeconds);
  if (offlineReward.seconds >= 30) {
    if (offlineReward.cash > 0) state.run.cash += offlineReward.cash;
    UI.showOffline(offlineReward.seconds, offlineReward.cash);
  }
  if (!state.run.alive) {
    // Player left mid game-over; let them dismiss and start a fresh run.
    UI.showGameover(state.run.wave, 0);
  }

  let lastTs = performance.now();
  let uiAccum = 0;
  let saveAccum = 0;

  function frame(ts) {
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Utils.clamp(dt, 0, 0.25); // pause effectively when tab is backgrounded

    Game.update(dt);

    uiAccum += dt;
    if (uiAccum >= 1 / 15) {
      UI.refreshTopbar();
      UI.refreshBattle(uiAccum);
      UI.refreshUpgradeList(UI.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      UI.refreshUpgradeList(UI.dom.labList, State.LAB_DEFS, "lab");
      uiAccum = 0;
    }

    saveAccum += dt;
    if (saveAccum >= 5) {
      State.save(state);
      saveAccum = 0;
    }

    const world = Game.worldForRender(canvasSize.width, canvasSize.height);
    Render.draw(ctx, canvasSize, world);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Save on the way out
  window.addEventListener("pagehide", () => State.save(state));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") State.save(state);
    else if (Sfx.ctx && Sfx.ctx.state === "suspended") Sfx.ctx.resume();
  });

  // Refresh stats tab lazily when opened
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view === "view-stats") UI.refreshStats();
    });
  });
})();
