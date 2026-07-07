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
      document.querySelectorAll("[data-icon]").forEach((node) => {
        node.innerHTML = Icons.get(node.dataset.icon);
      });
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
      this.dom.modalTutorial = el("modal-tutorial");
      this.dom.researchActiveList = el("research-active-list");
      this.dom.researchIdleHint = el("research-idle-hint");
      this.dom.researchToast = el("research-toast");
      this.dom.abilityList = el("ability-list");
      this.dom.planetList = el("planet-list");

      this.buyMultiplier = 1;

      this._bindTabs();
      this._bindRunControls();
      this._bindBuyMultiplier();
      this._buildUpgradeList(this.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      this._buildLabList();
      this._bindResearchSkip();
      this._buildUpgradeList(this.dom.talentList, this._regularTalentDefs(), "talent");
      this._buildAbilityList();
      this._buildPlanetList();
      this._bindGameover();
      this._bindOffline();
      this._bindReset();
      this._bindAudioToggles();
      this._bindTargetMode();
      this._bindAbilityButton();
      this._bindSaveTransfer();
      this._bindAscend();
      this._bindShare();
      this._bindTutorial();
      this.setAutoRestartLabel();
      this.refreshAscendPreview();
    },

    _regularTalentDefs() {
      return State.TALENT_DEFS.filter((d) => !d.ability);
    },

    TUTORIAL_STEPS: [
      {
        icon: "planetRinged",
        title: "Willkommen, Kommandant",
        body: "Dein Planet wird automatisch von Orbitalgeschützen verteidigt, während Meteore aus den Tiefen des Alls einschlagen. Du musst nichts steuern – aber du kannst helfen.",
      },
      {
        icon: "wrench",
        title: "Werkstatt & Labor",
        body: "In der Werkstatt kaufst du Ausbauten mit Rohstoffen – sie gelten nur für den aktuellen Run. Wird dein Planet überrannt, verdienst du Kristalle. Im Labor startest du damit Forschungsprojekte, die über echte Zeit laufen (auch offline) und dauerhaft bleiben.",
      },
      {
        icon: "bolt",
        title: "Fähigkeiten & Zielmodus",
        body: "Der Fähigkeiten-Knopf löst nach Aufladung einen mächtigen Effekt aus (z.B. Sonneneruption, Planetenschild, Gravitationsfeld). Du schaltest Fähigkeiten im Aufstieg-Tab frei und kannst zwischen freigeschalteten wechseln. Über die Buttons oben im Kampf wählst du, welchen Meteor die Geschütze zuerst angreifen.",
      },
      {
        icon: "comet",
        title: "Aufstieg",
        body: "Sobald du genug Kristalle verdient hast, schaltest du im Aufstieg-Tab dauerhafte Talente und Fähigkeiten gegen Kerne frei – das setzt Kristalle & Labor zurück, bleibt aber für immer. Manche Meteore haben Schilde oder brechen beim Einschlag auseinander, und alle 10 Wellen greift ein Alien-Mutterschiff an – beobachte und reagiere!",
      },
    ],

    _bindTutorial() {
      this._tutorialStep = 0;
      el("btn-tutorial-next").addEventListener("click", () => {
        if (this._tutorialStep >= this.TUTORIAL_STEPS.length - 1) {
          this.hideTutorial();
        } else {
          this._tutorialStep += 1;
          this._renderTutorialStep();
        }
      });
      el("btn-tutorial-skip").addEventListener("click", () => this.hideTutorial());
    },

    showTutorial() {
      this._tutorialStep = 0;
      this._renderTutorialStep();
      this.dom.modalTutorial.classList.remove("hidden");
    },

    hideTutorial() {
      this.dom.modalTutorial.classList.add("hidden");
    },

    _renderTutorialStep() {
      const step = this.TUTORIAL_STEPS[this._tutorialStep];
      const isLast = this._tutorialStep === this.TUTORIAL_STEPS.length - 1;
      el("tutorial-icon").innerHTML = Icons.get(step.icon);
      el("tutorial-title").textContent = step.title;
      el("tutorial-body").textContent = step.body;
      el("btn-tutorial-next").textContent = isLast ? "Los geht's!" : "Weiter";
      el("tutorial-dots").innerHTML = this.TUTORIAL_STEPS.map((_, i) => `<span class="${i === this._tutorialStep ? "active" : ""}"></span>`).join("");
    },

    _bindAscend() {
      el("btn-ascend").addEventListener("click", () => {
        const preview = State.pendingCores(this.state);
        if (preview <= 0) {
          alert("Noch keine neuen Kerne verfügbar. Verdiene mehr Kristalle, um aufzusteigen.");
          return;
        }
        const ok = confirm(
          `Aufstieg durchführen? Du erhältst ${preview} Kerne, verlierst aber deine aktuellen Kristalle (${Math.floor(this.state.coins)}), alle Labor-Stufen und ein laufendes Forschungsprojekt. Talente und Bestwerte bleiben erhalten.`
        );
        if (!ok) return;
        const earned = this.game.ascend();
        if (earned > 0) {
          Sfx.playAchievement();
          this.refreshLabList();
          this.refreshUpgradeList(this.dom.talentList, this._regularTalentDefs(), "talent");
          this.refreshAbilityList();
          this.refreshPlanetList();
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
        const text = `Ich habe in Planet Defender Welle ${s.bestWave} erreicht und ${Utils.formatNumber(s.totalCoinsEarned)} Kristalle verdient! 🪐☄️`;
        if (navigator.share) {
          try {
            await navigator.share({ title: "Planet Defender", text });
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

    _bindAbilityButton() {
      this.dom.abilityBtn = el("btn-ability");
      this.dom.abilityRing = el("ability-ring").querySelector("circle");
      this.dom.abilityIconLabel = el("ability-icon-label");
      this.dom.abilityBtn.addEventListener("click", () => {
        if (this.game.activateAbility()) Utils.vibrate(25);
      });
    },

    refreshAbilityButton() {
      const g = this.game;
      const s = this.state;
      const equippedId = s.equippedAbility;
      const circumference = 113;

      if (!equippedId) {
        this.dom.abilityRing.style.strokeDashoffset = circumference;
        this.dom.abilityBtn.disabled = true;
        this.dom.abilityBtn.classList.remove("on-cooldown");
        this.dom.abilityIconLabel.innerHTML = Icons.get("lock");
        return;
      }

      const def = State.ABILITY_DEFS.find((d) => d.id === equippedId);
      const max = g.currentAbilityCooldownMax();
      const ratio = max > 0 ? Utils.clamp(g.abilityCooldownRemaining / max, 0, 1) : 0;
      this.dom.abilityRing.style.strokeDashoffset = circumference * ratio;
      const ready = g.abilityReady();
      this.dom.abilityBtn.disabled = !ready;
      this.dom.abilityBtn.classList.toggle("on-cooldown", !ready);
      this.dom.abilityIconLabel.innerHTML = ready ? Icons.get(def.icon) : Math.ceil(g.abilityCooldownRemaining) + "s";
    },

    _buildAbilityList() {
      const container = this.dom.abilityList;
      container.innerHTML = "";
      State.ABILITY_DEFS.forEach((abilityDef) => {
        const talentDef = State.TALENT_DEFS.find((d) => d.ability === abilityDef.id);
        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-icon">${Icons.get(abilityDef.icon)}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${abilityDef.name}</div>
            <div class="upgrade-desc">${abilityDef.desc}</div>
            <div class="upgrade-level" data-role="level">Gesperrt</div>
          </div>
          <button class="upgrade-buy lab-buy" data-role="buy">
            <span data-role="cost">0</span>
          </button>
        `;
        card.querySelector('[data-role="buy"]').addEventListener("click", () => {
          const level = State.getLevel(this.state.talents, talentDef.id);
          const acted = level === 0 ? this.game.buyTalent(talentDef.id) : this.game.equipAbility(abilityDef.id);
          if (acted) {
            Sfx.playPurchase();
            Utils.vibrate(8);
            this.refreshAbilityList();
            this.refreshAbilityButton();
          }
        });
        card.dataset.id = abilityDef.id;
        container.appendChild(card);
      });
      this.refreshAbilityList();
    },

    refreshAbilityList() {
      const s = this.state;
      State.ABILITY_DEFS.forEach((abilityDef) => {
        const card = this.dom.abilityList.querySelector(`[data-id="${abilityDef.id}"]`);
        if (!card) return;
        const talentDef = State.TALENT_DEFS.find((d) => d.ability === abilityDef.id);
        const level = State.getLevel(s.talents, talentDef.id);
        const unlocked = level >= 1;
        const equipped = s.equippedAbility === abilityDef.id;
        const buyBtn = card.querySelector('[data-role="buy"]');
        const levelEl = card.querySelector('[data-role="level"]');
        const costEl = card.querySelector('[data-role="cost"]');
        card.classList.toggle("equipped", equipped);
        buyBtn.classList.toggle("equipped-buy", equipped);
        if (!unlocked) {
          const cost = State.upgradeCost(talentDef, level);
          levelEl.textContent = "Gesperrt";
          costEl.textContent = "Freischalten (" + Utils.formatNumber(cost) + ")";
          buyBtn.disabled = s.cores < cost;
        } else {
          levelEl.textContent = `Cooldown: ${State.abilityCooldown(abilityDef)}s`;
          costEl.textContent = equipped ? "Ausgerüstet" : "Ausrüsten";
          buyBtn.disabled = equipped;
        }
      });
    },

    _buildPlanetList() {
      const container = this.dom.planetList;
      container.innerHTML = "";
      State.PLANET_DEFS.forEach((def) => {
        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-icon">${Icons.get(def.icon)}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-level" data-role="level"></div>
          </div>
          <button class="upgrade-buy lab-buy" data-role="buy">
            <span data-role="cost"></span>
          </button>
        `;
        card.querySelector('[data-role="buy"]').addEventListener("click", () => {
          if (this.game.selectPlanet(def.id)) {
            Sfx.playPurchase();
            Utils.vibrate(8);
            this.refreshPlanetList();
          }
        });
        card.dataset.id = def.id;
        container.appendChild(card);
      });
      this.refreshPlanetList();
    },

    refreshPlanetList() {
      const s = this.state;
      State.PLANET_DEFS.forEach((def) => {
        const card = this.dom.planetList.querySelector(`[data-id="${def.id}"]`);
        if (!card) return;
        const unlocked = State.isPlanetUnlocked(def, s);
        const active = s.activePlanet === def.id;
        const buyBtn = card.querySelector('[data-role="buy"]');
        const levelEl = card.querySelector('[data-role="level"]');
        const costEl = card.querySelector('[data-role="cost"]');
        card.classList.toggle("equipped", active);
        buyBtn.classList.toggle("equipped-buy", active);
        if (!unlocked) {
          levelEl.textContent = `Gesperrt (ab ${def.unlockAscensions} Aufstiegen)`;
          costEl.textContent = "Gesperrt";
          buyBtn.disabled = true;
        } else {
          levelEl.textContent = "Freigeschaltet";
          costEl.textContent = active ? "Aktiv" : "Auswählen";
          buyBtn.disabled = active;
        }
      });
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
      el("btn-end-run").addEventListener("click", () => {
        if (!this.state.run.alive) return;
        if (!confirm("Run jetzt beenden und die aktuellen Kristalle einsammeln?")) return;
        this.game.endRun();
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
          <div class="upgrade-icon">${Icons.get(def.icon)}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-level" data-role="level">Stufe 0</div>
          </div>
          <button class="upgrade-buy ${kind === "talent" ? "lab-buy" : ""}" data-role="buy">
            <span data-role="cost">0</span>
          </button>
        `;
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.addEventListener("click", () => {
          const qty = kind === "workshop" ? this.buyMultiplier : 1;
          const result = kind === "talent" ? this.game.buyTalent(def.id) : this.game.buyWorkshopMultiple(def.id, qty);
          if (result) {
            Sfx.playPurchase();
            Utils.vibrate(8);
            this.refreshUpgradeList(container, defs, kind);
          }
        });
        card.dataset.id = def.id;
        container.appendChild(card);
      });
      this.refreshUpgradeList(container, defs, kind);
    },

    _bindBuyMultiplier() {
      const btn = el("btn-buy-multiplier");
      const cycle = [1, 10, 100];
      btn.addEventListener("click", () => {
        const idx = cycle.indexOf(this.buyMultiplier);
        this.buyMultiplier = cycle[(idx + 1) % cycle.length];
        btn.textContent = this.buyMultiplier + "x";
        this.refreshUpgradeList(this.dom.workshopList, State.WORKSHOP_DEFS, "workshop");
      });
    },

    refreshUpgradeList(container, defs, kind) {
      const wallet = kind === "talent" ? this.state.cores : this.state.run.cash;
      const levels = kind === "talent" ? this.state.talents : this.state.run.workshop;
      const qty = kind === "workshop" ? this.buyMultiplier : 1;
      defs.forEach((def) => {
        const card = container.querySelector(`[data-id="${def.id}"]`);
        if (!card) return;
        const level = State.getLevel(levels, def.id);
        const cost = State.upgradeCostRange(def, level, qty);
        card.querySelector('[data-role="level"]').textContent = "Stufe " + level;
        card.querySelector('[data-role="cost"]').textContent = Utils.formatNumber(cost);
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.disabled = wallet < cost;
      });
    },

    _buildLabList() {
      const container = this.dom.labList;
      container.innerHTML = "";
      State.LAB_DEFS.forEach((def) => {
        const card = document.createElement("div");
        card.className = "upgrade-card";
        card.innerHTML = `
          <div class="upgrade-icon">${Icons.get(def.icon)}</div>
          <div class="upgrade-info">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-level" data-role="level">Stufe 0</div>
          </div>
          <button class="upgrade-buy lab-buy" data-role="buy">
            <span data-role="cost">0</span>
            <span class="upgrade-duration" data-role="duration"></span>
          </button>
        `;
        card.querySelector('[data-role="buy"]').addEventListener("click", () => {
          if (this.game.startResearch(def.id)) {
            Sfx.playPurchase();
            Utils.vibrate(8);
            this.refreshLabList();
          }
        });
        card.dataset.id = def.id;
        container.appendChild(card);
      });
      this.refreshLabList();
    },

    // Active research cards are fully rebuilt on every refresh tick (the
    // queue's contents change over time), so the skip button is bound once
    // here via event delegation rather than per-card.
    _bindResearchSkip() {
      this.dom.researchActiveList.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-role="skip"]');
        if (!btn || btn.disabled) return;
        const id = btn.dataset.id;
        const entry = this.state.research.find((r) => r.id === id);
        if (!entry) return;
        const cost = this.game.skipResearchCost(entry);
        const def = State.LAB_DEFS.find((d) => d.id === id);
        if (!confirm(`${def ? def.name : "Forschung"} für ${Utils.formatNumber(cost)} Kristalle sofort fertigstellen?`)) return;
        if (this.game.skipResearch(id)) {
          Sfx.playPurchase();
          Utils.vibrate(8);
          this.refreshLabList();
          this.refreshTopbar();
        }
      });
    },

    refreshLabList() {
      const s = this.state;
      const maxSlots = State.maxResearchSlots(s.talents);
      const slotsFull = s.research.length >= maxSlots;
      const activeIds = new Set(s.research.map((r) => r.id));
      const speedMult = State.researchSpeedMult(s.talents);
      State.LAB_DEFS.forEach((def) => {
        const card = this.dom.labList.querySelector(`[data-id="${def.id}"]`);
        if (!card) return;
        const level = State.getLevel(s.lab, def.id);
        const cost = State.upgradeCost(def, level);
        const durationMs = State.researchDurationMs(def, level, speedMult);
        card.querySelector('[data-role="level"]').textContent = "Stufe " + level;
        card.querySelector('[data-role="cost"]').textContent = Utils.formatNumber(cost);
        card.querySelector('[data-role="duration"]').textContent = Utils.formatTime(durationMs / 1000);
        const buyBtn = card.querySelector('[data-role="buy"]');
        buyBtn.disabled = slotsFull || activeIds.has(def.id) || s.coins < cost;
      });
      this.refreshResearchProgress();
    },

    refreshResearchProgress() {
      const s = this.state;
      const maxSlots = State.maxResearchSlots(s.talents);
      this.dom.researchIdleHint.classList.toggle("hidden", s.research.length >= maxSlots);
      this.dom.researchIdleHint.textContent =
        s.research.length >= maxSlots
          ? ""
          : `Wähle unten eine Forschung (${s.research.length}/${maxSlots} Slots belegt). Sie läuft über echte Zeit weiter, auch wenn du das Spiel schließt.`;

      this.dom.researchActiveList.innerHTML = s.research
        .map((r) => {
          const def = State.LAB_DEFS.find((d) => d.id === r.id);
          const ratio = Utils.clamp((Date.now() - r.startedAt) / r.durationMs, 0, 1);
          const remaining = Math.max(0, (r.startedAt + r.durationMs - Date.now()) / 1000);
          const skipCost = this.game.skipResearchCost(r);
          return `
            <div class="research-box">
              <div class="research-row">
                <span>${Icons.get(def ? def.icon : "microscope")}</span>
                <span>${def ? def.name : "Projekt"}</span>
                <span>${Utils.formatTime(remaining)}</span>
              </div>
              <div class="research-bar"><div style="width:${ratio * 100}%"></div></div>
              <button class="research-skip-btn" data-role="skip" data-id="${r.id}" ${s.coins < skipCost ? "disabled" : ""}>
                Überspringen (${Utils.formatNumber(skipCost)})
              </button>
            </div>
          `;
        })
        .join("");
    },

    showResearchToast(def, level) {
      el("research-toast-text").textContent = `${def.name} Stufe ${level} abgeschlossen!`;
      this.dom.researchToast.classList.remove("hidden");
      clearTimeout(this._researchToastTimer);
      this._researchToastTimer = setTimeout(() => this.dom.researchToast.classList.add("hidden"), 3500);
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
        el("elite-badge-icon").innerHTML = Icons.get(elite.icon);
        el("elite-badge-label").textContent = elite.label;
      }
    },

    showEliteToast(elite) {
      el("elite-toast-icon").innerHTML = Icons.get(elite.icon);
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
        ["Mutterschiffe besiegt", Utils.formatNumber(s.bossKills || 0)],
        ["Runs gespielt", s.runsCompleted],
        ["Aufstiege", s.ascensionCount || 0],
        ["Kristalle insgesamt verdient", Utils.formatNumber(s.totalCoinsEarned)],
        ["Login-Streak", (s.loginStreak || 0) + " Tage"],
      ];
      this.dom.statsList.innerHTML = rows
        .map(([label, value]) => `<div class="stats-row"><span>${label}</span><span>${value}</span></div>`)
        .join("");

      this.dom.achievementsList.innerHTML = Achievements.DEFS.map((def) => {
        const unlocked = !!(s.achievements && s.achievements[def.id]);
        const mark = Icons.get(unlocked ? "check" : "lock");
        return `<div class="stats-row${unlocked ? "" : " locked"}"><span>${Icons.get(def.icon)} ${def.label}</span><span>${mark}</span></div>`;
      }).join("");
    },

    showAchievementToast(def) {
      el("achievement-toast-text").textContent = `${def.label} (+${def.reward} Kristalle)`;
      this.dom.achievementToast.classList.remove("hidden");
      clearTimeout(this._achToastTimer);
      this._achToastTimer = setTimeout(() => this.dom.achievementToast.classList.add("hidden"), 3500);
    },

    showLoginToast(streak, reward) {
      el("login-toast-text").textContent = `Tag ${streak} Login-Bonus: +${reward} Kristalle`;
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
          ? `Du warst ${Utils.formatTime(seconds)} weg. Dein Planet hat sich weiter verteidigt und ${Utils.formatNumber(cash)} Rohstoffe verdient.`
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
