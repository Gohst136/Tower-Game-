// Core simulation loop. Live entities (enemies, effects) are NOT persisted -
// only the state.run summary (wave, cash, hp, levels) survives a reload.
// window.Game
(function (global) {
  const TOWER_RADIUS = 22;
  const RATE_WINDOW = 5; // seconds, for offline cash/sec estimate

  const Game = {
    state: null,
    entities: [],
    flashes: [],
    spawnQueue: [],
    spawnTimer: 0,
    attackCooldown: 0,
    time: 0,
    rateWindowCash: 0,
    rateWindowTime: 0,
    onWaveChange: null,
    onRunEnd: null,
    onCashChange: null,
    onHpChange: null,

    init(state) {
      this.state = state;
      // Live enemies can't be restored from a save, so always begin the
      // current wave fresh when the game boots (progress numbers are kept).
      this.spawnQueue = state.run.alive ? Enemies.waveComposition(state.run.wave) : [];
      this.entities = [];
      this.flashes = [];
      this.spawnTimer = 0;
      this.attackCooldown = 0;
    },

    startNewRun() {
      const s = this.state;
      const stats = Tower.effectiveStats(s);
      s.run = {
        wave: 1,
        cash: stats.startingCash,
        workshop: {},
        towerHp: stats.maxHp,
        towerMaxHp: stats.maxHp,
        waveTimer: 0,
        enemiesSpawned: 0,
        spawnTimer: 0,
        alive: true,
      };
      this.entities = [];
      this.flashes = [];
      this.spawnQueue = Enemies.waveComposition(1);
      this.spawnTimer = 0;
      this.attackCooldown = 0;
    },

    buyWorkshop(id) {
      const def = State.WORKSHOP_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(this.state.run.workshop, id);
      const cost = State.upgradeCost(def, level);
      if (this.state.run.cash < cost) return false;
      this.state.run.cash -= cost;
      this.state.run.workshop[id] = level + 1;
      if (id === "hp") {
        const newMax = Tower.effectiveStats(this.state).maxHp;
        const diff = newMax - this.state.run.towerMaxHp;
        this.state.run.towerMaxHp = newMax;
        this.state.run.towerHp = Math.min(newMax, this.state.run.towerHp + diff);
      }
      return true;
    },

    buyLab(id) {
      const def = State.LAB_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(this.state.lab, id);
      const cost = State.upgradeCost(def, level);
      if (this.state.coins < cost) return false;
      this.state.coins -= cost;
      this.state.lab[id] = level + 1;
      return true;
    },

    _advanceWave() {
      const s = this.state;
      s.run.wave += 1;
      this.spawnQueue = Enemies.waveComposition(s.run.wave);
      Sfx.playWaveStart();
      if (this.onWaveChange) this.onWaveChange(s.run.wave);
    },

    _endRun() {
      const s = this.state;
      s.bestWave = Math.max(s.bestWave, s.run.wave);
      const stats = Tower.effectiveStats(s);
      const wave = s.run.wave;
      let coinsEarned = Math.floor(Math.pow(Math.max(0, wave - 1), 1.4) * 0.5 * stats.coinMult);
      if (wave >= 4) coinsEarned = Math.max(1, coinsEarned);
      s.coins += coinsEarned;
      s.totalCoinsEarned += coinsEarned;
      s.runsCompleted += 1;
      s.run.alive = false;
      this.entities = [];
      this.flashes = [];
      this.spawnQueue = [];
      Sfx.playGameOver();
      if (this.onRunEnd) this.onRunEnd(wave, coinsEarned);
      return coinsEarned;
    },

    update(dt) {
      const s = this.state;
      this.time += dt;
      if (!s.run || !s.run.alive) return;

      const stats = Tower.effectiveStats(s);
      const cx = 0, cy = 0; // world space is tower-centered

      // --- spawning ---
      this.spawnTimer -= dt;
      if (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
        const type = this.spawnQueue.shift();
        this.entities.push(this._spawnEnemy(type, s.run.wave));
        this.spawnTimer = Enemies.spawnIntervalForWave(s.run.wave);
      }

      // --- movement & impacts ---
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const dx = cx - e.x, dy = cy - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= TOWER_RADIUS + e.radius) {
          s.run.towerHp -= e.damage;
          this.entities.splice(i, 1);
          Sfx.playImpact();
          continue;
        }
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      }

      // --- regen ---
      s.run.towerHp = Math.min(s.run.towerMaxHp, s.run.towerHp + stats.regen * dt);

      // --- attack ---
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && this.entities.length > 0) {
        let target = null, best = Infinity;
        for (const e of this.entities) {
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d <= stats.range && d < best) { best = d; target = e; }
        }
        if (target) {
          target.hp -= stats.damage;
          this.flashes.push({ x: target.x, y: target.y, alpha: 1 });
          Sfx.playShot();
          if (target.hp <= 0) {
            const idx = this.entities.indexOf(target);
            if (idx >= 0) this.entities.splice(idx, 1);
            const cashGain = target.cash * stats.cashMult;
            s.run.cash += cashGain;
            s.totalKills += 1;
            this.rateWindowCash += cashGain;
            Sfx.playKill(target.type);
          }
        }
        this.attackCooldown = stats.attackInterval;
      }

      // --- fade flashes ---
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        this.flashes[i].alpha -= dt * 6;
        if (this.flashes[i].alpha <= 0) this.flashes.splice(i, 1);
      }

      // --- rate tracking for offline estimate ---
      this.rateWindowTime += dt;
      if (this.rateWindowTime >= RATE_WINDOW) {
        s.recentCashPerSecond = this.rateWindowCash / this.rateWindowTime;
        this.rateWindowCash = 0;
        this.rateWindowTime = 0;
      }

      // --- wave complete? ---
      if (this.spawnQueue.length === 0 && this.entities.length === 0) {
        this._advanceWave();
      }

      // --- death? ---
      if (s.run.towerHp <= 0) {
        s.run.towerHp = 0;
        const coinsEarned = this._endRun();
        if (s.autoRestart) {
          this.startNewRun();
        }
      }
    },

    _spawnEnemy(type, wave) {
      const stats = Enemies.statsForWave(type, wave);
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = this._spawnRadius || 220;
      return {
        type,
        color: stats.color,
        radius: stats.radius,
        speed: stats.speed,
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        damage: stats.damage,
        cash: stats.cash,
        x: Math.cos(angle) * spawnRadius,
        y: Math.sin(angle) * spawnRadius,
      };
    },

    setSpawnRadius(r) {
      this._spawnRadius = r;
    },

    // Returns entities/flashes translated into screen-space for the renderer.
    worldForRender(width, height) {
      const cx = width / 2, cy = height / 2;
      return {
        time: this.time,
        range: Tower.effectiveStats(this.state).range,
        enemies: this.entities.map((e) => ({ ...e, x: e.x + cx, y: e.y + cy })),
        flashes: this.flashes.map((f) => ({ ...f, x: f.x + cx, y: f.y + cy })),
      };
    },
  };

  global.Game = Game;
})(window);
