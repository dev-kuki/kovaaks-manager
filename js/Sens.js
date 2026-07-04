// sens.js — sensitivity tracker + aimbeast playlists

// ── SENSITIVITY ──

async function initSens() {
  if (!DB.ready()) return
  try {
    const rows = await DB.getSens()
    renderSens(rows)
  } catch (err) { UI.toast("sens load failed: " + err.message) }
}

function renderSens(rows) {
  const grid = document.getElementById("sens-grid")
  grid.innerHTML = ""
  if (!rows.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-glyph">⊕</div><p>No types yet</p><span>Add a scenario type to track your sensitivity</span></div>`
    return
  }
  rows.forEach(row => grid.appendChild(makeSensCard(row)))
}

function makeSensCard(row) {
  const card = document.createElement("div")
  card.className = "sens-card"
  card.innerHTML = `
    <div class="sens-type-label">${esc(row.scenario_type)}</div>
    <div class="sens-input-wrap">
      <input class="sens-input" type="number" step="0.1" min="0" placeholder="—" value="${row.cm360 != null ? row.cm360 : ""}" data-id="${row.id}" data-type="${esc(row.scenario_type)}" />
    </div>
    <div class="sens-card-footer">
      <span class="sens-unit">cm / 360°</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="sens-save-btn" data-save-id="${row.id}" data-save-type="${esc(row.scenario_type)}">save</button>
        <button class="btn-icon" data-delete-sens="${row.id}" title="Remove type">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`

  const input = card.querySelector(".sens-input")
  const saveBtn = card.querySelector(".sens-save-btn")

  // save on button click
  saveBtn.addEventListener("click", async () => {
    const val = parseFloat(input.value)
    if (isNaN(val) || val <= 0) { UI.toast("enter a valid cm/360"); return }
    try {
      await DB.upsertSens(row.scenario_type, val)
      saveBtn.textContent = "saved ✓"; saveBtn.classList.add("saved")
      setTimeout(() => { saveBtn.textContent = "save"; saveBtn.classList.remove("saved") }, 2000)
    } catch (err) { UI.toast("error: " + err.message) }
  })

  // save on enter
  input.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click() })

  // delete type
  card.querySelector("[data-delete-sens]").addEventListener("click", async () => {
    if (!confirm(`Remove "${row.scenario_type}" sensitivity?`)) return
    try { await DB.deleteSensType(row.id); await initSens(); UI.toast(`"${row.scenario_type}" removed`) }
    catch (err) { UI.toast("error: " + err.message) }
  })

  return card
}

// add type modal
document.getElementById("btn-add-sens-type").addEventListener("click", () => {
  document.getElementById("sens-type-modal-overlay").classList.remove("hidden")
  document.getElementById("sens-type-input").value = ""
  setTimeout(() => document.getElementById("sens-type-input").focus(), 50)
})

function closeSensModal() { document.getElementById("sens-type-modal-overlay").classList.add("hidden") }
document.getElementById("sens-type-modal-close").addEventListener("click", closeSensModal)
document.getElementById("sens-type-modal-cancel").addEventListener("click", closeSensModal)
document.getElementById("sens-type-modal-overlay").addEventListener("click", e => { if (e.target === document.getElementById("sens-type-modal-overlay")) closeSensModal() })

document.getElementById("sens-type-modal-confirm").addEventListener("click", async () => {
  const name = document.getElementById("sens-type-input").value.trim()
  if (!name) return
  try {
    await DB.addSensType(name)
    closeSensModal(); await initSens(); UI.toast(`"${name}" added`)
  } catch (err) { UI.toast("error: " + err.message) }
})
document.getElementById("sens-type-input").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("sens-type-modal-confirm").click()
})


// ── AIMBEAST ──

let aimFolders = [], aimPlaylists = [], aimQuery = "", aimEditId = null

