// Command palette (Ctrl/Cmd+K): jump anywhere, run actions, launch a playlist. "/" focuses search.
(() => {
  const wrap = document.createElement("div"); wrap.id = "palette"; wrap.className = "hidden"
  wrap.innerHTML = `<div class="pal-box" role="dialog" aria-label="Command palette"><input type="text" id="pal-input" placeholder="Search playlists or type a command…" autocomplete="off" spellcheck="false"><div class="pal-list" id="pal-list"></div><div class="pal-foot"><span>↑↓ move</span><span>↵ run</span><span>esc close</span></div></div>`
  document.body.appendChild(wrap)
  const input = wrap.querySelector("#pal-input"), list = wrap.querySelector("#pal-list")
  const click = sel => () => document.querySelector(sel)?.click()
  const nav = v => click(`.nav-btn[data-view="${v}"]`)
  const BG = ["blocks", "stars", "embers", "snow", "rain", "pulse", "aurora", "grid", "off"]
  const folders = open => () => document.querySelectorAll(".view.active .folder-item[data-folder-id]").forEach(f => {
    f.classList.toggle("open", open); const id = f.dataset.folderId; if (id) sessionStorage.setItem("fo-" + id, open ? "1" : "0")
  })
  const CMDS = [
    ["Go to Playlists", nav("playlists")], ["Go to Scenarios", nav("scenarios")], ["Go to Resources", nav("resources")], ["Go to Settings", nav("settings")],
    ["Open Routine", () => openPanel("routine")], ["Open Sensitivity tracker", () => openPanel("sens")], ["Open Export / Import", () => openPanel("transfer")],
    ["Add playlist", click("#btn-add-playlist")], ["New folder", click("#btn-new-folder")],
    ["Collapse all folders", folders(false)], ["Expand all folders", folders(true)],
    ["Theme: Dark", () => Theme.set({ mode: "dark" })], ["Theme: Light", () => Theme.set({ mode: "light" })], ["Theme: Auto", () => Theme.set({ mode: "auto" })],
    ["Next background effect", () => { const i = BG.indexOf(Theme.load().bg); Theme.set({ bg: BG[(i + 1) % BG.length] }) }],
    ["Copy theme code", () => navigator.clipboard.writeText(Theme.exportCode()).then(() => UI.toast("theme code copied"))],
    ["Reset appearance", () => Theme.reset()],
  ].map(([label, run]) => ({ label, run, kind: "command" }))
  const score = (q, s) => { s = s.toLowerCase(); if (!q) return 1; const i = s.indexOf(q); if (i >= 0) return 100 - i; let p = 0; for (const c of q) { p = s.indexOf(c, p) + 1; if (!p) return 0 } return 10 }
  let items = [], sel = 0
  function playlists() {
    const seen = new Set() // favorites show a playlist twice (Favorites + its own folder)
    return [...document.querySelectorAll("#view-playlists .playlist-row[data-playlist-id]")].filter(r => !seen.has(r.dataset.playlistId) && seen.add(r.dataset.playlistId))
      .map(r => ({ label: r.querySelector(".pl-name")?.textContent.trim() || "", row: r, kind: "playlist" })).filter(p => p.label)
  }
  function build() {
    const q = input.value.trim().toLowerCase()
    const all = (q ? [...CMDS, ...playlists()] : CMDS).map(x => ({ ...x, s: score(q, x.label) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s)
    items = all.slice(0, 40); sel = 0; draw()
  }
  const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
  function draw() {
    list.innerHTML = items.map((x, i) => `<div class="pal-item${i === sel ? " sel" : ""}" data-i="${i}"><span>${esc(x.label)}</span><em>${x.kind === "playlist" ? "open playlist" : "command"}</em></div>`).join("") || `<div class="pal-empty">nothing matches</div>`
    list.querySelector(".sel")?.scrollIntoView({ block: "nearest" })
  }
  function run(x) {
    close(); if (!x) return
    if (x.kind === "playlist") { const b = [...x.row.querySelectorAll("a,button")].find(b => /^\W*open\W*$/i.test(b.textContent.trim())); b ? b.click() : x.row.scrollIntoView({ block: "center" }) } else x.run()
  }
  function openPal() { closePanelSafe(); wrap.classList.remove("hidden"); input.value = ""; build(); input.focus() }
  function close() { wrap.classList.add("hidden") }
  const closePanelSafe = () => {}
  input.addEventListener("input", build)
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); draw(); e.preventDefault() }
    else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault() }
    else if (e.key === "Enter") run(items[sel])
    else if (e.key === "Escape") { close(); e.stopPropagation() }
  })
  list.addEventListener("click", e => { const it = e.target.closest(".pal-item"); if (it) run(items[+it.dataset.i]) })
  wrap.addEventListener("mousedown", e => { if (e.target === wrap) close() })
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); wrap.classList.contains("hidden") ? openPal() : close(); return }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
    if (e.key === "/" && !typing && wrap.classList.contains("hidden")) { const s = document.querySelector(".view.active .search-box input"); if (s) { e.preventDefault(); s.focus() } }
  })
  window.openPalette = openPal
})()
