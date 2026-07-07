# Tower Idle Defense

Ein Idle Tower Defense im Stil von *The Tower*: Ein einzelner Turm im Zentrum
verteidigt sich automatisch gegen endlose, immer stärker werdende Gegnerwellen.
Reines HTML/CSS/JavaScript ohne Build-Schritt, mobile-first designed, läuft in
jedem modernen Browser.

## Spielprinzip

- Gegner spawnen rund um den Turm und laufen auf ihn zu; der Turm greift
  automatisch das nächste Ziel in Reichweite an.
- **Werkstatt**: Upgrades gegen Cash, die nur für den aktuellen Run gelten
  (Schaden, Feuerrate, Reichweite, HP, Regeneration, Cash-Gewinn).
- Stirbt der Turm, endet der Run. Basierend auf der erreichten Welle gibt es
  **Coins**.
- **Labor**: permanente Upgrades gegen Coins, die über alle zukünftigen Runs
  bestehen bleiben — jeder neue Run startet dadurch stärker.
- Offline-Fortschritt: Beim Wiederöffnen wird ein Teil der verpassten Zeit als
  Cash-Bonus gutgeschrieben.
- Fortschritt wird automatisch in `localStorage` gespeichert.

## Lokal starten

Da die Skripte als normale `<script>`-Tags eingebunden sind, reicht jeder
einfache Webserver:

```bash
python3 -m http.server 8080
# dann im Browser: http://localhost:8080
```

Oder mit Node:

```bash
npx serve .
```

## Deployment

Das Projekt ist eine rein statische Seite (`index.html`, `style.css`,
`js/*.js`, `manifest.json`, `assets/`) und kann direkt auf GitHub Pages,
Netlify, Vercel oder jedem anderen Static-Host deployt werden — kein
Build-Prozess nötig.

## Struktur

```
index.html        Markup & View-Struktur
style.css          Mobile-first Styling
js/utils.js        Zahlenformatierung & Hilfsfunktionen
js/state.js        Spielzustand, Upgrade-Definitionen, Speichern/Laden
js/enemies.js      Gegnertypen & Wellen-Skalierung
js/tower.js        Effektive Turm-Werte aus Upgrades
js/render.js       Canvas-Rendering
js/game.js         Simulationsloop (Spawns, Kämpfe, Wellen, Run-Ende)
js/ui.js           DOM-Bindings (Tabs, Listen, Modals)
js/main.js         Bootstrap & Game-Loop
```
