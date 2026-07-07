// Enemy type definitions, per-wave scaling and spawn composition. window.Enemies
(function (global) {
  // Planet Defender: regular enemies are meteors/comet debris, bosses are
  // alien motherships. `shape` selects the procedural silhouette Render
  // draws (see render.js) - purely visual, doesn't affect gameplay.
  const TYPES = {
    grunt: { label: "Meteor", baseHp: 22, baseDmg: 3, baseSpeed: 42, baseCash: 1, radius: 9, color: "#a08a73", shape: "rock" },
    runner: { label: "Kometensplitter", baseHp: 12, baseDmg: 2, baseSpeed: 78, baseCash: 1.3, radius: 7, color: "#bdeeff", shape: "comet" },
    tank: { label: "Asteroidenbrocken", baseHp: 70, baseDmg: 6, baseSpeed: 24, baseCash: 2.2, radius: 13, color: "#6b5c4f", shape: "rock" },
    shielded: { label: "Kristallmeteor", baseHp: 26, baseDmg: 4, baseSpeed: 32, baseCash: 1.8, radius: 10, color: "#c98cff", shieldRatio: 0.6, shape: "crystal" },
    splitter: { label: "Spaltmeteor", baseHp: 30, baseDmg: 3, baseSpeed: 46, baseCash: 1.3, radius: 10, color: "#ffb347", shape: "fracture" },
    boss: { label: "Alien-Mutterschiff", baseHp: 500, baseDmg: 18, baseSpeed: 20, baseCash: 25, radius: 20, color: "#ff5f7a", shape: "ship" },
  };

  const HP_GROWTH = 1.13;
  const DMG_GROWTH = 1.1;
  const CASH_GROWTH = 1.12;
  // The mothership visibly grows across its first several appearances (it
  // only spawns every 10th wave), then plateaus so it never overwhelms the
  // screen or gets absurdly easy to hit.
  const BOSS_RADIUS_GROWTH = 1.02;
  const BOSS_RADIUS_CAP_MULT = 5;

  // Random modifier rolled for elite waves; applied on top of normal scaling.
  const ELITE_MODIFIERS = [
    { id: "rush", label: "Ansturm", icon: "wind", speedMult: 1.5, cashMult: 1.4 },
    { id: "armored", label: "Gepanzert", icon: "shield", hpMult: 1.6, cashMult: 1.4 },
    { id: "berserker", label: "Berserker", icon: "flame", dmgMult: 1.6, cashMult: 1.4 },
    { id: "swarm", label: "Schwarm", icon: "bee", countMult: 1.5, spawnIntervalMult: 0.7, cashMult: 1.3 },
  ];
  const ELITE_INTERVAL = 12;

  function isEliteWave(wave) {
    return wave % ELITE_INTERVAL === 0;
  }

  function pickEliteModifier() {
    return ELITE_MODIFIERS[Math.floor(Math.random() * ELITE_MODIFIERS.length)];
  }

  function statsForWave(type, wave, elite) {
    const def = TYPES[type];
    const w = Math.max(0, wave - 1);
    const hpMult = (elite && elite.hpMult) || 1;
    const dmgMult = (elite && elite.dmgMult) || 1;
    const speedMult = (elite && elite.speedMult) || 1;
    const maxHp = def.baseHp * Math.pow(HP_GROWTH, w) * hpMult;
    const stats = {
      type,
      label: def.label,
      radius: def.radius,
      color: def.color,
      shape: def.shape,
      speed: def.baseSpeed * speedMult,
      maxHp,
      damage: def.baseDmg * Math.pow(DMG_GROWTH, w) * dmgMult,
      cash: def.baseCash * Math.pow(CASH_GROWTH, w),
    };
    if (def.shieldRatio) stats.shieldHp = maxHp * def.shieldRatio;
    if (type === "boss") {
      stats.radius = def.radius * Math.min(Math.pow(BOSS_RADIUS_GROWTH, w), BOSS_RADIUS_CAP_MULT);
    }
    return stats;
  }

  // Returns an array of type-strings describing the spawn order for this wave.
  function waveComposition(wave, elite) {
    const isBossWave = wave % 10 === 0;
    const countMult = (elite && elite.countMult) || 1;
    const count = Math.round(Utils.clamp(6 + Math.floor(wave * 1.4), 6, 45) * countMult);
    const queue = [];

    if (isBossWave) queue.push("boss");

    const runnerChance = Utils.clamp(0.15 + wave * 0.01, 0.15, 0.35);
    const tankChance = Utils.clamp(0.1 + wave * 0.008, 0.1, 0.25);
    const shieldChance = wave >= 6 ? Utils.clamp(0.06 + wave * 0.004, 0.06, 0.18) : 0;
    const splitterChance = wave >= 9 ? Utils.clamp(0.06 + wave * 0.004, 0.06, 0.18) : 0;

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      let acc = 0;
      if (r < (acc += tankChance)) queue.push("tank");
      else if (r < (acc += runnerChance)) queue.push("runner");
      else if (r < (acc += shieldChance)) queue.push("shielded");
      else if (r < (acc += splitterChance)) queue.push("splitter");
      else queue.push("grunt");
    }
    return queue;
  }

  function spawnIntervalForWave(wave, elite) {
    const base = Utils.clamp(0.9 - wave * 0.012, 0.22, 0.9);
    return base * ((elite && elite.spawnIntervalMult) || 1);
  }

  global.Enemies = {
    TYPES,
    ELITE_MODIFIERS,
    statsForWave,
    waveComposition,
    spawnIntervalForWave,
    isEliteWave,
    pickEliteModifier,
  };
})(window);
