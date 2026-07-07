// Game state, upgrade definitions, persistence. Exposed on window.State
(function (global) {
  const SAVE_KEY = "towerIdleSave_v1";
  const MAX_OFFLINE_SECONDS = 4 * 3600; // cap offline earnings at 4h
  const OFFLINE_EFFICIENCY = 0.45; // offline cash rate vs. active rate

  // --- Upgrade catalogs -----------------------------------------------
  // Werkstatt: reset every run, bought with Rohstoffe (Cash)
  const WORKSHOP_DEFS = [
    { id: "dmg", name: "Geschützverstärkung", icon: "💥", desc: "+8% Geschützschaden", baseCost: 10, costMult: 1.15 },
    { id: "atk", name: "Feuerleitsystem", icon: "⚡", desc: "+5% Feuerrate", baseCost: 15, costMult: 1.16 },
    { id: "range", name: "Langstreckensensoren", icon: "📡", desc: "+6 Sensorreichweite", baseCost: 8, costMult: 1.12 },
    { id: "hp", name: "Planetenpanzerung", icon: "🛡️", desc: "+15% Maximale Integrität", baseCost: 10, costMult: 1.15 },
    { id: "regen", name: "Selbstheilungsmatrix", icon: "🩹", desc: "+0.4 Integritäts-Regeneration/Sek", baseCost: 12, costMult: 1.15 },
    { id: "cash", name: "Bergbaudrohnen", icon: "💰", desc: "+10% Rohstoff-Gewinn", baseCost: 20, costMult: 1.2 },
  ];

  // Labor: a timed research queue (one project at a time). Starting a
  // project spends Kristalle (Coins) immediately; the level is only applied
  // once its duration has elapsed - including while the game isn't open,
  // since completion is just an absolute-timestamp check. Persists until
  // the next Aufstieg.
  const LAB_DEFS = [
    { id: "labDmg", name: "Waffenlabor", icon: "🔬", desc: "+5% Geschützschaden (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 3 },
    { id: "labHp", name: "Rumpfverstärkung", icon: "🏰", desc: "+5% Maximale Integrität (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 3 },
    { id: "labCash", name: "Handelsroute", icon: "📈", desc: "+5% Rohstoff-Gewinn (permanent)", baseCost: 5, costMult: 1.25, baseMinutes: 4 },
    { id: "labCoin", name: "Kristallraffinerie", icon: "🪙", desc: "+5% Kristall-Gewinn (permanent)", baseCost: 8, costMult: 1.3, baseMinutes: 8 },
    { id: "labStart", name: "Vorratslager", icon: "🏦", desc: "+25 Rohstoffe Startbonus (permanent)", baseCost: 4, costMult: 1.2, baseMinutes: 2 },
    { id: "labRegen", name: "Auto-Reparatur", icon: "⚙️", desc: "+5% Integritäts-Regeneration (permanent)", baseCost: 6, costMult: 1.25, baseMinutes: 5 },
  ];
  const RESEARCH_DURATION_MULT = 1.22; // per level, same spirit as costMult
  const MAX_RESEARCH_SECONDS = 4 * 3600; // cap a single project at 4h

  // Combat abilities: one active slot, equipped from whichever of these are
  // unlocked. None are free - every ability needs its unlock talent bought
  // first. baseCooldown is seconds.
  const ABILITY_DEFS = [
    { id: "nova", name: "Sonneneruption", icon: "💥", desc: "Flächenschaden auf alle Meteore in Reichweite", baseCooldown: 10 },
    { id: "shield", name: "Planetenschild", icon: "🛡️", desc: "Absorbiert Schaden für kurze Zeit", baseCooldown: 14 },
    { id: "slow", name: "Gravitationsfeld", icon: "🌀", desc: "Verlangsamt alle Meteore kurzzeitig deutlich", baseCooldown: 16 },
    { id: "chain", name: "Ionenkette", icon: "⚡", desc: "Schaden springt zwischen mehreren Meteoren", baseCooldown: 8 },
    { id: "repair", name: "Notreparatur", icon: "💚", desc: "Repariert den Planeten sofort um einen Anteil seiner Max-Integrität", baseCooldown: 20 },
  ];

  // Talente: bought with Kerne (earned via Aufstieg), survive an Aufstieg.
  // Entries with an `ability` field are one-time unlocks (maxLevel 1) for
  // the matching ABILITY_DEFS entry - equip/swap happens for free afterward.
  const TALENT_DEFS = [
    { id: "talentDmg", name: "Alien-Technologie", icon: "📜", desc: "+3% Geschützschaden (für immer)", baseCost: 3, costMult: 1.3 },
    { id: "talentCoin", name: "Kristallresonanz", icon: "🔮", desc: "+8% Kristall-Gewinn pro Run-Ende", baseCost: 3, costMult: 1.3 },
    { id: "talentStartCash", name: "Vorauskommando", icon: "🚀", desc: "+50 Rohstoffe Startkapital pro Run", baseCost: 2, costMult: 1.25 },
    { id: "talentCoreGain", name: "Aufstiegs-Erfahrung", icon: "✨", desc: "+5% Kerne pro Aufstieg", baseCost: 4, costMult: 1.35 },
    { id: "talentResearchSpeed", name: "Effiziente Forschung", icon: "⏱️", desc: "+5% Forschungstempo je Stufe", baseCost: 4, costMult: 1.3 },
    { id: "talentResearchSlots", name: "Parallele Forschung", icon: "🧬", desc: "+1 gleichzeitiges Forschungsprojekt (max. 3)", baseCost: 10, costMult: 2.2, maxLevel: 2 },
    { id: "talentAbilityNova", name: "Sonnen-Kern", icon: "💥", desc: "Schaltet die Fähigkeit Sonneneruption frei", baseCost: 3, costMult: 1, maxLevel: 1, ability: "nova" },
    { id: "talentAbilityShield", name: "Schild-Kern", icon: "🛡️", desc: "Schaltet die Fähigkeit Planetenschild frei", baseCost: 5, costMult: 1, maxLevel: 1, ability: "shield" },
    { id: "talentAbilitySlow", name: "Gravitations-Kern", icon: "🌀", desc: "Schaltet die Fähigkeit Gravitationsfeld frei", baseCost: 5, costMult: 1, maxLevel: 1, ability: "slow" },
    { id: "talentAbilityChain", name: "Ionen-Kern", icon: "⚡", desc: "Schaltet die Fähigkeit Ionenkette frei", baseCost: 6, costMult: 1, maxLevel: 1, ability: "chain" },
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

  // Total cost of buying `quantity` consecutive levels starting at `fromLevel`
  // (for the 1x/10x/100x bulk-buy toggle).
  function upgradeCostRange(def, fromLevel, quantity) {
    let total = 0;
    for (let i = 0; i < quantity; i++) total += upgradeCost(def, fromLevel + i);
    return total;
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
    upgradeCostRange,
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
