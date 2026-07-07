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

  // Lab: a timed research queue (one project at a time). Starting a project
  // spends Coins immediately; the level is only applied once its duration
  // has elapsed - including while the game isn't open, since completion is
  // just an absolute-timestamp check. Persists until the next Ascension.
  const LAB_DEFS = [
    { id: "labDmg", name: "Schadenslabor", icon: "🔬", desc: "+5% Turmschaden (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 3 },
    { id: "labHp", name: "Rumpfverstärkung", icon: "🏰", desc: "+5% Maximale HP (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 3 },
    { id: "labCash", name: "Handelsroute", icon: "📈", desc: "+5% Cash-Gewinn (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 4 },
    { id: "labCoin", name: "Coin-Raffinerie", icon: "🪙", desc: "+5% Coin-Gewinn (permanent)", baseCost: 8, costMult: 1.3, baseMinutes: 8 },
    { id: "labStart", name: "Startkapital", icon: "🏦", desc: "+25 Cash Startbonus (permanent)", baseCost: 4, costMult: 1.2, baseMinutes: 2 },
    { id: "labRegen", name: "Auto-Reparatur", icon: "⚙️", desc: "+5% HP-Regeneration (permanent)", baseCost: 6, costMult: 1.25, baseMinutes: 5 },
  ];
  const RESEARCH_DURATION_MULT = 1.22; // per level, same spirit as costMult
  const MAX_RESEARCH_SECONDS = 4 * 3600; // cap a single project at 4h

  // Combat abilities: one active slot, equipped from whichever of these are
  // unlocked. Nova is no longer free - every ability (including it) needs
  // its unlock talent bought first. baseCooldown is seconds.
  const ABILITY_DEFS = [
    { id: "nova", name: "Nova", icon: "💥", desc: "Flächenschaden auf alle Gegner in Reichweite", baseCooldown: 10 },
    { id: "shield", name: "Schutzschild", icon: "🛡️", desc: "Absorbiert Schaden für kurze Zeit", baseCooldown: 14 },
    { id: "slow", name: "Zeitlupe", icon: "❄️", desc: "Verlangsamt alle Gegner kurzzeitig deutlich", baseCooldown: 16 },
    { id: "chain", name: "Kettenblitz", icon: "⚡", desc: "Schaden springt zwischen mehreren Gegnern", baseCooldown: 8 },
    { id: "repair", name: "Notreparatur", icon: "💚", desc: "Heilt den Turm sofort um einen Anteil seiner Max-HP", baseCooldown: 20 },
  ];

  // Talents: bought with Cores (earned via Ascension), survive an Ascension.
  // Entries with an `ability` field are one-time unlocks (maxLevel 1) for
  // the matching ABILITY_DEFS entry - equip/swap happens for free afterward.
  const TALENT_DEFS = [
    { id: "talentDmg", name: "Uraltes Wissen", icon: "📜", desc: "+3% Turmschaden (für immer)", baseCost: 3, costMult: 1.3 },
    { id: "talentCoin", name: "Kern-Resonanz", icon: "🔮", desc: "+8% Coin-Gewinn pro Run-Ende", baseCost: 3, costMult: 1.3 },
    { id: "talentStartCash", name: "Kopfstart", icon: "🚀", desc: "+50 Cash Startkapital pro Run", baseCost: 2, costMult: 1.25 },
    { id: "talentCoreGain", name: "Aufstiegs-Erfahrung", icon: "✨", desc: "+5% Kerne pro Aufstieg", baseCost: 4, costMult: 1.35 },
    { id: "talentResearchSpeed", name: "Effiziente Forschung", icon: "⏱️", desc: "+5% Forschungstempo je Stufe", baseCost: 4, costMult: 1.3 },
    { id: "talentResearchSlots", name: "Parallele Forschung", icon: "🧬", desc: "+1 gleichzeitiges Forschungsprojekt (max. 3)", baseCost: 10, costMult: 2.2, maxLevel: 2 },
    { id: "talentAbilityNova", name: "Nova-Kern", icon: "💥", desc: "Schaltet die Fähigkeit Nova frei", baseCost: 3, costMult: 1, maxLevel: 1, ability: "nova" },
    { id: "talentAbilityShield", name: "Schild-Kern", icon: "🛡️", desc: "Schaltet die Fähigkeit Schutzschild frei", baseCost: 5, costMult: 1, maxLevel: 1, ability: "shield" },
    { id: "talentAbilitySlow", name: "Chrono-Kern", icon: "❄️", desc: "Schaltet die Fähigkeit Zeitlupe frei", baseCost: 5, costMult: 1, maxLevel: 1, ability: "slow" },
    { id: "talentAbilityChain", name: "Blitz-Kern", icon: "⚡", desc: "Schaltet die Fähigkeit Kettenblitz frei", baseCost: 6, costMult: 1, maxLevel: 1, ability: "chain" },
    { id: "talentAbilityRepair", name: "Reparatur-Kern", icon: "💚", desc: "Schaltet die Fähigkeit Notreparatur frei", baseCost: 6, costMult: 1, maxLevel: 1, ability: "repair" },
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
      research: [], // { id, startedAt, durationMs }[] - up to maxResearchSlots(talents)
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
      equippedAbility: null, // id into ABILITY_DEFS, or null if none unlocked yet

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

  // Research duration in milliseconds for starting `def` at its current
  // level. speedMult < 1 (from talentResearchSpeed) shortens it further.
  function researchDurationMs(def, level, speedMult) {
    const raw = def.baseMinutes * 60 * Math.pow(RESEARCH_DURATION_MULT, level) * (speedMult || 1);
    const seconds = Utils.clamp(raw, 1, MAX_RESEARCH_SECONDS);
    return seconds * 1000;
  }

  function researchSpeedMult(talents) {
    return Math.pow(0.95, getLevel(talents, "talentResearchSpeed"));
  }

  function maxResearchSlots(talents) {
    return 1 + Utils.clamp(getLevel(talents, "talentResearchSlots"), 0, 2);
  }

  function isAbilityUnlocked(abilityId, talents) {
    const def = TALENT_DEFS.find((d) => d.ability === abilityId);
    return def ? getLevel(talents, def.id) >= 1 : false;
  }

  // Ability cooldowns are flat once unlocked (unlock talents are one-time).
  function abilityCooldown(abilityDef) {
    return abilityDef.baseCooldown;
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
    merged.research = Array.isArray(s.research) ? s.research : s.research ? [s.research] : [];

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
    ABILITY_DEFS,
    defaultState,
    pendingCores,
    upgradeCost,
    researchDurationMs,
    researchSpeedMult,
    maxResearchSlots,
    isAbilityUnlocked,
    abilityCooldown,
    getLevel,
    load,
    save,
    computeOfflineReward,
    resetSave,
    exportSave,
    importSave,
  };
})(window);
