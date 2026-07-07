// Core simulation loop. Live entities (enemies, effects) are NOT persisted -
// only the state.run summary (wave, cash, hp, levels) survives a reload.
// window.Game
(function (global) {
  const TOWER_RADIUS = 22;
  const RATE_WINDOW = 5; // seconds, for offline cash/sec estimate
  // Per-ability tuning. Conservative starting values, same spirit as the
  // rest of the numeric content added this session - worth revisiting
  // alongside the general balance pass.
  const ABILITY_TUNING = {
    nova: { damageMult: 5, radiusMult: 1.5 },
    shield: { shieldPctOfMaxHp: 0.5, durationSec: 6 },
    slow: { factor: 0.45, durationSec: 5 },
    chain: { damageMult: 3, maxJumps: 4, falloff: 0.85, jumpRangeMult: 2 },
    repair: { healPct: 0.35 },
  };
  // Enemies always spawn this many world-units beyond the tower's current
  // range, so the "approach phase" before an enemy becomes attackable stays
  // a constant duration no matter how much Range has been upgraded. The
  // render layer zooms out to keep this ever-growing world radius fitting
  // the fixed screen size (see _zoomScale).
  const RANGE_SPAWN_BUFFER = 60;
  // Floor for how small on-screen sprites are allowed to get once zoom has
  // shrunk a lot (extreme Range levels) - keeps them visible/tappable
  // instead of vanishing, without capping the zoom math itself (that used
  // to make enemies spawn outside the visible circle once Range grew past
  // whatever radius the old fixed MIN_ZOOM could still fit on screen).
  const MIN_SPRITE_PX = 3;
  const MIN_TOWER_PX = 8;

  const Game = {
    state: null,
    entities: [],
    flashes: [],
    particles: [],
    rings: [], // generic expanding-ring effect, used by several abilities
    chainLines: [], // chain-lightning bolt segments
    spawnQueue: [],
    spawnTimer: 0,
    attackCooldown: 0,
    abilityCooldownRemaining: 0,
    towerShield: 0,
    shieldExpiresAt: 0,
    slowUntil: 0,
    slowFactor: 1,
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
      this.rings = [];
      this.chainLines = [];
      this.spawnTimer = 0;
      this.attackCooldown = 0;
      this.abilityCooldownRemaining = 0;
      this.towerShield = 0;
      this.shieldExpiresAt = 0;
      this.slowUntil = 0;
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
      this.rings = [];
      this.chainLines = [];
      this.currentElite = null;
      this.spawnQueue = Enemies.waveComposition(1, null);
      this.spawnTimer = 0;
      this.attackCooldown = 0;
      this.abilityCooldownRemaining = 0;
      this.towerShield = 0;
      this.shieldExpiresAt = 0;
      this.slowUntil = 0;
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

    // Buys up to `quantity` consecutive levels (1x/10x/100x toggle in the
    // Werkstatt). Stops early if a purchase fails - but since the UI only
    // enables the button when the full batch is affordable, that only
    // happens if something else changed cash mid-click. Returns the count
    // actually bought.
    buyWorkshopMultiple(id, quantity) {
      let bought = 0;
      for (let i = 0; i < quantity; i++) {
        if (!this.buyWorkshop(id)) break;
        bought++;
      }
      return bought;
    },

    // Starts a timed research project in a free slot (up to
    // State.maxResearchSlots(talents), unlocked via talentResearchSlots).
    // Costs Coins up front; the level only applies once checkResearch() sees
    // it has elapsed - including while the game was closed, since it's a
    // plain timestamp check. Each Lab category can only run once at a time.
    startResearch(id) {
      const s = this.state;
      const maxSlots = State.maxResearchSlots(s.talents);
      if (s.research.length >= maxSlots) return false;
      if (s.research.some((r) => r.id === id)) return false;
      const def = State.LAB_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(s.lab, id);
      const cost = State.upgradeCost(def, level);
      if (s.coins < cost) return false;
      s.coins -= cost;
      const speedMult = State.researchSpeedMult(s.talents);
      s.research.push({ id, startedAt: Date.now(), durationMs: State.researchDurationMs(def, level, speedMult) });
      return true;
    },

    // Independent of run state (also runs during game-over / idle screens).
    // Returns the array of defs that just completed (usually 0 or 1 entries).
    checkResearch() {
      const s = this.state;
      const now = Date.now();
      const completed = [];
      s.research = s.research.filter((r) => {
        if (now < r.startedAt + r.durationMs) return true;
        const def = State.LAB_DEFS.find((d) => d.id === r.id);
        const level = State.getLevel(s.lab, r.id);
        s.lab[r.id] = level + 1;
        if (def) completed.push({ def, level: level + 1 });
        return false;
      });
      completed.forEach(({ def, level }) => {
        if (this.onResearchComplete) this.onResearchComplete(def, level);
      });
      return completed;
    },

    buyTalent(id) {
      const def = State.TALENT_DEFS.find((d) => d.id === id);
      if (!def) return false;
      const level = State.getLevel(this.state.talents, id);
      if (def.maxLevel !== undefined && level >= def.maxLevel) return false;
      const cost = State.upgradeCost(def, level);
      if (this.state.cores < cost) return false;
      this.state.cores -= cost;
      this.state.talents[id] = level + 1;
      // First-time ability unlock: auto-equip if nothing is equipped yet,
      // so a brand-new unlock doesn't just sit there unused.
      if (def.ability && level === 0 && !this.state.equippedAbility) {
        this.equipAbility(def.ability);
      }
      return true;
    },

    equipAbility(id) {
      if (!State.isAbilityUnlocked(id, this.state.talents)) return false;
      this.state.equippedAbility = id;
      this.abilityCooldownRemaining = 0;
      return true;
    },

    unlockedAbilities() {
      return State.ABILITY_DEFS.filter((d) => State.isAbilityUnlocked(d.id, this.state.talents));
    },

    selectPlanet(id) {
      const def = State.PLANET_DEFS.find((d) => d.id === id);
      if (!def || !State.isPlanetUnlocked(def, this.state)) return false;
      this.state.activePlanet = id;
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
      s.research = [];
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
      this.towerShield = 0;
      this.slowUntil = 0;
      Sfx.playGameOver();
      this.checkAchievements();
      if (this.onRunEnd) this.onRunEnd(wave, coinsEarned);
      return coinsEarned;
    },

    // Lets the player cash out early instead of waiting to die - same
    // Kristalle payout formula as a normal death, just player-triggered.
    endRun() {
      if (!this.state.run.alive) return 0;
      return this._endRun();
    },

    update(dt) {
      const s = this.state;
      // Chronobeschleuniger talent: uniformly speeds up the whole simulation.
      dt *= State.gameSpeedMult(s.talents);
      this.time += dt;
      if (!s.run || !s.run.alive) return;

      const stats = Tower.effectiveStats(s);
      const cx = 0, cy = 0; // world space is tower-centered

      // --- spawning --- (while-loop so high speed levels don't get
      // throttled to one spawn per rendered frame)
      this.spawnTimer -= dt;
      while (this.spawnQueue.length > 0 && this.spawnTimer <= 0) {
        const type = this.spawnQueue.shift();
        this.entities.push(this._spawnEnemy(type, s.run.wave, stats, this.currentElite));
        this.spawnTimer += Enemies.spawnIntervalForWave(s.run.wave, this.currentElite) * stats.spawnRateMult;
      }

      // --- movement & impacts ---
      const speedFactor = this.time < this.slowUntil ? this.slowFactor : 1;
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const dx = cx - e.x, dy = cy - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist <= TOWER_RADIUS + e.radius) {
          this._damageTower(e.damage);
          this.entities.splice(i, 1);
          Sfx.playImpact();
          this.shake = Math.min(10, this.shake + 3);
          continue;
        }
        e.x += (dx / dist) * e.speed * speedFactor * dt;
        e.y += (dy / dist) * e.speed * speedFactor * dt;
        e.spin += e.spinSpeed * dt;
      }

      // --- boss ranged attacks (poke the tower from a distance, not just on contact) ---
      for (const e of this.entities) {
        if (e.type !== "boss") continue;
        e.rangedCooldown -= dt;
        if (e.rangedCooldown <= 0) {
          this._damageTower(e.rangedDamage);
          this.flashes.push({ x: e.x, y: e.y, alpha: 1, color: "#ff6161" });
          Sfx.playBossShot();
          this.shake = Math.min(10, this.shake + 4);
          e.rangedCooldown = e.rangedInterval;
        }
      }

      // --- shield decay ---
      if (this.towerShield > 0 && this.time > this.shieldExpiresAt) this.towerShield = 0;

      // --- regen ---
      s.run.towerHp = Math.min(s.run.towerMaxHp, s.run.towerHp + stats.regen * dt);

      // --- attack --- (while-loop, same reasoning as spawning above)
      this.attackCooldown -= dt;
      while (this.attackCooldown <= 0 && this.entities.length > 0) {
        const targets = this._pickTargets(stats, stats.multishot);
        for (const target of targets) {
          this._applyDamage(target, stats.damage);
          this.flashes.push({ x: target.x, y: target.y, alpha: 1 });
          if (target.hp <= 0) this._killEnemy(target, stats);
        }
        if (targets.length > 0) Sfx.playShot();
        this.attackCooldown += stats.attackInterval;
      }

      // --- ability cooldown ---
      if (this.abilityCooldownRemaining > 0) this.abilityCooldownRemaining = Math.max(0, this.abilityCooldownRemaining - dt);

      // --- fade flashes ---
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        this.flashes[i].alpha -= dt * 6;
        if (this.flashes[i].alpha <= 0) this.flashes.splice(i, 1);
      }

      // --- fade chain-lightning bolts ---
      for (let i = this.chainLines.length - 1; i >= 0; i--) {
        this.chainLines[i].alpha -= dt * 5;
        if (this.chainLines[i].alpha <= 0) this.chainLines.splice(i, 1);
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

      // --- generic expanding rings (nova/slow/repair pulses) ---
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.radius += r.growth * dt;
        r.alpha -= dt * 1.6;
        if (r.alpha <= 0) this.rings.splice(i, 1);
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

    // Returns up to `count` in-range entities ordered by the active target
    // mode (nearest/strongest/weakest first) - `count` is 1 outside of the
    // multishot Planeten perk, so this also replaces the old single-target
    // picker.
    _pickTargets(stats, count) {
      const mode = this.state.targetMode || "nearest";
      const candidates = [];
      for (const e of this.entities) {
        const d = Math.hypot(e.x, e.y);
        if (d > stats.range) continue;
        const score = mode === "nearest" ? d : mode === "strongest" ? e.maxHp : e.hp;
        candidates.push({ e, score });
      }
      candidates.sort((a, b) => (mode === "strongest" ? b.score - a.score : a.score - b.score));
      return candidates.slice(0, count).map((c) => c.e);
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

    // Same shield-then-hp pattern as _applyDamage, but for the tower's own
    // Schutzschild ability instead of an enemy's shielded-type armor.
    _damageTower(amount) {
      if (this.towerShield > 0) {
        if (amount <= this.towerShield) {
          this.towerShield -= amount;
          return;
        }
        const remainder = amount - this.towerShield;
        this.towerShield = 0;
        this.state.run.towerHp -= remainder;
      } else {
        this.state.run.towerHp -= amount;
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
          shape: "fracture",
          radius: Math.max(4, target.radius * 0.65),
          speed: target.speed * 1.1,
          maxHp: target.maxHp * 0.4,
          hp: target.maxHp * 0.4,
          damage: target.damage * 0.5,
          cash: target.cash * 0.4,
          x: target.x + Math.cos(angle) * offset,
          y: target.y + Math.sin(angle) * offset,
          spin: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 1.6,
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

    abilityReady() {
      return !!this.state.equippedAbility && this.abilityCooldownRemaining <= 0 && this.state.run.alive;
    },

    currentAbilityCooldownMax() {
      const id = this.state.equippedAbility;
      if (!id) return 0;
      const def = State.ABILITY_DEFS.find((d) => d.id === id);
      return def ? State.abilityCooldown(def) : 0;
    },

    activateAbility() {
      if (!this.abilityReady()) return false;
      const handlers = {
        nova: this._abilityNova,
        shield: this._abilityShield,
        slow: this._abilitySlow,
        chain: this._abilityChain,
        repair: this._abilityRepair,
      };
      const handler = handlers[this.state.equippedAbility];
      if (!handler) return false;
      handler.call(this);
      this.abilityCooldownRemaining = this.currentAbilityCooldownMax();
      return true;
    },

    _abilityNova() {
      const s = this.state;
      const stats = Tower.effectiveStats(s);
      const tuning = ABILITY_TUNING.nova;
      const novaDamage = stats.damage * tuning.damageMult;
      const novaRadius = stats.range * tuning.radiusMult;
      const targets = this.entities.filter((e) => Math.hypot(e.x, e.y) <= novaRadius);
      targets.forEach((e) => {
        this._applyDamage(e, novaDamage);
        this.flashes.push({ x: e.x, y: e.y, alpha: 1 });
        if (e.hp <= 0) this._killEnemy(e, stats);
      });
      this.rings.push({ x: 0, y: 0, radius: 10, alpha: 1, color: "#ffd166", growth: 340 });
      this.shake = Math.min(14, this.shake + 10);
      Sfx.playNova();
    },

    _abilityShield() {
      const tuning = ABILITY_TUNING.shield;
      const stats = Tower.effectiveStats(this.state);
      this.towerShield = stats.maxHp * tuning.shieldPctOfMaxHp;
      this.shieldExpiresAt = this.time + tuning.durationSec;
      this.rings.push({ x: 0, y: 0, radius: 10, alpha: 1, color: "#4dd4ff", growth: 200 });
      Sfx.playShieldUp();
    },

    _abilitySlow() {
      const tuning = ABILITY_TUNING.slow;
      this.slowUntil = this.time + tuning.durationSec;
      this.slowFactor = tuning.factor;
      this.rings.push({ x: 0, y: 0, radius: 10, alpha: 1, color: "#8f7aff", growth: 260 });
      Sfx.playSlow();
    },

    _abilityChain() {
      const s = this.state;
      const stats = Tower.effectiveStats(s);
      const tuning = ABILITY_TUNING.chain;
      const jumpRange = stats.range * tuning.jumpRangeMult;
      const hit = new Set();
      let originX = 0, originY = 0;
      let dmg = stats.damage * tuning.damageMult;
      for (let i = 0; i < tuning.maxJumps; i++) {
        let target = null, best = Infinity;
        for (const e of this.entities) {
          if (hit.has(e)) continue;
          const d = Math.hypot(e.x - originX, e.y - originY);
          if (d <= jumpRange && d < best) { best = d; target = e; }
        }
        if (!target) break;
        hit.add(target);
        this.chainLines.push({ x1: originX, y1: originY, x2: target.x, y2: target.y, alpha: 1 });
        this._applyDamage(target, dmg);
        if (target.hp <= 0) this._killEnemy(target, stats);
        originX = target.x;
        originY = target.y;
        dmg *= tuning.falloff;
      }
      Sfx.playChain();
    },

    _abilityRepair() {
      const s = this.state;
      const tuning = ABILITY_TUNING.repair;
      const heal = s.run.towerMaxHp * tuning.healPct;
      s.run.towerHp = Math.min(s.run.towerMaxHp, s.run.towerHp + heal);
      this.rings.push({ x: 0, y: 0, radius: 10, alpha: 1, color: "#7bf0a4", growth: 300 });
      Sfx.playRepair();
    },

    _spawnEnemy(type, wave, stats, elite) {
      const enemyStats = Enemies.statsForWave(type, wave, elite);
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = this._worldRadius(stats);
      const entity = {
        type,
        color: enemyStats.color,
        shape: enemyStats.shape,
        radius: enemyStats.radius,
        speed: enemyStats.speed,
        maxHp: enemyStats.maxHp,
        hp: enemyStats.maxHp,
        damage: enemyStats.damage,
        cash: enemyStats.cash,
        x: Math.cos(angle) * spawnRadius,
        y: Math.sin(angle) * spawnRadius,
        spin: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 1.2,
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
      return Math.min(zoom, 1);
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
        towerRadius: Math.max(MIN_TOWER_PX, TOWER_RADIUS * zoom),
        range: stats.range * zoom,
        elite: this.currentElite,
        boss: boss ? { hp: boss.hp, maxHp: boss.maxHp } : null,
        shieldActive: this.towerShield > 0,
        enemies: this.entities.map((e) => ({ ...e, ...toScreen(e.x, e.y), radius: Math.max(MIN_SPRITE_PX, e.radius * zoom) })),
        flashes: this.flashes.map((f) => ({ ...f, ...toScreen(f.x, f.y) })),
        particles: this.particles.map((p) => ({ ...p, ...toScreen(p.x, p.y), alpha: Math.max(0, p.life / p.maxLife) })),
        rings: this.rings.map((r) => ({ ...r, ...toScreen(r.x, r.y), radius: r.radius * zoom })),
        chainLines: this.chainLines.map((l) => {
          const a = toScreen(l.x1, l.y1), b = toScreen(l.x2, l.y2);
          return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, alpha: l.alpha };
        }),
      };
    },
  };

  global.Game = Game;
})(window);
