(function () {
  const canvas = document.getElementById("battle-canvas");
  const ctx = canvas.getContext("2d");

  const { state, offlineSeconds, isNewSave } = State.load();

  Sfx.sfxEnabled = state.sfxEnabled;
  Sfx.musicEnabled = state.musicEnabled;
  const unlockAudio = () => Sfx.unlock();
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("touchstart", unlockAudio, { once: true });

  Game.init(state);
  Game.onRunEnd = (wave, coins) => UI.showGameover(wave, coins);
  Game.onEliteStart = (elite) => UI.showEliteToast(elite);
  Game.onAchievement = (def) => UI.showAchievementToast(def);
  Game.onResearchComplete = (def, level) => UI.showResearchToast(def, level);

  UI.init(state, Game);
  UI.refreshTopbar();
  UI.refreshStats();
  UI.refreshAbilityButton();
  UI.refreshElite();
  UI.refreshBoss();

  // A research project already running when we last saved may have
  // finished while the game was closed - catch it up immediately.
  Game.checkResearch();
  UI.refreshLabList();

  // Daily login bonus: a simple calendar-day comparison, no backend needed.
  (function checkDailyLogin() {
    const todayStr = new Date().toDateString();
    if (state.lastLoginDate === todayStr) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const wasYesterday = state.lastLoginDate === yesterday.toDateString();
    state.loginStreak = wasYesterday ? (state.loginStreak || 0) + 1 : 1;
    state.lastLoginDate = todayStr;
    const reward = 10 * Math.min(state.loginStreak, 7);
    state.coins += reward;
    state.totalCoinsEarned += reward;
    // Skip the toast on someone's very first-ever session - the tutorial
    // already covers orientation and "Tag 1 Bonus" has no context yet.
    if (!isNewSave) UI.showLoginToast(state.loginStreak, reward);
  })();

  // First-ever session: show a short onboarding flow instead of dropping
  // the player straight into five tabs' worth of systems. Existing saves
  // (isNewSave === false) never see this, even after this feature ships.
  if (isNewSave) {
    UI.showTutorial();
    State.save(state); // guarantees it won't repeat even on an instant close
  }

  // iOS has no native install prompt, so show a one-time tip to use
  // Share -> "Zum Home-Bildschirm" for the full standalone app experience.
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  const tipDismissed = localStorage.getItem("towerIdleInstallTipDismissed") === "1";
  const installTip = document.getElementById("ios-install-tip");
  if (isIos && !isStandalone && !tipDismissed) {
    installTip.classList.remove("hidden");
  }
  document.getElementById("btn-dismiss-tip").addEventListener("click", () => {
    installTip.classList.add("hidden");
    localStorage.setItem("towerIdleInstallTipDismissed", "1");
  });

  function resizeCanvas() {
    const size = Render.resize(canvas);
    Game.setCanvasSize(size.width, size.height);
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
    const completedResearch = Game.checkResearch();

    uiAccum += dt;
    if (uiAccum >= 1 / 15) {
      UI.refreshTopbar();
      UI.refreshBattle(uiAccum);
      UI.refreshUpgradeList(UI.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      UI.refreshLabList();
      UI.refreshAbilityButton();
      UI.refreshAbilityList();
      UI.refreshUpgradeList(UI.dom.talentList, UI._regularTalentDefs(), "talent");
      UI.refreshElite();
      UI.refreshBoss();
      UI.refreshAscendPreview();
      uiAccum = 0;
    } else if (completedResearch.length > 0) {
      // a project just finished mid-throttle window - refresh right away
      // so the queue slot frees up immediately rather than up to ~66ms late
      UI.refreshLabList();
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
