// Theme engine: colours, light/dark, layout options, saved themes, and the animated background.
// Everything is applied through CSS variables / data-attributes on <html>, so style.css stays untouched.

// ── animated background: one fixed canvas behind the app ──
const Background = (() => {
  let cv, ctx, raf = 0, last = 0, mode = "off", o = { speed: 1, intensity: .7, density: 1, parallax: false }
  let items = [], cells = [], mx = 0, my = 0, px = 0, py = 0
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
  const CANVAS_MODES = ["blocks", "stars", "embers", "snow", "rain", "pulse"]
  const BASE = { blocks: 34000, stars: 16000, embers: 26000, snow: 15000, rain: 11000, pulse: 0 }
  const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
  const light = () => document.documentElement.dataset.mode === "light"
  function size() { cv.width = innerWidth + 80; cv.height = innerHeight + 80; seed() }
  function mk() {
    const r = Math.random(), p = { x: Math.random() * cv.width, y: Math.random() * cv.height, p: Math.random() * 6.28 }
    const pick = a => a[Math.floor(Math.random() * a.length)]
    if (mode === "blocks") Object.assign(p, { s: pick([8, 8, 12, 16, 24]), v: .12 + r * .4, a: .14 + Math.random() * .2 })
    else if (mode === "stars") Object.assign(p, { s: 4, v: .12 + r * .3, a: .25 + Math.random() * .5 })
    else if (mode === "embers") Object.assign(p, { s: pick([4, 4, 8]), v: .35 + r * .9, a: .3 + Math.random() * .5, c: r < .5 })
    else if (mode === "snow") Object.assign(p, { s: pick([4, 4, 8]), v: .4 + r * .9, a: .25 + Math.random() * .5 })
    else if (mode === "rain") Object.assign(p, { s: 2, l: 14 + r * 18, v: 6 + Math.random() * 5, a: .16 + Math.random() * .3 })
    return p
  }
  function seed() {
    cells = []
    const n = BASE[mode] ? Math.max(10, Math.round(cv.width * cv.height / BASE[mode] * o.density)) : 0
    items = Array.from({ length: n }, mk)
  }
  function frame(t) {
    const dt = Math.min(3, (t - last) / 16.7 || 1); last = t
    const W = cv.width, H = cv.height, sp = o.speed * dt, k = o.intensity * 1.4
    ctx.clearRect(0, 0, W, H)
    const a1 = cssv("--accent") || "#5ad1ff", a2 = cssv("--accent-2") || a1, white = light() ? a1 : "#fff"
    for (const it of items) {
      const x = Math.round(it.x / 4) * 4, y = Math.round(it.y / 4) * 4, s = it.s
      if (mode === "blocks") {
        ctx.globalAlpha = it.a * k; ctx.fillStyle = a1; ctx.fillRect(x, y, s, s)   // lit top-left, shaded bottom-right: reads as a cube
        ctx.globalAlpha = it.a * k * .7; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, s, 2); ctx.fillRect(x, y, 2, s)
        ctx.globalAlpha = it.a * k * .8; ctx.fillStyle = "#000"; ctx.fillRect(x, y + s - 2, s, 2); ctx.fillRect(x + s - 2, y, 2, s)
        it.y -= it.v * sp; it.x += Math.sin(it.y / 120 + it.p) * .12 * sp
      } else if (mode === "stars") {
        ctx.globalAlpha = it.a * k * (.55 + .45 * Math.sin(t / 900 + it.p)); ctx.fillStyle = white; ctx.fillRect(x, y, s, s); it.y -= it.v * sp
      } else if (mode === "embers") {
        ctx.fillStyle = it.c ? a1 : a2; ctx.globalAlpha = it.a * k * (.6 + .4 * Math.sin(t / 200 + it.p)); ctx.fillRect(x, y, s, s)
        ctx.globalAlpha *= .22; ctx.fillRect(x - s, y - s, s * 3, s * 3)
        it.y -= it.v * sp; it.x += Math.sin(it.y / 60 + it.p) * .4 * sp
      } else if (mode === "snow") {
        ctx.globalAlpha = it.a * k; ctx.fillStyle = white; ctx.fillRect(x, y, s, s)
        it.y += it.v * sp; it.x += Math.sin(it.y / 80 + it.p) * .3 * sp
      } else if (mode === "rain") {
        ctx.globalAlpha = it.a * k; ctx.fillStyle = a1; ctx.fillRect(x, y, 2, it.l); it.y += it.v * sp
      }
      if (it.y < -40 || it.y > H + 40) { it.x = Math.random() * W; it.y = (mode === "snow" || mode === "rain") ? -30 : H + 20 }
    }
    if (mode === "pulse") {   // inventory-slot cells fading in and out on a 32px grid
      if (cells.length < 70 * o.density && Math.random() < .09 * o.density * dt) cells.push({ cx: Math.floor(Math.random() * W / 32), cy: Math.floor(Math.random() * H / 32), life: 0, max: 120 + Math.random() * 140, c: Math.random() < .3 })
      cells = cells.filter(c => (c.life += sp) < c.max)
      for (const c of cells) {
        const a = Math.sin(Math.PI * c.life / c.max) * .24 * k, x = c.cx * 32 + 2, y = c.cy * 32 + 2
        ctx.globalAlpha = a; ctx.fillStyle = c.c ? a2 : a1; ctx.fillRect(x, y, 28, 28)
        ctx.globalAlpha = a * .8; ctx.fillStyle = "#fff"; ctx.fillRect(x, y, 28, 2); ctx.fillRect(x, y, 2, 28)
        ctx.fillStyle = "#000"; ctx.fillRect(x, y + 26, 28, 2); ctx.fillRect(x + 26, y, 2, 28)
      }
    }
    if (o.parallax) { px += (mx - px) * .06; py += (my - py) * .06; cv.style.transform = `translate3d(${(-px * 26).toFixed(1)}px,${(-py * 26).toFixed(1)}px,0)` }
    else if (px || py) { px = py = 0; cv.style.transform = "" }
    raf = requestAnimationFrame(frame)
  }
  function set(m, motion, opts) {
    if (!cv) {
      cv = document.createElement("canvas"); cv.id = "bg-canvas"; ctx = cv.getContext("2d")
      document.body.prepend(cv)
      addEventListener("resize", () => mode !== "off" && size())
      addEventListener("mousemove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5 })
      document.addEventListener("visibilitychange", () => { cancelAnimationFrame(raf); if (!document.hidden && mode !== "off") frame(performance.now()) })
    }
    cancelAnimationFrame(raf)
    o = Object.assign(o, opts || {})
    mode = (reduce || motion === "off" || !CANVAS_MODES.includes(m)) ? "off" : m
    o.speed = (opts ? opts.speed : o.speed) * (motion === "calm" ? .5 : 1)
    cv.style.display = mode === "off" ? "none" : ""
    if (mode !== "off") { size(); frame(performance.now()) }
  }
  return { set }
})()

