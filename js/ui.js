// DOM bindings: tabs, upgrade lists, hud, modals. window.UI
(function (global) {
  const el = (id) => document.getElementById(id);

  const UI = {
    dom: {},
    dps: 0,
    dpsSmoothed: 0,

    init(state, game) {
      this.state = state;
      this.game = game;
      this.dom.wave = el("wave-value");
      this.dom.cash = el("cash-value");
      this.dom.coins = el("coins-value");
      this.dom.hpFill = el("tower-hp-fill");
      this.dom.hpText = el("tower-hp-text");
      this.dom.dps = el("dps-value");
      this.dom.autoRestartBtn = el("btn-auto-restart");
      this.dom.workshopList = el("workshop-list");
      this.dom.labList = el("lab-list");
      this.dom.statsList = el("stats-list");
      this.dom.modalGameover = el("modal-gameover");
      this.dom.modalOffline = el("modal-offline");
      this.dom.eliteBadge = el("elite-badge");
      this.dom.eliteToast = el("elite-toast");
      this.dom.bossHpWrap = el("boss-hp-wrap");
      this.dom.bossHpFill = el("boss-hp-fill");
      this.dom.talentList = el("talent-list");
      this.dom.achievementsList = el("achievements-list");
      this.dom.achievementToast = el("achievement-toast");
      this.dom.loginToast = el("login-toast");

      this._bindTabs();
      this._bindRunControls();
      this._buildUpgradeList(this.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      this._buildUpgradeList(this.dom.labList, State.LAB_DEFS, "lab");
      this._buildUpgradeList(this.dom.talentList, State.TALENT_DEFS, "talent");
      this._bindGameover();
      this._bindOffline();
      this._bindReset();
      this._bindAudioToggles();
      this._bindTargetMode();
      this._bindNova();
      this._bindSaveTransfer();
      this._bindAscend();
      this._bindShare();
      this.setAutoRestartLabel();
      this.refreshAscendPreview();
    },

    _bindAscend() {
      el("btn-ascend").addEventListener("click", () => {
        const preview = State.pendingCores(this.state);
        if (preview <= 0) {
          alert("Noch keine neuen Kerne verfügbar. Verdiene mehr Coins, um aufzusteigen.");
          return;
        }
        const ok = confirm(
          `Aufstieg durchführen? Du erhältst ${preview} Kerne, verlierst aber deine aktuellen Coins (${Math.floor(this.state.coins)}) und alle Labor-Stufen. Talente und Bestwerte bleiben erhalten.`
        );
        if (!ok) return;
        const earned = this.game.ascend();
        if (earned > 0) {
          Sfx.playAchievement();
          this.refreshUpgradeList(this.dom.labList, State.LAB_DEFS, "lab");
          this.refreshUpgradeList(this.dom.talentList, State.TALENT_DEFS, "talent");
          this.refreshAscendPreview();
          this.refreshTopbar();
        }
      });
    },

    refreshAscendPreview() {
      el("ascend-preview-cores").textContent = Utils.formatNumber(State.pendingCores(this.state));
      el("cores-balance").textContent = Utils.formatNumber(this.state.cores);
    },

    _bindShare() {
      el("btn-share-progress").addEventListener("click", async () => {
        const s = this.state;
        const text = `Ich habe in Tower Idle Defense Welle ${s.bestWave} erreicht und ${Utils.formatNumber(s.totalCoinsEarned)} Coins verdient! 🏰⚔️`;
        if (navigator.share) {
          try {
            await navigator.share({ title: "Tower Idle Defense", text });
          } catch (e) {
            // user cancelled the share sheet - not an error
          }
        } else {
          try {
            await navigator.clipboard.writeText(text);
            alert("In die Zwischenablage kopiert!");
          } catch (e) {
            alert(text);
          }
        }
      });
    },

    _bindTargetMode() {
      const buttons = document.querySelectorAll(".target-btn");
      buttons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === this.state.targetMode);
        btn.addEventListener("click", () => {
          this.state.targetMode = btn.dataset.mode;
          buttons.forEach((b) => b.classList.toggle("active", b === btn));
        });
      });
    },

    _bindNova() {
      this.dom.novaBtn = el("btn-nova");
      this.dom.novaRing = el("nova-ring").querySelector("circle");
      this.dom.novaLabel = el("nova-label");
      this.dom.novaBtn.addEventListener("click", () => {
        this.game.activateNova();
      });
    },

    refreshNova() {
      const g = this.game;
      const ratio = Utils.clamp(g.novaCooldown / g.novaCooldownMax, 0, 1);
      const circumference = 113;
      this.dom.novaRing.style.strokeDashoffset = circumference * ratio;
      const ready = g.novaReady();
      this.dom.novaBtn.disabled = !ready;
      this.dom.novaLabel.textContent = ready ? "NOVA" : Math.ceil(g.novaCooldown) + "s";
    },

    _bindSaveTransfer() {
      const modalExport = el("modal-export");
      const modalImport = el("modal-import");
      const exportCode = el("export-code");
      const importCode = el("import-code");
      const importError = el("import-error");

      el("btn-export-save").addEventListener("click", () => {
        exportCode.value = State.exportSave(this.state);
        importError.classList.add("hidden");
        modalExport.classList.remove("hidden");
      });
      el("btn-export-close").addEventListener("click", () => modalExport.classList.add("hidden"));
      el("btn-copy-export").addEventListener("click", async () => {
        exportCode.focus();
        exportCode.select();
        try {
          await navigator.clipboard.writeText(exportCode.value);
        } catch (e) {
          document.execCommand("copy");
        }
      });

      el("btn-import-save").addEventListener("click", () => {
        importCode.value = "";
        importError.classList.add("hidden");
        modalImport.classList.remove("hidden");
      });
      el("btn-import-close").addEventListener("click", () => modalImport.classList.add("hidden"));
      el("btn-apply-import").addEventListener("click", () => {
        const parsed = State.importSave(importCode.value);
        if (!parsed) {
          importError.classList.remove("hidden");
          return;
        }
        State.save(parsed);
        location.reload();
      });
    },

    _bindAudioToggles() {
      const musicBtn = el("btn-toggle-music");
      const sfxBtn = el("btn-toggle-sfx");
      const refresh = () => {
        musicBtn.textContent = "Musik: " + (this.state.musicEnabled ? "An" : "Aus");
        musicBtn.classList.toggle("on", this.state.musicEnabled);
        sfxBtn.textContent = "Soundeffekte: " + (this.state.sfxEnabled ? "An" : "Aus");
        sfxBtn.classList.toggle("on", this.state.sfxEnabled);
      };
      musicBtn.addEventListener("click", () => {
        this.state.musicEnabled = !this.state.musicEnabled;
        Sfx.setMusicEnabled(this.state.musicEnabled);
        refresh();
      });
      sfxBtn.addEventListener("click", () => {
        this.state.sfxEnabled = !this.state.sfxEnabled;
        Sfx.setSfxEnabled(this.state.sfxEnabled);
        refresh();
      });
      refresh();
    },

    _bindTabs() {
      const tabs = document.querySelectorAll(".tab-btn");
      tabs.forEach((btn) => {
        btn.addEventListener("click", () => {
          tabs.forEach((b) => b.classList.remove("active"));
          document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
          btn.classList.add("active");
          el(btn.dataset.view).classList.add("active");
        });
      });
    },

    _bindRunControls() {
      this.dom.autoRestartBtn.addEventListener("click", () => {
        this.state.autoRestart = !this.state.autoRestart;
        this.setAutoRestartLabel();
      });
    },

    setAutoRestartLabel() {
      const on = this.state.autoRestart;
      this.dom.autoRestartBtn.textContent = "Auto-Neustart: " + (on ? "An" : "Aus");
      this.dom.autoRestartBtn.classList.toggle("on", on);
    },

    _buildUpgradeList(container, defs, kind) {
      container.innerHTML = "";
      defs.forEach((def) => {
        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-icon">${def.icon}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-level" data-role="level">Stufe 0</div>
          </div>
          <button class="upgrade-buy ${kind !== "workshop" ? "lab-buy" : ""}" data-role="buy">
            <span data-role="cost">0</span>
          </button>
        `;
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.addEventListener("click", () => {
          const ok =
            kind === "lab" ? this.game.buyLab(def.id) : kind === "talent" ? this.game.buyTalent(def.id) : this.game.buyWorkshop(def.id);
          if (ok) {
            Sfx.playPurchase();
            this.refreshUpgradeList(container, defs, kind);
          }
        });
        card.dataset.id = def.id;
        container.appendChild(card);
      });
      this.refreshUpgradeList(container, defs, kind);
    },

    refreshUpgradeList(container, defs, kind) {
      const wallet = kind === "lab" ? this.state.coins : kind === "talent" ? this.state.cores : this.state.run.cash;
      const levels = kind === "lab" ? this.state.lab : kind === "talent" ? this.state.talents : this.state.run.workshop;
      defs.forEach((def) => {
        const card = container.querySelector(`[data-id="${def.id}"]`);
        if (!card) return;
        const level = State.getLevel(levels, def.id);
        const cost = State.upgradeCost(def, level);
        card.querySelector('[data-role="level"]').textContent = "Stufe " + level;
        card.querySelector('[data-role="cost"]').textContent = Utils.formatNumber(cost);
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.disabled = wallet < cost;
      });
    },

    refreshTopbar() {
      const s = this.state;
      this.dom.wave.textContent = s.run.wave;
      this.dom.cash.textContent = Utils.formatNumber(s.run.cash);
      this.dom.coins.textContent = Utils.formatNumber(s.coins);
    },

    refreshBattle(dt) {
      const s = this.state;
      const pct = Utils.clamp((s.run.towerHp / s.run.towerMaxHp) * 100, 0, 100);
      this.dom.hpFill.style.width = pct + "%";
      this.dom.hpText.textContent = `${Utils.formatNumber(s.run.towerHp)} / ${Utils.formatNumber(s.run.towerMaxHp)}`;

      // smoothed dps readout based on cash gained this frame is noisy; use game rate tracker instead
      const stats = Tower.effectiveStats(s);
      const theoreticalDps = stats.damage / stats.attackInterval;
      this.dpsSmoothed += (theoreticalDps - this.dpsSmoothed) * Math.min(1, dt * 3);
      this.dom.dps.textContent = Utils.formatNumber(this.dpsSmoothed);
    },

    refreshElite() {
      const elite = this.game.currentElite;
      this.dom.eliteBadge.classList.toggle("hidden", !elite);
      if (elite) {
        el("elite-badge-icon").textContent = elite.icon;
        el("elite-badge-label").textContent = elite.label;
      }
    },

    showEliteToast(elite) {
      el("elite-toast-icon").textContent = elite.icon;
      el("elite-toast-text").textContent = `Elite-Welle: ${elite.label}!`;
      this.dom.eliteToast.classList.remove("hidden");
      clearTimeout(this._eliteToastTimer);
      this._eliteToastTimer = setTimeout(() => {
        this.dom.eliteToast.classList.add("hidden");
      }, 3000);
    },

    refreshBoss() {
      const boss = this.game.entities.find((e) => e.type === "boss");
      this.dom.bossHpWrap.classList.toggle("hidden", !boss);
      if (boss) {
        const pct = Utils.clamp((boss.hp / boss.maxHp) * 100, 0, 100);
        this.dom.bossHpFill.style.width = pct + "%";
      }
    },

    refreshStats() {
      const s = this.state;
      const rows = [
        ["Beste Welle", s.bestWave],
        ["Gesamt-Kills", Utils.formatNumber(s.totalKills)],
        ["Boss-Kills", Utils.formatNumber(s.bossKills || 0)],
        ["Runs gespielt", s.runsCompleted],
        ["Aufstiege", s.ascensionCount || 0],
        ["Coins insgesamt verdient", Utils.formatNumber(s.totalCoinsEarned)],
        ["Login-Streak", (s.loginStreak || 0) + " Tage"],
      ];
      this.dom.statsList.innerHTML = rows
        .map(([label, value]) => `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`)
        .join("");

      this.dom.achievementsList.innerHTML = Achievements.DEFS.map((def) => {
        const unlocked = !!(s.achievements && s.achievements[def.id]);
        const mark = unlocked ? "✅" : "🔒";
        return `<div class="stats-row${unlocked ? "" : " locked"}"><span>${def.icon} ${def.label}</span><span>${mark}</span></div>`;
      }).join("");
    },

    showAchievementToast(def) {
      el("achievement-toast-text").textContent = `${def.label} (+${def.reward} Coins)`;
      this.dom.achievementToast.classList.remove("hidden");
      clearTimeout(this._achToastTimer);
      this._achToastTimer = setTimeout(() => this.dom.achievementToast.classList.add("hidden"), 3500);
    },

    showLoginToast(streak, reward) {
      el("login-toast-text").textContent = `Tag ${streak} Login-Bonus: +${reward} Coins`;
      this.dom.loginToast.classList.remove("hidden");
      clearTimeout(this._loginToastTimer);
      this._loginToastTimer = setTimeout(() => this.dom.loginToast.classList.add("hidden"), 4000);
    },

    _bindGameover() {
      el("btn-restart").addEventListener("click", () => {
        this.dom.modalGameover.classList.add("hidden");
        this.game.startNewRun();
      });
    },

    showGameover(wave, coins) {
      el("go-wave").textContent = wave;
      el("go-coins").textContent = Utils.formatNumber(coins);
      this.dom.modalGameover.classList.remove("hidden");
    },

    _bindOffline() {
      el("btn-offline-close").addEventListener("click", () => {
        this.dom.modalOffline.classList.add("hidden");
      });
    },

    showOffline(seconds, cash) {
      const text =
        cash > 0
          ? `Du warst ${Utils.formatTime(seconds)} weg. Dein Turm hat weiter verteidigt und ${Utils.formatNumber(cash)} Cash verdient.`
          : `Du warst ${Utils.formatTime(seconds)} weg.`;
      el("offline-text").textContent = text;
      this.dom.modalOffline.classList.remove("hidden");
    },

    _bindReset() {
      el("btn-reset-save").addEventListener("click", () => {
        if (confirm("Spielstand wirklich komplett löschen? Das kann nicht rückgängig gemacht werden.")) {
          State.resetSave();
          location.reload();
        }
      });
    },
  };

  global.UI = UI;
})(window);
