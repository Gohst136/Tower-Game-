// Game state, upgrade definitions, persistence. Exposed on window.State
(function (global) {
  const SAVE_KEY = "towerIdleSave_v1";
  const MAX_OFFLINE_SECONDS = 4 * 3600; // cap offline earnings at 4h
  const OFFLINE_EFFICIENCY = 0.45; // offline cash rate vs. active rate

  // --- Upgrade catalogs -----------------------------------------------
  // Workshop: reset every run, bought with Cash
  const WORKSHOP_DEFS = [
    { id: "dmg", name: "Schadensmodul", icon: "💥", desc: "+8% Turmschaden", baseCost: 10, costMult: 1.15 },
    { id: "atk", name: "Feuerrate-Chip", icon: "⚡", desc: "+5% Angriffsgeschwindigkeit", baseCost: 15, costMult: 1.16 },
    { id: "range", name: "Radarreichweite", icon: "📡", desc: "+6 Reichweite", baseCost: 8, costMult: 1.12 },
    { id: "hp", name: "Panzerplatten", icon: "🛡️", desc: "+15% Maximale HP", baseCost: 10, costMult: 1.15 },
    { id: "regen", name: "Nanoreparatur", icon: "🩹", desc: "+0.4 HP-Regeneration/Sek", baseCost: 12, costMult: 1.15 },
    { id: "cash", name: "Cash-Extraktor", icon: "💰", desc: "+10% Cash-Gewinn", baseCost: 20, costMult: 1.2 },
  ];

  // Lab: permanent across runs, bought with Coins
  const LAB_DEFS = [
    { id: "labDmg", name: "Schadenslabor", icon: "🔬", desc: "+5% Turmschaden (permanent)", baseCost: 5, costMult: 1.25 },
    { id: "labHp", name: "Rumpfverstärkung", icon: "🏰", desc: "+5% Maximale HP (permanent)", baseCost: 5, costMult: 1.25 },
    { id: "labCash", name: "Handelsroute", icon: "📈", desc: "+5% Cash-Gewinn (permanent)", baseCost: 5, costMult: 1.25 },
    { id: "labCoin", name: "Coin-Raffinerie", icon: "🪙", desc: "+5% Coin-Gewinn (permanent)", baseCost: 8, costMult: 1.3 },
    { id: "labStart", name: "Startkapital", icon: "🏦", desc: "+25 Cash Startbonus (permanent)", baseCost: 4, costMult: 1.2 },
    { id: "labRegen", name: "Auto-Reparatur", icon: "⚙️", desc: "+5% HP-Regeneration (permanent)", baseCost: 6, costMult: 1.25 },
  ];

  // Talents: bought with Cores (earned via Ascension), survive an Ascension
  const TALENT_DEFS = [
    { id: "talentDmg", name: "Uraltes Wissen", icon: "📜", desc: "+3% Turmschaden (für immer)", baseCost: 3, costMult: 1.3 },
    { id: "talentCoin", name: "Kern-Resonanz", icon: "🔮", desc: "+8% Coin-Gewinn pro Run-Ende", baseCost: 3, costMult: 1.3 },
    { id: "talentStartCash", name: "Kopfstart", icon: "🚀", desc: "+50 Cash Startkapital pro Run", baseCost: 2, costMult: 1.25 },
    { id: "talentCoreGain", name: "Aufstiegs-Erfahrung", icon: "✨", desc: "+5% Kerne pro Aufstieg", baseCost: 4, costMult: 1.35 },
  ];

  function defaultState() {
    return {
      // permanent / meta
      coins: 0,
      totalCoinsEarned: 0,
      bestWave: 1,
      totalKills: 0,
      bossKills: 0,
      runsCompleted: 0,
      lab: {}, // id -> level
      autoRestart: false,
      musicEnabled: true,
      sfxEnabled: true,
      targetMode: "nearest", // "nearest" | "strongest" | "weakest"
      lastSaveTime: Date.now(),
      // recent rate tracking (for offline estimate)
      recentCashPerSecond: 0,
      achievements: {}, // id -> true

      // second prestige layer: Ascension resets coins+lab for a lasting
      // Talent currency (Cores) that survives future Ascensions
      cores: 0,
      coinsAtLastAscend: 0,
      ascensionCount: 0,
      talents: {}, // id -> level

      // daily login streak
      lastLoginDate: null,
      loginStreak: 0,

      // per-run
      run: {
        wave: 1,
        cash: 0,
        workshop: {}, // id -> level
        towerHp: 100,
        towerMaxHp: 100,
        waveTimer: 0,
        enemiesToSpawn: 0,
        enemiesSpawned: 0,
        spawnTimer: 0,
        alive: true,
      },
    };
  }

  function upgradeCost(def, level) {
    return Math.ceil(def.baseCost * Math.pow(def.costMult, level));
  }

  function getLevel(map, id) {
    return map[id] || 0;
  }

  function load() {
    let s = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) {
      console.warn("Save konnte nicht geladen werden", e);
    }
    const fresh = defaultState();
    if (!s) return { state: fresh, offlineSeconds: 0, isNewSave: true };

    // merge shallowly to survive schema additions
    const merged = Object.assign(fresh, s);
    merged.run = Object.assign(fresh.run, s.run || {});
    merged.lab = s.lab || {};

    const now = Date.now();
    const offlineMs = now - (s.lastSaveTime || now);
    const offlineSeconds = Utils.clamp(offlineMs / 1000, 0, Infinity);
    return { state: merged, offlineSeconds, isNewSave: false };
  }

  function save(state) {
    state.lastSaveTime = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Speichern fehlgeschlagen", e);
    }
  }

  function computeOfflineReward(state, offlineSeconds) {
    const cappedSeconds = Utils.clamp(offlineSeconds, 0, MAX_OFFLINE_SECONDS);
    if (cappedSeconds < 30 || !state.run.alive) {
      return { seconds: cappedSeconds, cash: 0 };
    }
    const rate = state.recentCashPerSecond || 0;
    const cash = Math.floor(rate * cappedSeconds * OFFLINE_EFFICIENCY);
    return { seconds: cappedSeconds, cash };
  }

  function resetSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  function exportSave(state) {
    const json = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(json)));
  }

  // Returns the parsed state object, or null if the code is invalid.
  function importSave(code) {
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== "object" || typeof obj.coins !== "number" || !obj.run) return null;
      return obj;
    } catch (e) {
      return null;
    }
  }

  // How many Cores an Ascension right now would grant, given coins earned
  // since the last one. Returns 0 if nothing new has been earned.
  function pendingCores(state) {
    const total = Math.floor(Math.sqrt(state.totalCoinsEarned / 40));
    const claimed = Math.floor(Math.sqrt(state.coinsAtLastAscend / 40));
    const talentBonus = Math.pow(1.05, getLevel(state.talents, "talentCoreGain"));
    return Math.floor((total - claimed) * talentBonus);
  }

  global.State = {
    SAVE_KEY,
    WORKSHOP_DEFS,
    LAB_DEFS,
    TALENT_DEFS,
    defaultState,
    pendingCores,
    upgradeCost,
    getLevel,
    load,
    save,
    computeOfflineReward,
    resetSave,
    exportSave,
    importSave,
  };
})(window);