const Theme = (() => {
  const PRESETS = [
    { id: "cyan",    name: "Cyan",    accent: "#5ad1ff", accent2: "#3ee6b8" },
    { id: "ocean",   name: "Ocean",   accent: "#4f8cff", accent2: "#2ee6c1" },
    { id: "violet",  name: "Violet",  accent: "#a78bfa", accent2: "#f472b6" },
    { id: "sakura",  name: "Sakura",  accent: "#ff8fb8", accent2: "#c9a7ff" },
    { id: "rose",    name: "Rose",    accent: "#fb7185", accent2: "#f472b6" },
    { id: "ember",   name: "Ember",   accent: "#ff7a45", accent2: "#ffc24b" },
    { id: "amber",   name: "Amber",   accent: "#fbbf24", accent2: "#fb923c" },
    { id: "lime",    name: "Lime",    accent: "#a3e635", accent2: "#22d3ee" },
    { id: "emerald", name: "Emerald", accent: "#34d399", accent2: "#22d3ee" },
    { id: "mono",    name: "Mono",    accent: "#e5e9f0", accent2: "#9aa5b8" },
  ]
  const KEY = "km-theme", TKEY = "km-themes"
  const DEFAULTS = { preset: "cyan", custom: { accent: "#5ad1ff", accent2: "#3ee6b8" }, mode: "dark", transparency: 50, fv: 2, font: "minecraft", style: "block", bg: "blocks", motion: "normal", density: "comfy",
    intensity: 70, speed: 100, particles: 100, parallax: "on", bgfull: "off", width: "wide", scale: 100, actions: "always", tint: "on" }
  const HEX = /^#[0-9a-f]{6}$/i

  const rgb = hex => hex.replace("#", "").match(/.{2}/g).map(h => parseInt(h, 16))
  const hex = c => "#" + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
  const mix = (h, t, a) => { const x = rgb(h), y = rgb(t); return hex(x.map((v, i) => v + (y[i] - v) * a)) }
  const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4) }); return .2126 * r + .7152 * g + .0722 * b }
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})` }
  const scaled = (c, base, s) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(.04, Math.min(1, base * s)).toFixed(3)})`

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}"), s = Object.assign({}, DEFAULTS, saved)
      if (!saved.fv) s.font = "minecraft" // rebrand ships with the Minecraft font on; Clean is one click away
      s.fv = 2; return s
    } catch { return Object.assign({}, DEFAULTS) }
  }
  const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)) } catch {} }
  const resolveMode = st => st.mode === "auto" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : (st.mode === "light" ? "light" : "dark")

  function apply(st) {
    const root = document.documentElement, d = root.dataset, mode = resolveMode(st), isLight = mode === "light"
    Object.assign(d, { mode, font: st.font, style: st.style, motion: st.motion, density: st.density, bg: st.bg, width: st.width, actions: st.actions, tint: st.tint, bgfull: st.bgfull })
    root.style.colorScheme = mode
    const p = PRESETS.find(x => x.id === st.preset)
    let a1 = p ? p.accent : (HEX.test(st.custom.accent) ? st.custom.accent : "#5ad1ff"), a2 = p ? p.accent2 : (HEX.test(st.custom.accent2) ? st.custom.accent2 : a1)
    if (isLight) { for (const k of [0, 1]) { let c = k ? a2 : a1; c = lum(c) > .6 ? "#2a3446" : mix(c, "#000000", .3); k ? a2 = c : a1 = c } }
    else if (lum(a1) < .12) a1 = mix(a1, "#ffffff", .4)
    const on = lum(a1) > .42 ? "#07101c" : "#ffffff", s = root.style
    s.setProperty("--accent", a1); s.setProperty("--accent-2", a2); s.setProperty("--on-accent", on)
    s.setProperty("--accent-dim", rgba(a1, isLight ? .12 : .14)); s.setProperty("--accent-glow", rgba(a1, .35))
    const t = Math.max(0, Math.min(100, Number(st.transparency) || 0)) / 50
    s.setProperty("--surface", isLight ? scaled([255, 255, 255], .62, t) : scaled([30, 41, 59], .42, t))
    s.setProperty("--surface-2", isLight ? scaled([236, 241, 248], .85, t) : scaled([37, 50, 71], .6, t))
    s.setProperty("--surface-3", isLight ? scaled([220, 228, 240], .92, t) : scaled([51, 65, 90], .75, t))
    s.setProperty("--bg-i", String(Math.max(0, Math.min(100, Number(st.intensity)))/100))
    s.setProperty("--ui-scale", String((Number(st.scale) || 100) / 100))
    if (typeof Background !== "undefined") Background.set(st.bg, st.motion, { speed: (Number(st.speed) || 100) / 100, intensity: (Number(st.intensity) || 0) / 100, density: (Number(st.particles) || 100) / 100, parallax: st.parallax === "on" })
  }

  function emit() { document.dispatchEvent(new CustomEvent("theme-change")) }
  function init() { const s = load(); apply(s); return s }
  function set(partial) { const st = Object.assign(load(), partial); apply(st); save(st); emit(); return st }
  function reset() { localStorage.removeItem(KEY); const s = Object.assign({}, DEFAULTS); apply(s); emit(); return s }
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (load().mode === "auto") apply(load()) })

  // saved themes + share codes
  const listThemes = () => { try { return JSON.parse(localStorage.getItem(TKEY) || "[]") } catch { return [] } }
  const putThemes = l => { try { localStorage.setItem(TKEY, JSON.stringify(l)) } catch {} }
  function saveTheme(name) { name = name.trim().slice(0, 32); if (!name) return false; putThemes(listThemes().filter(t => t.name !== name).concat({ name, state: load() })); emit(); return true }
  function applyTheme(name) { const t = listThemes().find(x => x.name === name); return t ? set(t.state) : null }
  function deleteTheme(name) { putThemes(listThemes().filter(t => t.name !== name)); emit() }
  const exportCode = () => "AIMTHEME:" + btoa(unescape(encodeURIComponent(JSON.stringify(load()))))
  function importCode(code) {
    const raw = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^AIMTHEME:/, ""))))), clean = {}
    for (const k of Object.keys(DEFAULTS)) if (k in raw && k !== "fv") clean[k] = raw[k]
    if (clean.custom) clean.custom = { accent: HEX.test(clean.custom.accent) ? clean.custom.accent : DEFAULTS.custom.accent, accent2: HEX.test(clean.custom.accent2) ? clean.custom.accent2 : DEFAULTS.custom.accent2 }
    return set(clean)
  }
  return { PRESETS, DEFAULTS, load, apply, init, set, reset, listThemes, saveTheme, applyTheme, deleteTheme, exportCode, importCode }
})()

// Option buttons wire themselves (data-theme-opt="key:value").
function syncThemeOpts() {
  const st = Theme.load()
  document.querySelectorAll("[data-theme-opt]").forEach(b => { const [k, v] = b.dataset.themeOpt.split(":"); b.classList.toggle("active", String(st[k]) === v) })
}
document.addEventListener("click", e => { const b = e.target.closest("[data-theme-opt]"); if (b) { const [k, v] = b.dataset.themeOpt.split(":"); Theme.set({ [k]: v }); syncThemeOpts() } })
document.addEventListener("DOMContentLoaded", syncThemeOpts)
document.addEventListener("theme-change", syncThemeOpts)
Theme.init() // applied before app.js so there's no flash of un-themed content

// nav tabs collapse to icons on small screens, so give them tooltips
document.addEventListener("DOMContentLoaded", () => document.querySelectorAll(".nav-btn").forEach(b => { b.title = b.textContent.trim() }))
