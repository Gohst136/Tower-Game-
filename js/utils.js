// Shared helper functions, exposed on window.Utils
(function (global) {
  const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "0";
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    if (n < 1000) return sign + Math.floor(n).toString();
    let tier = Math.floor(Math.log10(n) / 3);
    tier = Math.min(tier, SUFFIXES.length - 1);
    const scaled = n / Math.pow(1000, tier);
    const digits = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return sign + scaled.toFixed(digits) + SUFFIXES[tier];
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  global.Utils = { formatNumber, formatTime, clamp, randRange };
})(window);
