// Appearance/theme system — layered on top of the existing CSS variables via
// inline overrides on :root, so nothing in style.css has to change and the
// default look (accent "Cyan", transparency 50) is pixel-identical to before
// this existed. Doesn't touch playlist markup or CSS at all.
// Animated background: drifting pixel blocks / stars on one fixed canvas behind the app.
// Pauses when the tab is hidden and stays off for "Off" or when the OS asks for reduced motion.
const Background = (() => {
  let cv, ctx, raf = 0, mode = "off", speed = 1, items = []
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
  function accent() { return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5ad1ff" }
  function size() { cv.width = innerWidth; cv.height = innerHeight; seed() }
  function seed() {
    const n = mode === "stars" ? 90 : 38
    items = Array.from({ length: n }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, s: mode === "stars" ? 1 + Math.floor(Math.random() * 2) : 6 + Math.floor(Math.random() * 3) * 4, v: 0.15 + Math.random() * 0.5, a: 0.04 + Math.random() * 0.1 }))
  }
  function frame() {
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.fillStyle = accent()
    for (const it of items) {
      ctx.globalAlpha = it.a
      ctx.fillRect(Math.round(it.x), Math.round(it.y), it.s, it.s)
      it.y -= it.v * speed; if (mode === "blocks") it.x += Math.sin(it.y / 90) * 0.15 * speed
      if (it.y < -20) { it.y = cv.height + 10; it.x = Math.random() * cv.width }
    }
    raf = requestAnimationFrame(frame)
  }
  function set(m, motion) {
    if (!cv) {
      cv = document.createElement("canvas"); cv.id = "bg-canvas"; ctx = cv.getContext("2d")
      document.body.prepend(cv); addEventListener("resize", () => mode !== "off" && size())
      document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden && mode !== "off") frame() })
    }
    cancelAnimationFrame(raf)
    mode = (reduce || motion === "off" || m === "grid" || m === "off") ? "off" : m
    speed = motion === "calm" ? 0.5 : 1
    cv.style.display = mode === "off" ? "none" : ""
    if (mode !== "off") { size(); frame() }
  }
  return { set }
})()

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
  const DEFAULTS = { preset: "cyan", transparency: 50, font: "default", style: "block", bg: "blocks", motion: "normal", density: "comfy" }

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
    const d = document.documentElement.dataset
    d.font = state.font; d.style = state.style; d.motion = state.motion; d.density = state.density; d.bg = state.bg
    if (typeof Background !== "undefined") Background.set(state.bg, state.motion)
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

// New controls wire themselves (buttons carry data-theme-opt="key:value").
function syncThemeOpts() {
  const st = Theme.load()
  document.querySelectorAll("[data-theme-opt]").forEach(b => { const [k, v] = b.dataset.themeOpt.split(":"); b.classList.toggle("active", String(st[k]) === v) })
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-theme-opt]")
  if (b) { const [k, v] = b.dataset.themeOpt.split(":"); Theme.set({ [k]: v }); syncThemeOpts(); return }
  if (e.target.closest("#btn-theme-reset")) setTimeout(syncThemeOpts, 0)
})
document.addEventListener("DOMContentLoaded", syncThemeOpts)

// Applied immediately (before app.js) so there's no flash of un-themed content.
Theme.init()
