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

      this._bindTabs();
      this._bindRunControls();
      this._buildUpgradeList(this.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      this._buildUpgradeList(this.dom.labList, State.LAB_DEFS, "lab");
      this._bindGameover();
      this._bindOffline();
      this._bindReset();
      this._bindAudioToggles();
      this.setAutoRestartLabel();
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
          <button class="upgrade-buy ${kind === "lab" ? "lab-buy" : ""}" data-role="buy">
            <span data-role="cost">0</span>
          </button>
        `;
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.addEventListener("click", () => {
          const ok = kind === "lab" ? this.game.buyLab(def.id) : this.game.buyWorkshop(def.id);
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
      const wallet = kind === "lab" ? this.state.coins : this.state.run.cash;
      const levels = kind === "lab" ? this.state.lab : this.state.run.workshop;
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

    refreshStats() {
      const s = this.state;
      const rows = [
        ["Beste Welle", s.bestWave],
        ["Gesamt-Kills", Utils.formatNumber(s.totalKills)],
        ["Runs gespielt", s.runsCompleted],
        ["Coins insgesamt verdient", Utils.formatNumber(s.totalCoinsEarned)],
      ];
      this.dom.statsList.innerHTML = rows
        .map(([label, value]) => `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`)
        .join("");
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