async function initAimbeast() {
  if (!DB.ready()) return
  try {
    ;[aimFolders, aimPlaylists] = await Promise.all([DB.getAimFolders(), DB.getAllAimPlaylists()])
    renderAimFolders()
    populateAimFolderSelect()
  } catch (err) { UI.toast("aimbeast load failed: " + err.message) }
}

function renderAimFolders() {
  const container = document.getElementById("aim-folders-container")
  document.getElementById("aim-count").textContent = aimPlaylists.filter(p =>
    !aimQuery || p.name.toLowerCase().includes(aimQuery) || (p.game_tag||"").toLowerCase().includes(aimQuery)
  ).length
  container.innerHTML = ""

  const byFolder = {}; const unassigned = []
  aimPlaylists.forEach(p => {
    const ok = !aimQuery || p.name.toLowerCase().includes(aimQuery) || (p.game_tag||"").toLowerCase().includes(aimQuery)
    if (!ok) return
    if (p.folder_id) { if (!byFolder[p.folder_id]) byFolder[p.folder_id] = []; byFolder[p.folder_id].push(p) }
    else unassigned.push(p)
  })

  const list = document.createElement("div"); list.className = "folders-list"
  aimFolders.forEach(f => {
    const items = byFolder[f.id]||[]
    if (aimQuery && !items.length) return
    list.appendChild(makeAimFolderEl(f, items))
  })
  if (unassigned.length) list.appendChild(makeAimFolderEl({ id: "none", name: "Unsorted" }, unassigned, true))

  if (!list.children.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-glyph">⬡</div><p>No Aimbeast playlists yet</p><span>Add playlists with their workshop URL or code</span></div>`
  } else {
    container.appendChild(list)
  }
}

function makeAimFolderEl(folder, playlists, ghost = false) {
  const el = document.createElement("div"); el.className = "folder-item"; el.dataset.aimFolderId = folder.id
  const key = "aim-fo-" + folder.id
  if (sessionStorage.getItem(key) === "1") el.classList.add("open")

  el.innerHTML = `
    <div class="folder-header">
      <span class="folder-chevron">›</span>
      <span class="folder-name">${esc(folder.name)}</span>
      <span class="folder-count">${playlists.length}</span>
      ${!ghost ? `<button class="btn-icon aim-folder-del" data-aim-folder-id="${folder.id}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : ""}
    </div>
    <div class="folder-body"></div>`

  el.querySelector(".folder-header").addEventListener("click", e => {
    if (e.target.closest(".aim-folder-del")) return
    el.classList.toggle("open"); sessionStorage.setItem(key, el.classList.contains("open") ? "1" : "0")
  })

  const body = el.querySelector(".folder-body")
  if (!playlists.length) {
    body.innerHTML = `<div class="empty-state" style="padding:20px"><span>No playlists in this folder</span></div>`
  } else {
    playlists.forEach(p => body.appendChild(makeAimPlaylistRow(p)))
  }
  return el
}

function makeAimPlaylistRow(p) {
  const row = document.createElement("div"); row.className = "playlist-row"
  row.innerHTML = `
    <span class="pl-dot" style="background:var(--success)"></span>
    <span class="pl-name">${esc(p.name)}</span>
    ${p.game_tag ? `<span class="pl-tag">${esc(p.game_tag)}</span>` : ""}
    ${p.workshop_url ? `<span class="aim-badge">workshop</span>` : ""}
    ${p.playlist_code ? `<span class="aim-badge">code</span>` : ""}
    <div class="pl-actions">
      ${p.workshop_url ? `<a class="btn-open-url" href="${esc(p.workshop_url)}" target="_blank" rel="noopener">open</a>` : ""}
      <button class="btn-edit" data-aim-edit="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon" data-aim-delete="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>`
  return row
}

function populateAimFolderSelect(selectedId = "") {
  const sel = document.getElementById("aim-pl-folder"); if (!sel) return
  sel.innerHTML = '<option value="">— no folder —</option>'
  aimFolders.forEach(f => {
    const o = document.createElement("option"); o.value = f.id; o.textContent = f.name
    if (f.id === selectedId) o.selected = true; sel.appendChild(o)
  })
}

