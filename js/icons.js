// Small inline-SVG icon set generated in code (no external image assets),
// replacing every emoji previously used across the UI. window.Icons
(function (global) {
  function svg(inner) {
    return `<svg viewBox="0 0 24 24" width="22" height="22" class="icon-glyph" aria-hidden="true">${inner}</svg>`;
  }

  // N-pointed sparkle/star polygon, alternating outer/inner radius.
  function starPoints(cx, cy, points, rOuter, rInner, rotateDeg) {
    const rotate = rotateDeg === undefined ? -90 : rotateDeg;
    const step = Math.PI / points;
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const a = (rotate * Math.PI) / 180 + i * step;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
  }

  // Gear teeth as small rects fanned out around a center by rotate().
  function gearTeeth(cx, cy, r, len, count) {
    let out = "";
    for (let i = 0; i < count; i++) {
      const a = (360 / count) * i;
      out += `<rect x="${cx - 1.6}" y="${cy - r - len}" width="3.2" height="${len + 3}" rx="1" transform="rotate(${a} ${cx} ${cy})" />`;
    }
    return out;
  }

  const ICONS = {
    blast: svg(`<polygon points="${starPoints(12, 12, 4, 10, 4)}" fill="#ff8a4d"/>`),
    bolt: svg(`<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="#ffd23d"/>`),
    radar: svg(`<circle cx="12" cy="16" r="2" fill="#6fd1ff"/><path d="M6 16a6 6 0 0 1 12 0" fill="none" stroke="#6fd1ff" stroke-width="1.7" stroke-linecap="round"/><path d="M2.5 16a9.5 9.5 0 0 1 19 0" fill="none" stroke="#6fd1ff" stroke-width="1.4" opacity="0.55" stroke-linecap="round"/>`),
    shield: svg(`<path d="M12 2.5 19.5 5.5V11c0 5-3.3 8.7-7.5 10.5C7.8 19.7 4.5 16 4.5 11V5.5Z" fill="rgba(126,168,255,0.28)" stroke="#7ea8ff" stroke-width="1.6" stroke-linejoin="round"/>`),
    heal: svg(`<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6Z" fill="#7dffb0"/>`),
    coinbag: svg(`<rect x="10" y="2" width="4" height="3" rx="1" fill="#ffd23d"/><path d="M8 7 16 7C19 9 20.5 12 19 15.5 17.3 19.4 6.7 19.4 5 15.5 3.5 12 5 9 8 7Z" fill="#ffcf4d" stroke="#c99400" stroke-width="1"/>`),
    microscope: svg(`<ellipse cx="12" cy="21" rx="6" ry="1.3" fill="#6fd1ff" opacity="0.5"/><path d="M11 19V12l4-6" stroke="#6fd1ff" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="15" cy="5.2" r="2.1" fill="#6fd1ff"/><path d="M7 19h8" stroke="#6fd1ff" stroke-width="1.6" stroke-linecap="round"/>`),
    fortress: svg(`<path d="M5 21V10h3V8h2v2h4V8h2v2h3v11Z" fill="#b7c3e0"/><rect x="10" y="14" width="4" height="7" fill="#0a0e17"/>`),
    chartup: svg(`<path d="M4 20h16" stroke="#7dffb0" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/><path d="M5 16l4.5-4.5 3 3L20 7" fill="none" stroke="#7dffb0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7h5v5" fill="none" stroke="#7dffb0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    coin: svg(`<circle cx="12" cy="12" r="9" fill="#ffd23d" stroke="#c99400" stroke-width="1"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#c99400" stroke-width="1.2"/>`),
    vault: svg(`<path d="M4 7 12 3l8 4" fill="none" stroke="#b7c3e0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="7" width="16" height="13" rx="1.5" fill="#232b42" stroke="#b7c3e0" stroke-width="1.3"/><circle cx="12" cy="13.5" r="3" fill="none" stroke="#ffd23d" stroke-width="1.5"/><circle cx="12" cy="13.5" r="0.9" fill="#ffd23d"/>`),
    gear: svg(`<g fill="#9aa6c4">${gearTeeth(12, 12, 7, 2.6, 8)}</g><circle cx="12" cy="12" r="7" fill="#9aa6c4"/><circle cx="12" cy="12" r="3" fill="#0a0e17"/>`),
    vortex: svg(`<path d="M12 12c4 0 6-2 6-4.5S15.5 4 12 4 6 6 6 8s2 4 5 4-1 0-1 3 3 5 6 5 6-2 6-5" fill="none" stroke="#8a7bff" stroke-width="1.6" stroke-linecap="round"/>`),
    heart: svg(`<path d="M12 20.5 4.5 13C2 10.4 2.5 6.6 5.5 5 8 3.7 10.5 4.7 12 7 13.5 4.7 16 3.7 18.5 5 21.5 6.6 22 10.4 19.5 13Z" fill="#7dffb0"/>`),
    scroll: svg(`<rect x="5" y="4" width="14" height="16" rx="2" fill="#e8dcb8" opacity="0.9"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#6b5c3a" stroke-width="1.2" stroke-linecap="round"/>`),
    orb: svg(`<circle cx="12" cy="11" r="7" fill="rgba(201,140,255,0.28)" stroke="#c98cff" stroke-width="1.6"/><ellipse cx="9.5" cy="8.5" rx="2" ry="1.2" fill="rgba(255,255,255,0.6)"/><path d="M6 20h12" stroke="#7a5a99" stroke-width="1.6" stroke-linecap="round"/>`),
    rocket: svg(`<path d="M12 2c3 2 4.5 6 4.5 10 0 1.7-.4 3.3-1 4.7l-3.5 2-3.5-2c-.6-1.4-1-3-1-4.7C7.5 8 9 4 12 2Z" fill="#ff6b6b"/><circle cx="12" cy="9.5" r="1.8" fill="#0a0e17"/><path d="M7.5 15 4 18l2-.3ZM16.5 15 20 18l-2-.3Z" fill="#ffb14d"/>`),
    sparkle: svg(`<polygon points="${starPoints(12, 12, 4, 9, 3)}" fill="#ffe98a"/><circle cx="18" cy="6" r="1.4" fill="#ffe98a"/>`),
    clock: svg(`<circle cx="12" cy="12" r="8.5" fill="none" stroke="#9adcff" stroke-width="1.6"/><path d="M12 7v5l3.5 2" fill="none" stroke="#9adcff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`),
    dna: svg(`<path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" fill="none" stroke="#7bffb0" stroke-width="1.5"/><path d="M8.3 6h7.4M8 12h8M8.3 18h7.4" stroke="#7bffb0" stroke-width="1.3" opacity="0.7"/>`),
    fastforward: svg(`<path d="M3 6v12l8-6Z" fill="#ffb14d"/><path d="M12 6v12l8-6Z" fill="#ffb14d"/>`),
    planetRinged: svg(`<circle cx="12" cy="12" r="5.2" fill="#d7b98e"/><ellipse cx="12" cy="12" rx="10" ry="3" fill="none" stroke="#9adcff" stroke-width="1.4" transform="rotate(-18 12 12)"/>`),
    globe: svg(`<circle cx="12" cy="12" r="9" fill="#4d8fff"/><path d="M4 10c3 1.5 13 1.5 16 0M5 15c3 1 11 1 14 0" stroke="#bff0c6" stroke-width="1.3" fill="none"/><path d="M9 3.5c-2 3-2 14 0 17M15 3.5c2 3 2 14 0 17" stroke="#bff0c6" stroke-width="1" fill="none" opacity="0.7"/>`),
    moon: svg(`<circle cx="12" cy="12" r="9" fill="#7f8aa0"/><circle cx="9" cy="9" r="1.6" fill="#5c6579"/><circle cx="15" cy="14" r="2.2" fill="#5c6579"/><circle cx="10" cy="16" r="1.1" fill="#5c6579"/>`),
    redplanet: svg(`<circle cx="12" cy="12" r="9" fill="#ff5f5f"/><ellipse cx="12" cy="12" rx="10.5" ry="2.6" fill="none" stroke="#ffb3b3" stroke-width="1.2" opacity="0.6" transform="rotate(-10 12 12)"/>`),
    comet: svg(`<circle cx="16" cy="8" r="3" fill="#bdeeff"/><path d="M14 10 4 20M12 8 3 15M15 12 8 20" stroke="#bdeeff" stroke-width="1.3" stroke-linecap="round" opacity="0.65"/>`),
    alien: svg(`<ellipse cx="12" cy="11" rx="6" ry="7.5" fill="#8dff9e"/><ellipse cx="9" cy="10" rx="2" ry="2.6" fill="#0a0e17"/><ellipse cx="15" cy="10" rx="2" ry="2.6" fill="#0a0e17"/>`),
    repeat: svg(`<path d="M4 12a8 8 0 0 1 13.5-5.7M20 12a8 8 0 0 1-13.5 5.7" fill="none" stroke="#9adcff" stroke-width="1.7" stroke-linecap="round"/><path d="M17 3v4h-4M7 21v-4h4" fill="none" stroke="#9adcff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`),
    star: svg(`<polygon points="${starPoints(12, 12, 5, 9, 4)}" fill="#ffd23d"/>`),
    wind: svg(`<path d="M3 9h11a2.5 2.5 0 1 0-2.2-3.6M3 15h14a2.5 2.5 0 1 1-2.2 3.6M3 12h9" stroke="#9adcff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
    flame: svg(`<path d="M12 2c1 4-4 5-4 9a4 4 0 0 0 8 0c0-1.5-1-2-1-2 0 2-1.5 2.5-1.5 1 0-2 2.5-3 1.5-6 1 1-1 3-3-2Z" fill="#ff7a3d"/>`),
    bee: svg(`<ellipse cx="12" cy="13" rx="5" ry="4" fill="#ffd23d"/><path d="M8 10.5h8M7.3 13h9.4M8 15.5h8" stroke="#2b2100" stroke-width="1.3"/><path d="M9 9c-2-3-5-3-6-1M15 9c2-3 5-3 6-1" stroke="#cfefff" stroke-width="1.1" fill="none" opacity="0.8"/>`),
    lock: svg(`<rect x="5.5" y="11" width="13" height="9" rx="1.6" fill="#5b6376"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#5b6376" stroke-width="1.8"/>`),
    check: svg(`<path d="M4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="#45d47a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`),
    phone: svg(`<rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="#9adcff" stroke-width="1.5"/><path d="M9 19h6" stroke="#9adcff" stroke-width="1.5" stroke-linecap="round"/><path d="M12 6v6M9.5 9.5 12 12l2.5-2.5" fill="none" stroke="#9adcff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`),
    trophy: svg(`<path d="M7 4h10v4a5 5 0 0 1-10 0Z" fill="#ffd23d"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="#ffd23d" stroke-width="1.4"/><rect x="10" y="14" width="4" height="4" fill="#ffd23d"/><rect x="7" y="18" width="10" height="2.5" rx="1" fill="#ffd23d"/>`),
    calendar: svg(`<rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="#9adcff" stroke-width="1.5"/><path d="M4 9.5h16M8 3v3.5M16 3v3.5" stroke="#9adcff" stroke-width="1.5" stroke-linecap="round"/><rect x="7.5" y="12.5" width="3" height="3" fill="#9adcff"/>`),
    flask: svg(`<path d="M10 3v6l-5 8.5A2 2 0 0 0 6.7 21h10.6a2 2 0 0 0 1.7-3.5L14 9V3" fill="none" stroke="#7bffb0" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 3h6" stroke="#7bffb0" stroke-width="1.5" stroke-linecap="round"/><path d="M7.5 15h9" stroke="#7bffb0" stroke-width="1.3" opacity="0.6"/>`),
    share: svg(`<path d="M12 15V3M8 7l4-4 4 4" fill="none" stroke="#7ea8ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="#7ea8ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`),
    sword: svg(`<path d="M4 20 14 10M13 5l6 6-2 2-6-6Z" fill="none" stroke="#dfe6f5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 12l3 3" stroke="#dfe6f5" stroke-width="1.7" stroke-linecap="round"/>`),
    wrench: svg(`<path d="M14.5 3.5a5 5 0 0 0-6.9 5.9L3 15l3 3 5.6-4.6a5 5 0 0 0 5.9-6.9l-3 3-2-2Z" fill="#dfe6f5"/>`),
    chartbar: svg(`<rect x="4" y="13" width="4" height="7" fill="#ff8a4d"/><rect x="10" y="8" width="4" height="12" fill="#7dffb0"/><rect x="16" y="4" width="4" height="16" fill="#9adcff"/>`),
  };

  function get(id) {
    return ICONS[id] || "";
  }

  global.Icons = { get };
})(window);
