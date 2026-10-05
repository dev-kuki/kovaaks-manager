// Settings → Appearance: built from small helpers so every option is wired the same way.
(() => {
  const root = document.getElementById("appearance-root"); if (!root) return
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-theme-opt="${key}:${v}">${l}</button>`).join("")}</div>`
  const range = (key, min, max, step, label, unit = "") => `<div class="ap-range"><label for="ap-${key}">${label}</label><input type="range" id="ap-${key}" data-range="${key}" min="${min}" max="${max}" step="${step}"><span class="optional" data-range-val="${key}" data-unit="${unit}"></span></div>`
  const row = (label, body, hint = "") => `<div class="ap-row"><div class="ap-label">${label}${hint ? `<small>${hint}</small>` : ""}</div><div class="ap-ctl">${body}</div></div>`
  const group = (title, body) => `<div class="ap-group"><h3>${title}</h3>${body}</div>`

  root.innerHTML = `
    <div class="theme-card-hdr"><h2>Appearance</h2><button class="btn-ghost btn-sm" id="btn-theme-reset">Reset to default</button></div>
    ${group("Theme", `
      ${row("Mode", seg("mode", [["dark", "Dark"], ["light", "Light"], ["auto", "Auto"]]), "Auto follows your system")}
      ${row("Accent", `<div class="theme-swatches" id="theme-swatches"></div>`)}
      ${row("Custom colors", `<div class="ap-colors"><label>Accent <input type="color" id="ap-c1"></label><label>Accent 2 <input type="color" id="ap-c2"></label></div>`, "Pick your own pair")}
      ${row("Saved themes", `<div class="ap-save"><input type="text" id="ap-tname" maxlength="32" placeholder="name this theme…"><button class="btn-ghost btn-sm" id="ap-tsave">Save</button></div><div class="ap-chips" id="ap-themes"></div>`)}
      ${row("Share", `<div class="ap-save"><input type="text" id="ap-tcode" placeholder="paste a theme code…" class="mono"><button class="btn-ghost btn-sm" id="ap-timport">Apply</button><button class="btn-ghost btn-sm" id="ap-tcopy">Copy mine</button></div>`)}`)}
    ${group("Look", `
      ${row("Style", seg("style", [["block", "Blocky"], ["soft", "Soft"]]))}
      ${row("Font", seg("font", [["default", "Clean"], ["minecraft", "Minecraft"]]))}
      ${row("Density", seg("density", [["comfy", "Comfy"], ["compact", "Compact"]]))}
      ${row("Content width", seg("width", [["narrow", "Narrow"], ["wide", "Wide"], ["full", "Full"]]))}
      ${row("Row buttons", seg("actions", [["always", "Always"], ["hover", "On hover"]]), "Edit / delete / copy")}
      ${row("Folder tint", seg("tint", [["on", "On"], ["off", "Off"]]), "Colored folders and rows")}
      ${range("scale", 85, 125, 5, "UI scale", "%")}
      ${range("transparency", 5, 100, 5, "Panel transparency")}`)}
    ${group("Background", `
      ${row("Effect", seg("bg", [["blocks", "Blocks"], ["stars", "Stars"], ["embers", "Embers"], ["snow", "Snow"], ["rain", "Rain"], ["pulse", "Pulse"], ["aurora", "Aurora"], ["grid", "Grid"], ["off", "Off"]]))}
      ${range("intensity", 0, 100, 5, "Intensity")}
      ${range("speed", 25, 300, 25, "Speed", "%")}
      ${range("particles", 30, 200, 10, "Amount", "%")}
      ${row("Animations", seg("motion", [["normal", "Normal"], ["calm", "Calm"], ["off", "Off"]]))}
      ${row("Mouse parallax", seg("parallax", [["on", "On"], ["off", "Off"]]))}
      ${row("Behind content", seg("bgfull", [["off", "Gutters only"], ["on", "Everywhere"]]))}`)}`

  const $ = id => document.getElementById(id), toast = m => (typeof UI !== "undefined" && UI.toast) ? UI.toast(m) : console.log(m)
  function sync() {
    const st = Theme.load()
    $("theme-swatches").innerHTML = Theme.PRESETS.map(p => `<button type="button" class="theme-swatch${p.id === st.preset ? " active" : ""}" data-preset="${p.id}" title="${p.name}" style="--sw-a:${p.accent};--sw-b:${p.accent2}"></button>`).join("") +
      `<button type="button" class="theme-swatch custom${st.preset === "custom" ? " active" : ""}" data-preset="custom" title="Custom" style="--sw-a:${st.custom.accent};--sw-b:${st.custom.accent2}"></button>`
    $("ap-c1").value = st.custom.accent; $("ap-c2").value = st.custom.accent2
    root.querySelectorAll("[data-range]").forEach(r => { r.value = st[r.dataset.range]; const v = root.querySelector(`[data-range-val="${r.dataset.range}"]`); v.textContent = r.value + v.dataset.unit })
    $("ap-themes").innerHTML = Theme.listThemes().map(t => `<span class="ap-chip"><button type="button" data-apply="${esc(t.name)}">${esc(t.name)}</button><button type="button" class="x" data-del="${esc(t.name)}" title="Delete">✕</button></span>`).join("") || `<span class="ap-none">none saved yet</span>`
    syncThemeOpts()
  }
  root.addEventListener("click", e => {
    const t = e.target
    if (t.closest("#btn-theme-reset")) { Theme.reset(); toast("appearance reset"); return }
    const sw = t.closest("[data-preset]"); if (sw) return void Theme.set({ preset: sw.dataset.preset })
    const ap = t.closest("[data-apply]"); if (ap) return void Theme.applyTheme(ap.dataset.apply)
    const del = t.closest("[data-del]"); if (del) return void Theme.deleteTheme(del.dataset.del)
    if (t.closest("#ap-tsave")) { if (Theme.saveTheme($("ap-tname").value)) { $("ap-tname").value = ""; toast("theme saved") } else toast("give it a name first"); return }
    if (t.closest("#ap-tcopy")) { navigator.clipboard.writeText(Theme.exportCode()).then(() => toast("theme code copied"), () => toast("couldn't copy")); return }
    if (t.closest("#ap-timport")) { try { Theme.importCode($("ap-tcode").value); $("ap-tcode").value = ""; toast("theme applied") } catch { toast("that isn't a valid theme code") } }
  })
  root.addEventListener("input", e => {
    const r = e.target.closest("[data-range]"); if (r) return void Theme.set({ [r.dataset.range]: Number(r.value) })
    if (e.target.id === "ap-c1" || e.target.id === "ap-c2") Theme.set({ preset: "custom", custom: { accent: $("ap-c1").value, accent2: $("ap-c2").value } })
  })
  document.addEventListener("theme-change", sync)
  sync()
})()