function openAimModal(playlist = null) {
  aimEditId = playlist ? playlist.id : null
  document.getElementById("aim-modal-title").textContent = playlist ? "Edit playlist" : "Add Aimbeast playlist"
  document.getElementById("aim-pl-name").value = playlist?.name || ""
  document.getElementById("aim-pl-game").value = playlist?.game_tag || ""
  document.getElementById("aim-pl-url").value = playlist?.workshop_url || ""
  document.getElementById("aim-pl-code").value = playlist?.playlist_code || ""
  document.getElementById("aim-pl-notes").value = playlist?.notes || ""
  populateAimFolderSelect(playlist?.folder_id || "")
  document.getElementById("aim-modal-overlay").classList.remove("hidden")
  setTimeout(() => document.getElementById("aim-pl-name").focus(), 50)
}

function closeAimModal() { document.getElementById("aim-modal-overlay").classList.add("hidden"); aimEditId = null }

document.getElementById("btn-add-aim-playlist").addEventListener("click", () => openAimModal())
document.getElementById("aim-modal-close").addEventListener("click", closeAimModal)
document.getElementById("aim-modal-cancel").addEventListener("click", closeAimModal)
document.getElementById("aim-modal-overlay").addEventListener("click", e => { if (e.target === document.getElementById("aim-modal-overlay")) closeAimModal() })

document.getElementById("aim-modal-confirm").addEventListener("click", async () => {
  const name = document.getElementById("aim-pl-name").value.trim()
  if (!name) { document.getElementById("aim-pl-name").focus(); return }
  const payload = {
    name,
    folderId: document.getElementById("aim-pl-folder").value,
    gameTag: document.getElementById("aim-pl-game").value.trim(),
    workshopUrl: document.getElementById("aim-pl-url").value.trim(),
    playlistCode: document.getElementById("aim-pl-code").value.trim(),
    notes: document.getElementById("aim-pl-notes").value.trim(),
  }
  try {
    if (aimEditId) { await DB.updateAimPlaylist(aimEditId, payload); UI.toast(`"${name}" updated`) }
    else { await DB.uploadAimPlaylist(payload); UI.toast(`"${name}" added`) }
    closeAimModal(); await initAimbeast()
  } catch (err) { UI.toast("error: " + err.message) }
})

document.getElementById("btn-new-aim-folder").addEventListener("click", () => {
  UI.openFolderModal(async name => {
    try { await DB.createAimFolder(name); await initAimbeast(); UI.toast(`"${name}" created`) }
    catch (err) { UI.toast("error: " + err.message) }
  })
})

document.getElementById("aim-search").addEventListener("input", e => {
  aimQuery = e.target.value.toLowerCase().trim(); renderAimFolders()
})

document.getElementById("aim-folders-container").addEventListener("click", async e => {
  if (e.target.closest(".aim-folder-del")) {
    const id = e.target.closest("[data-aim-folder-id]").dataset.aimFolderId
    const f = aimFolders.find(x => x.id === id)
    if (!f || !confirm(`Delete folder "${f.name}"?`)) return
    try { await DB.deleteAimFolder(id); await initAimbeast(); UI.toast(`"${f.name}" deleted`) }
    catch (err) { UI.toast("error: " + err.message) }
    return
  }
  const editBtn = e.target.closest("[data-aim-edit]")
  if (editBtn) {
    const pl = aimPlaylists.find(p => p.id === editBtn.dataset.aimEdit)
    if (pl) openAimModal(pl); return
  }
  const delBtn = e.target.closest("[data-aim-delete]")
  if (delBtn) {
    const pl = aimPlaylists.find(p => p.id === delBtn.dataset.aimDelete)
    if (!pl || !confirm(`Delete "${pl.name}"?`)) return
    try { await DB.deleteAimPlaylist(pl.id); await initAimbeast(); UI.toast(`"${pl.name}" deleted`) }
    catch (err) { UI.toast("error: " + err.message) }
  }
})

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
}
