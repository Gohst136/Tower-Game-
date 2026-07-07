# Planet Defender

Ein Idle-Weltraumverteidigungsspiel: Dein Planet im Zentrum wird automatisch
von Orbitalgeschützen gegen endlose Meteoriten-Wellen und Alien-Mutterschiffe
verteidigt. Reines HTML/CSS/JavaScript ohne Build-Schritt, mobile-first
designed, läuft in jedem modernen Browser (inkl. Offline-Support als PWA).

## Spielprinzip

- Meteore spawnen rund um den Planeten und fliegen auf ihn zu; die
  Orbitalgeschütze greifen automatisch das nächste Ziel in Reichweite an.
  Alle 10 Wellen erscheint ein Alien-Mutterschiff, das auch aus der Distanz
  feuert. Manche Meteore haben Schilde oder brechen beim Einschlag in
  kleinere Fragmente auseinander.
- **Werkstatt**: Ausbauten gegen Rohstoffe, die nur für den aktuellen Run
  gelten (Schaden, Feuerrate, Reichweite, Integrität, Regeneration,
  Rohstoff-Gewinn).
- Wird der Planet überrannt, endet der Run. Basierend auf der erreichten
  Welle gibt es **Kristalle**.
- **Labor**: eine zeitgesteuerte Forschungs-Queue (bis zu 3 parallele
  Projekte) gegen Kristalle für permanente Boni, die bis zum nächsten
  Aufstieg bestehen bleiben — läuft auch weiter, wenn das Spiel geschlossen ist.
- **Aufstieg**: setzt Kristalle & Labor zurück, gibt dafür dauerhafte
  **Kerne** basierend auf allen jemals verdienten Kristallen. Damit werden
  permanente Talente und 5 austauschbare Fähigkeiten freigeschaltet
  (Sonneneruption, Planetenschild, Gravitationsfeld, Ionenkette,
  Notreparatur) — jeweils eine gleichzeitig ausgerüstet.
- Offline-Fortschritt: Beim Wiederöffnen wird ein Teil der verpassten Zeit
  als Rohstoff-Bonus gutgeschrieben.
- Fortschritt wird automatisch in `localStorage` gespeichert; Export/Import
  als Textcode möglich.

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
`js/*.js`, `manifest.json`, `sw.js`, `assets/`) und kann direkt auf GitHub
Pages, Netlify, Vercel oder jedem anderen Static-Host deployt werden — kein
Build-Prozess nötig.

## Struktur

```
index.html          Markup & View-Struktur
style.css           Mobile-first Styling
sw.js                Service Worker (Offline-Cache)
manifest.json        PWA-Manifest
js/utils.js          Zahlenformatierung & Hilfsfunktionen (inkl. Vibration)
js/audio.js          Synthetisierte Soundeffekte & generative Musik
js/state.js          Spielzustand, Upgrade-/Talent-/Fähigkeiten-Definitionen
js/enemies.js        Gegnertypen (Meteore, Mutterschiff) & Wellen-Skalierung
js/achievements.js   Erfolge/Meilensteine
js/tower.js          Effektive Planeten-Werte aus Ausbauten
js/render.js         Canvas-Rendering (Meteor-/Mutterschiff-/Planet-Grafiken)
js/game.js           Simulationsloop (Spawns, Kämpfe, Wellen, Fähigkeiten)
js/ui.js             DOM-Bindings (Tabs, Listen, Modals)
js/main.js           Bootstrap & Game-Loop
```
