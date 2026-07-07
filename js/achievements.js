// Milestone achievements with one-time coin rewards. window.Achievements
(function (global) {
  const DEFS = [
    { id: "wave10", label: "Erste Welle 10", icon: "🌊", reward: 5, condition: (s) => Math.max(s.bestWave, s.run.wave) >= 10 },
    { id: "wave25", label: "Welle 25 erreicht", icon: "🌊", reward: 10, condition: (s) => Math.max(s.bestWave, s.run.wave) >= 25 },
    { id: "wave50", label: "Welle 50 erreicht", icon: "🌊", reward: 20, condition: (s) => Math.max(s.bestWave, s.run.wave) >= 50 },
    { id: "wave100", label: "Welle 100 erreicht", icon: "🌊", reward: 50, condition: (s) => Math.max(s.bestWave, s.run.wave) >= 100 },
    { id: "kills1000", label: "1.000 Kills", icon: "💀", reward: 10, condition: (s) => s.totalKills >= 1000 },
    { id: "kills10000", label: "10.000 Kills", icon: "💀", reward: 25, condition: (s) => s.totalKills >= 10000 },
    { id: "firstBoss", label: "Erster Boss besiegt", icon: "👑", reward: 8, condition: (s) => (s.bossKills || 0) >= 1 },
    { id: "boss10", label: "10 Bosse besiegt", icon: "👑", reward: 20, condition: (s) => (s.bossKills || 0) >= 10 },
    { id: "runs10", label: "10 Runs gespielt", icon: "🔁", reward: 10, condition: (s) => s.runsCompleted >= 10 },
    { id: "runs100", label: "100 Runs gespielt", icon: "🔁", reward: 30, condition: (s) => s.runsCompleted >= 100 },
    { id: "firstAscend", label: "Erster Aufstieg", icon: "⭐", reward: 15, condition: (s) => (s.ascensionCount || 0) >= 1 },
  ];

  // Unlocks any newly-qualified achievements, grants their coin reward, and
  // invokes onUnlock(def) for each one so the UI can toast it.
  function check(state, onUnlock) {
    if (!state.achievements) state.achievements = {};
    DEFS.forEach((def) => {
      if (state.achievements[def.id]) return;
      if (!def.condition(state)) return;
      state.achievements[def.id] = true;
      state.coins += def.reward;
      state.totalCoinsEarned += def.reward;
      if (onUnlock) onUnlock(def);
    });
  }

  global.Achievements = { DEFS, check };
})(window);
