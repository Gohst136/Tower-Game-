(function () {
  // Offline support + instant repeat loads. Registered lazily after load so
  // it never competes with the game itself for bandwidth on first visit.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  const canvas = document.getElementById("battle-canvas");
  const ctx = canvas.getContext("2d");

  const { state, offlineSeconds, isNewSave } = State.load();

  Sfx.sfxEnabled = state.sfxEnabled;
  Sfx.musicEnabled = state.musicEnabled;
  const unlockAudio = () => Sfx.unlock();
  document.addEventListener("pointerdown", unlockAudio, { once: true });
  document.addEventListener("touchstart", unlockAudio, { once: true });

  Game.init(state);
  Game.onRunEnd = (wave, coins) => { UI.showGameover(wave, coins); Utils.vibrate([60, 30, 60]); };
  Game.onEliteStart = (elite) => { UI.showEliteToast(elite); Utils.vibrate(40); };
  Game.onAchievement = (def) => { UI.showAchievementToast(def); Utils.vibrate([15, 40, 15]); };
  Game.onResearchComplete = (def, level) => { UI.showResearchToast(def, level); Utils.vibrate(20); };

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
    if (!isNewSave) { UI.showLoginToast(state.loginStreak, reward); Utils.vibrate(20); }
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

  // Chrome/Android: capture the native install prompt so we can trigger it
  // from our own button instead of relying on the easy-to-miss browser UI.
  const androidTip = document.getElementById("android-install-tip");
  const androidTipDismissed = localStorage.getItem("towerIdleAndroidTipDismissed") === "1";
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone && !androidTipDismissed) androidTip.classList.remove("hidden");
  });
  document.getElementById("btn-install-android").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    androidTip.classList.add("hidden");
  });
  document.getElementById("btn-dismiss-android-tip").addEventListener("click", () => {
    androidTip.classList.add("hidden");
    localStorage.setItem("towerIdleAndroidTipDismissed", "1");
  });
  window.addEventListener("appinstalled", () => {
    androidTip.classList.add("hidden");
    localStorage.setItem("towerIdleAndroidTipDismissed", "1");
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

  // Treat open modals / non-battle tabs as in-app "history" so Android's
  // back button (or a stray swipe-back on any platform) closes them first
  // instead of immediately exiting the whole game.
  history.pushState({ towerIdle: true }, "");
  window.addEventListener("popstate", () => {
    const openModal = document.querySelector(".modal:not(.hidden)");
    const activeTab = document.querySelector(".tab-btn.active");
    let handled = false;
    if (openModal) {
      openModal.classList.add("hidden");
      handled = true;
    } else if (activeTab && activeTab.dataset.view !== "view-battle") {
      document.querySelector('[data-view="view-battle"]').click();
      handled = true;
    }
    if (handled) history.pushState({ towerIdle: true }, "");
  });
})();
