// Enemy type definitions, per-wave scaling and spawn composition. window.Enemies
(function (global) {
  const TYPES = {
    grunt: { label: "Grunt", baseHp: 22, baseDmg: 3, baseSpeed: 42, baseCash: 1, radius: 9, color: "#7ea8ff" },
    runner: { label: "Runner", baseHp: 12, baseDmg: 2, baseSpeed: 78, baseCash: 1.3, radius: 7, color: "#7bf0d0" },
    tank: { label: "Tank", baseHp: 70, baseDmg: 6, baseSpeed: 24, baseCash: 2.2, radius: 13, color: "#c98cff" },
    boss: { label: "Boss", baseHp: 500, baseDmg: 18, baseSpeed: 20, baseCash: 25, radius: 20, color: "#ff6161" },
  };

  const HP_GROWTH = 1.13;
  const DMG_GROWTH = 1.1;
  const CASH_GROWTH = 1.12;

  function statsForWave(type, wave) {
    const def = TYPES[type];
    const w = Math.max(0, wave - 1);
    return {
      type,
      label: def.label,
      radius: def.radius,
      color: def.color,
      speed: def.baseSpeed,
      maxHp: def.baseHp * Math.pow(HP_GROWTH, w),
      damage: def.baseDmg * Math.pow(DMG_GROWTH, w),
      cash: def.baseCash * Math.pow(CASH_GROWTH, w),
    };
  }

  // Returns an array of type-strings describing the spawn order for this wave.
  function waveComposition(wave) {
    const isBossWave = wave % 10 === 0;
    const count = Utils.clamp(6 + Math.floor(wave * 1.4), 6, 45);
    const queue = [];

    if (isBossWave) queue.push("boss");

    const runnerChance = Utils.clamp(0.15 + wave * 0.01, 0.15, 0.4);
    const tankChance = Utils.clamp(0.1 + wave * 0.008, 0.1, 0.3);

    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (r < tankChance) queue.push("tank");
      else if (r < tankChance + runnerChance) queue.push("runner");
      else queue.push("grunt");
    }
    return queue;
  }

  function spawnIntervalForWave(wave) {
    return Utils.clamp(0.9 - wave * 0.012, 0.22, 0.9);
  }

  global.Enemies = { TYPES, statsForWave, waveComposition, spawnIntervalForWave };
})(window);
