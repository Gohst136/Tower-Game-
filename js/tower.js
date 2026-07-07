// Derives effective tower stats from workshop levels + permanent lab levels. window.Tower
(function (global) {
  const BASE = {
    damage: 26,
    attackInterval: 0.55, // seconds between shots
    range: 150,
    maxHp: 100,
    regen: 1.0, // hp per second
  };

  const MIN_ATTACK_INTERVAL = 0.12;

  function effectiveStats(state) {
    const w = state.run.workshop;
    const lab = state.lab;
    const talents = state.talents || {};
    const lvl = (map, id) => State.getLevel(map, id);

    const dmgMult = Math.pow(1.08, lvl(w, "dmg")) * Math.pow(1.05, lvl(lab, "labDmg")) * Math.pow(1.03, lvl(talents, "talentDmg"));
    const atkMult = Math.pow(0.95, lvl(w, "atk"));
    const rangeBonus = lvl(w, "range") * 6;
    const hpMult = Math.pow(1.15, lvl(w, "hp")) * Math.pow(1.05, lvl(lab, "labHp"));
    const regenFlat = lvl(w, "regen") * 0.4;
    const regenMult = Math.pow(1.05, lvl(lab, "labRegen"));
    const cashMult = Math.pow(1.05, lvl(w, "cash")) * Math.pow(1.03, lvl(lab, "labCash"));
    const planet = State.activePlanetDef(state);
    const coinMult = Math.pow(1.05, lvl(lab, "labCoin")) * Math.pow(1.08, lvl(talents, "talentCoin")) * planet.coinMult;

    return {
      damage: BASE.damage * dmgMult,
      attackInterval: Utils.clamp(BASE.attackInterval * atkMult, MIN_ATTACK_INTERVAL, 10),
      range: BASE.range + rangeBonus,
      maxHp: BASE.maxHp * hpMult,
      regen: (BASE.regen + regenFlat) * regenMult,
      cashMult,
      coinMult,
      multishot: planet.multishot,
      spawnRateMult: planet.spawnRateMult,
      startingCash: lvl(lab, "labStart") * 25 + lvl(talents, "talentStartCash") * 50,
    };
  }

  global.Tower = { BASE, effectiveStats };
})(window);
