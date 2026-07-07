// Core simulation loop. Live entities (enemies, effects) are NOT persisted -
// only the state.run summary (wave, cash, hp, levels) survives a reload.
// window.Game
(function (global) {
  const TOWER_RADIUS = 22;
  const RATE_WINDOW = 5; // seconds, for offline cash/sec estimate
  const NOVA_COOLDOWN = 10; // seconds
  const NOVA_DAMAGE_MULT = 5; // relative to a single normal shot
  // Enemies always spawn this many world-units beyond the tower's current
  // range, so the "approach phase" before an enemy becomes attackable stays
  // a constant duration no matter how much Range has been upgraded. The
  // render layer zooms out to keep this ever-growing world radius fitting
  // the fixed screen size (see _zoomScale).
  const RANGE_SPAWN_BUFFER = 60;
  const MIN_ZOOM = 0.32;

  const Game = {
    state: null,
    entities: [],
    flashes: [],
    particles: [],
    novaRings: [],
    spawnQueue: [],
    spawnTimer: 0,
    attackCooldown: 0,
    novaCooldown: 0,
    novaCooldownMax: NOVA_COOLDOWN,
    shake: 0,
    time: 0,
    currentElite: null,
    rateWindowCash: 0,
    rateWindowTime: 0,
    onWaveChange: null,
    onRunEnd: null,
    onCashChange: null,
    onHpChange: null,
    onEliteStart: null,
    onAchievement: null,
    onResearchComplete: null,

    init(state) {
      this.state = state;
      // Live enemies can't be restored from a save, so always begin the
      // current wave fresh when the game boots (progress numbers are kept).
      this.currentElite = state.run.alive && Enemies.isEliteWave(state.run.wave) ? Enemies.pickEliteModifier() : null;
      this.spawnQueue = state.run.alive ? Enemies.waveComposition(state.run.wave, this.currentElite) : [];
      this.entities = [];
      this.flashes = [];
      this.particles = [];
      this.novaRings = [];
      this.spawnTimer = 0;
      this.attackCooldown = 0;
      this.novaCooldown = 0;
      this.shake = 0;
      this.checkAchievements();
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
      this.particles = [];
      this.novaRings = [];
      this.currentElite = null;
      this.spawnQueue = Enemies.waveComposition(1, null);
      this.spawnTimer = 0;
      this.attackCooldown = 0;
      this.novaCooldown = 0;
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

    // Starts a timed research project (one slot). Costs Coins up front;
    // the level only applies once checkResearch() sees it has elapsed -
    // including while the game was closed, since it's a plain timestamp check.
    startResearch(id) {
      const s = this.state;
      if (s.research) return false; // slot busy
      const def = State.LAB_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(s.lab, id);
      const cost = State.upgradeCost(def, level);
      if (s.coins < cost) return false;
      s.coins -= cost;
      s.research = { id, startedAt: Date.now(), durationMs: State.researchDurationMs(def, level) };
      return true;
    },

    // Independent of run state (also runs during game-over / idle screens).
    // Returns the completed def if a project just finished, else null.
    checkResearch() {
      const s = this.state;
      if (!s.research) return null;
      if (Date.now() < s.research.startedAt + s.research.durationMs) return null;
      const def = State.LAB_DEFS.find((d) => d.id === s.research.id);
      const level = State.getLevel(s.lab, s.research.id);
      s.lab[s.research.id] = level + 1;
      s.research = null;
      if (this.onResearchComplete && def) this.onResearchComplete(def, level + 1);
      return def;
    },

    buyTalent(id) {
      const def = State.TALENT_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(this.state.talents, id);
      const cost = State.upgradeCost(def, level);
      if (this.state.cores < cost) return false;
      this.state.cores -= cost;
      this.state.talents[id] = level + 1;
      return true;
    },

    // Deep reset: trades accumulated Coins + Lab levels for a lasting Cores
    // currency spent on Talents, which survive future Ascensions. Returns
    // the number of Cores earned, or 0 if nothing new was available yet.
    ascend() {
      const s = this.state;
      const cores = State.pendingCores(s);
      if (cores <= 0) return 0;
      s.cores += cores;
      s.coinsAtLastAscend = s.totalCoinsEarned;
      s.ascensionCount = (s.ascensionCount || 0) + 1;
      s.coins = 0;
      s.lab = {};
      s.research = null;
      this.startNewRun();
      this.checkAchievements();
      return cores;
    },

    _advanceWave() {
      const s = this.state;
      s.run.wave += 1;
      this.currentElite = Enemies.isEliteWave(s.run.wave) ? Enemies.pickEliteModifier() : null;
      this.spawnQueue = Enemies.waveComposition(s.run.wave, this.currentElite);
      if (this.currentElite) {
        Sfx.playEliteStart();
        if (this.onEliteStart) this.onEliteStart(this.currentElite, s.run.wave);
      } else {
        Sfx.playWaveStart();
      }
      if (this.onWaveChange) this.onWaveChange(s.run.wave);
      this.checkAchievements();
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
      this.checkAchievements();
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
        this.entities.push(this._spawnEnemy(type, s.run.wave, stats, this.currentElite));
        this.spawnTimer = Enemies.spawnIntervalForWave(s.run.wave, this.currentElite);
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
          this.shake = Math.min(10, this.shake + 3);
          continue;
        }
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      }

      // --- boss ranged attacks (poke the tower from a distance, not just on contact) ---
      for (const e of this.entities) {
        if (e.type !== "boss") continue;
        e.rangedCooldown -= dt;
        if (e.rangedCooldown <= 0) {
          s.run.towerHp -= e.rangedDamage;
          this.flashes.push({ x: e.x, y: e.y, alpha: 1, color: "#ff6161" });
          Sfx.playBossShot();
          this.shake = Math.min(10, this.shake + 4);
          e.rangedCooldown = e.rangedInterval;
        }
      }

      // --- regen ---
      s.run.towerHp = Math.min(s.run.towerMaxHp, s.run.towerHp + stats.regen * dt);

      // --- attack ---
      this.attackCooldown -= dt;
      if (this.attackCooldown <= 0 && this.entities.length > 0) {
        const target = this._pickTarget(stats);
        if (target) {
          this._applyDamage(target, stats.damage);
          this.flashes.push({ x: target.x, y: target.y, alpha: 1 });
          Sfx.playShot();
          if (target.hp <= 0) this._killEnemy(target, stats);
        }
        this.attackCooldown = stats.attackInterval;
      }

      // --- nova cooldown ---
      if (this.novaCooldown > 0) this.novaCooldown = Math.max(0, this.novaCooldown - dt);

      // --- fade flashes ---
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        this.flashes[i].alpha -= dt * 6;
        if (this.flashes[i].alpha <= 0) this.flashes.splice(i, 1);
      }

      // --- particles ---
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }

      // --- nova shockwave rings ---
      for (let i = this.novaRings.length - 1; i >= 0; i--) {
        const r = this.novaRings[i];
        r.radius += 340 * dt;
        r.alpha -= dt * 1.6;
        if (r.alpha <= 0) this.novaRings.splice(i, 1);
      }

      // --- screen shake decay ---
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 24);

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

    _pickTarget(stats) {
      const mode = this.state.targetMode || "nearest";
      let target = null;
      let bestScore = mode === "strongest" ? -Infinity : Infinity;
      for (const e of this.entities) {
        const d = Math.hypot(e.x, e.y);
        if (d > stats.range) continue;
        const score = mode === "nearest" ? d : mode === "strongest" ? e.maxHp : e.hp;
        const better = mode === "strongest" ? score > bestScore : score < bestScore;
        if (better) { bestScore = score; target = e; }
      }
      return target;
    },

    _applyDamage(target, amount) {
      if (target.shieldHp > 0) {
        if (amount <= target.shieldHp) {
          target.shieldHp -= amount;
          return;
        }
        const remainder = amount - target.shieldHp;
        target.shieldHp = 0;
        target.hp -= remainder;
      } else {
        target.hp -= amount;
      }
    },

    _killEnemy(target, stats) {
      const s = this.state;
      const idx = this.entities.indexOf(target);
      if (idx >= 0) this.entities.splice(idx, 1);
      const eliteCashMult = (this.currentElite && this.currentElite.cashMult) || 1;
      const cashGain = target.cash * stats.cashMult * eliteCashMult;
      s.run.cash += cashGain;
      s.totalKills += 1;
      this.rateWindowCash += cashGain;
      Sfx.playKill(target.type);
      this._spawnParticles(target.x, target.y, target.color);
      if (target.type === "boss") {
        this.shake = Math.min(10, this.shake + 6);
        s.bossKills = (s.bossKills || 0) + 1;
      }
      if (target.type === "splitter" && !target.isSplitChild) this._spawnSplitChildren(target);
      this.checkAchievements();
    },

    _spawnSplitChildren(target) {
      for (let i = 0; i < 2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const offset = 14;
        this.entities.push({
          type: "splitter",
          isSplitChild: true,
          color: target.color,
          radius: Math.max(4, target.radius * 0.65),
          speed: target.speed * 1.1,
          maxHp: target.maxHp * 0.4,
          hp: target.maxHp * 0.4,
          damage: target.damage * 0.5,
          cash: target.cash * 0.4,
          x: target.x + Math.cos(angle) * offset,
          y: target.y + Math.sin(angle) * offset,
        });
      }
    },

    _spawnParticles(x, y, color) {
      const count = 6;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 60 + Math.random() * 80;
        this.particles.push({
          x, y, color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.35 + Math.random() * 0.2,
          maxLife: 0.5,
        });
      }
    },

    novaReady() {
      return this.novaCooldown <= 0 && this.state && this.state.run.alive;
    },

    activateNova() {
      if (!this.novaReady()) return false;
      const s = this.state;
      const stats = Tower.effectiveStats(s);
      const novaDamage = stats.damage * NOVA_DAMAGE_MULT;
      const novaRadius = stats.range * 1.5;
      const targets = this.entities.filter((e) => Math.hypot(e.x, e.y) <= novaRadius);
      targets.forEach((e) => {
        this._applyDamage(e, novaDamage);
        this.flashes.push({ x: e.x, y: e.y, alpha: 1 });
        if (e.hp <= 0) this._killEnemy(e, stats);
      });
      this.novaRings.push({ x: 0, y: 0, radius: 10, alpha: 1 });
      this.shake = Math.min(14, this.shake + 10);
      Sfx.playNova();
      this.novaCooldown = NOVA_COOLDOWN;
      return true;
    },

    _spawnEnemy(type, wave, stats, elite) {
      const enemyStats = Enemies.statsForWave(type, wave, elite);
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = this._worldRadius(stats);
      const entity = {
        type,
        color: enemyStats.color,
        radius: enemyStats.radius,
        speed: enemyStats.speed,
        maxHp: enemyStats.maxHp,
        hp: enemyStats.maxHp,
        damage: enemyStats.damage,
        cash: enemyStats.cash,
        x: Math.cos(angle) * spawnRadius,
        y: Math.sin(angle) * spawnRadius,
      };
      if (enemyStats.shieldHp) {
        entity.shieldHp = enemyStats.shieldHp;
        entity.maxShieldHp = enemyStats.shieldHp;
      }
      if (type === "boss") {
        entity.rangedCooldown = 3;
        entity.rangedInterval = 3.5;
        entity.rangedDamage = enemyStats.damage * 0.6;
      }
      return entity;
    },

    checkAchievements() {
      // Fleshed out once Achievements.DEFS exists; safe no-op until then.
      if (global.Achievements) global.Achievements.check(this.state, (a) => { if (this.onAchievement) this.onAchievement(a); });
    },

    setCanvasSize(width, height) {
      this.canvasSize = { width, height };
    },

    _availableScreenRadius() {
      const size = this.canvasSize || { width: 390, height: 600 };
      return Math.min(size.width, size.height) / 2 - 10;
    },

    _worldRadius(stats) {
      return stats.range + RANGE_SPAWN_BUFFER;
    },

    _zoomScale(stats) {
      const zoom = this._availableScreenRadius() / this._worldRadius(stats);
      return Utils.clamp(zoom, MIN_ZOOM, 1);
    },

    // Returns entities/flashes translated into screen-space for the renderer.
    worldForRender(width, height) {
      this.setCanvasSize(width, height);
      const stats = Tower.effectiveStats(this.state);
      const zoom = this._zoomScale(stats);
      const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      const cx = width / 2 + shakeX, cy = height / 2 + shakeY;
      const toScreen = (x, y) => ({ x: cx + x * zoom, y: cy + y * zoom });
      const boss = this.entities.find((e) => e.type === "boss");
      return {
        time: this.time,
        cx, cy,
        zoom,
        towerRadius: TOWER_RADIUS * zoom,
        range: stats.range * zoom,
        elite: this.currentElite,
        boss: boss ? { hp: boss.hp, maxHp: boss.maxHp } : null,
        enemies: this.entities.map((e) => ({ ...e, ...toScreen(e.x, e.y), radius: Math.max(3, e.radius * zoom) })),
        flashes: this.flashes.map((f) => ({ ...f, ...toScreen(f.x, f.y) })),
        particles: this.particles.map((p) => ({ ...p, ...toScreen(p.x, p.y), alpha: Math.max(0, p.life / p.maxLife) })),
        novaRings: this.novaRings.map((r) => ({ ...r, ...toScreen(r.x, r.y), radius: r.radius * zoom })),
      };
    },
  };

  global.Game = Game;
})(window);
