// Appearance/theme system — layered on top of the existing CSS variables via
// inline overrides on :root, so nothing in style.css has to change and the
// default look (accent "Cyan", transparency 50) is pixel-identical to before
// this existed. Doesn't touch playlist markup or CSS at all.
const Theme = (() => {
  const PRESETS = [
    { id: "cyan",    name: "Cyan",    accent: "#5ad1ff", accent2: "#3ee6b8", onAccent: "#04141d" },
    { id: "violet",  name: "Violet",  accent: "#a78bfa", accent2: "#f472b6", onAccent: "#180f2e" },
    { id: "amber",   name: "Amber",   accent: "#fbbf24", accent2: "#fb923c", onAccent: "#241505" },
    { id: "emerald", name: "Emerald", accent: "#34d399", accent2: "#22d3ee", onAccent: "#04231a" },
    { id: "rose",    name: "Rose",    accent: "#fb7185", accent2: "#f472b6", onAccent: "#2a0410" },
    { id: "mono",    name: "Mono",    accent: "#e5e9f0", accent2: "#9aa5b8", onAccent: "#10141c" },
  ]
  const KEY = "km-theme"
  const DEFAULTS = { preset: "cyan", transparency: 50 }

  function hexToRgb(hex) {
    const m = hex.replace("#", "").match(/.{2}/g)
    return m.map(h => parseInt(h, 16))
  }
  function hexToRgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` }
  function rgbaScaled(rgb, baseAlpha, scale) {
    const a = Math.max(0.04, Math.min(1, baseAlpha * scale))
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`
  }

  function load() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}")) }
    catch { return Object.assign({}, DEFAULTS) }
  }
  function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {} }

  function apply(state) {
    const preset = PRESETS.find(p => p.id === state.preset) || PRESETS[0]
    const root = document.documentElement.style
    root.setProperty("--accent", preset.accent)
    root.setProperty("--accent-2", preset.accent2)
    root.setProperty("--on-accent", preset.onAccent)
    root.setProperty("--accent-dim", hexToRgba(preset.accent, 0.14))
    root.setProperty("--accent-glow", hexToRgba(preset.accent, 0.35))

    const v = Math.max(0, Math.min(100, Number(state.transparency) || 0))
    const scale = v / 50 // 50 == the original hardcoded look
    root.setProperty("--surface", rgbaScaled([30, 41, 59], 0.42, scale))
    root.setProperty("--surface-2", rgbaScaled([37, 50, 71], 0.6, scale))
    root.setProperty("--surface-3", rgbaScaled([51, 65, 90], 0.75, scale))
  }

  function init() { const s = load(); apply(s); return s }
  function set(partial) { const state = Object.assign(load(), partial); apply(state); save(state); return state }
  function reset() { localStorage.removeItem(KEY); const s = Object.assign({}, DEFAULTS); apply(s); return s }

  return { PRESETS, DEFAULTS, load, apply, init, set, reset }
})()

// Applied immediately (before app.js) so there's no flash of un-themed content.
Theme.init()
