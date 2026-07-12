const UI = (() => {
  let toastTimer = null

  function toast(msg, dur = 2500) {
    const el = document.getElementById("toast")
    el.textContent = msg; el.classList.add("show")
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), dur)
  }

  function setStatus(state) {
    const dot = document.getElementById("conn-dot")
    const label = document.getElementById("conn-label")
    dot.className = "conn-dot " + state
    label.textContent = { connected: "connected", disconnected: "not connected", connecting: "connecting…" }[state] || state
  }

  function setFeedback(id, msg, isErr = false) {
    const el = document.getElementById(id); if (!el) return
    el.textContent = msg; el.className = isErr ? "err" : "ok"
  }

  function populateFolderSelect(folders, selId = "pl-folder", selectedId = "") {
    const sel = document.getElementById(selId); if (!sel) return
    sel.innerHTML = '<option value="">— no folder —</option>'
    folders.forEach(f => {
      const o = document.createElement("option"); o.value = f.id; o.textContent = f.name
      if (f.id === selectedId) o.selected = true; sel.appendChild(o)
    })
  }

  function renderFolders(folders, playlists, query = "") {
    const container = document.getElementById("folders-container")
    const byFolder = {}; const unassigned = []

    playlists.forEach(p => {
      const ok = !query || p.name.toLowerCase().includes(query) || (p.game_tag||"").toLowerCase().includes(query)
      if (!ok) return
      if (p.folder_id) { if (!byFolder[p.folder_id]) byFolder[p.folder_id] = []; byFolder[p.folder_id].push(p) }
      else unassigned.push(p)
    })
    const byPinFirst = (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    Object.values(byFolder).forEach(list => list.sort(byPinFirst))
    unassigned.sort(byPinFirst)

    container.innerHTML = ""
    const visible = playlists.filter(p => !query || p.name.toLowerCase().includes(query) || (p.game_tag||"").toLowerCase().includes(query))
    document.getElementById("playlist-count").textContent = visible.length

    if (visible.length === 0 && folders.length === 0) {
      container.innerHTML = document.getElementById("empty-playlists").outerHTML; return
    }

    const list = document.createElement("div"); list.className = "folders-list"
    folders.forEach(f => { const items = byFolder[f.id]||[]; if (query && !items.length) return; list.appendChild(makeFolderEl(f, items)) })
    if (unassigned.length) list.appendChild(makeFolderEl({ id: "none", name: "Unsorted" }, unassigned, true))
    if (!list.children.length) { container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◻</div><p>No results for "${esc(query)}"</p></div>`; return }
    container.appendChild(list)
  }

  function makeFolderEl(folder, playlists, ghost = false) {
    const el = document.createElement("div"); el.className = "folder-item"; el.dataset.folderId = folder.id
    const key = "fo-" + folder.id
    if (sessionStorage.getItem(key) === "1") el.classList.add("open")

    el.innerHTML = `
      <div class="folder-header">
        <span class="folder-chevron">›</span>
        <span class="folder-name">${esc(folder.name)}</span>
        <span class="folder-count">${playlists.length}</span>
        ${!ghost ? `<button class="btn-icon folder-del" data-folder-id="${folder.id}" title="Delete folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ""}
      </div>
      <div class="folder-body"></div>`

    el.querySelector(".folder-header").addEventListener("click", e => {
      if (e.target.closest(".folder-del")) return
      el.classList.toggle("open"); sessionStorage.setItem(key, el.classList.contains("open") ? "1" : "0")
    })

    const body = el.querySelector(".folder-body")
    if (!playlists.length) {
      body.innerHTML = `<div class="empty-state" style="padding:20px"><span>No playlists in this folder</span></div>`
    } else {
      playlists.forEach(p => body.appendChild(makePlaylistRow(p)))
    }
    return el
  }

  function makePlaylistRow(p) {
    const row = document.createElement("div"); row.className = "playlist-row" + (p.pinned ? " is-pinned" : ""); row.dataset.playlistId = p.id
    row.innerHTML = `
      <button class="btn-star" data-pin-pl="${p.id}" data-pinned="${p.pinned ? "1" : "0"}" title="${p.pinned ? "Unpin" : "Pin"}">
        <svg viewBox="0 0 24 24" fill="${p.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <span class="pl-dot"></span>
      <span class="pl-name">${esc(p.name)}</span>
      ${p.game_tag ? `<span class="pl-tag">${esc(p.game_tag)}</span>` : ""}
      <div class="pl-actions">
        ${p.share_code ? `<a class="btn-launch" href="steam://run/824270/?action=jump-to-playlist;sharecode=${esc(p.share_code)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>open
        </a>` : ""}
        <button class="btn-copy" data-name="${esc(p.name)}">copy</button>
        <button class="btn-edit" data-playlist-id="${p.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" data-download-id="${p.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-icon" data-delete-pl="${p.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`
    return row
  }

  function renderScenarios(scenarios, query = "") {
    const container = document.getElementById("scenarios-container")
    const filtered = scenarios.filter(s => !query || s.name.toLowerCase().includes(query) || (s.game_tag||"").toLowerCase().includes(query))
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
    document.getElementById("scenario-count").textContent = filtered.length
    container.innerHTML = ""

    if (!filtered.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◎</div><p>${query ? `No results for "${esc(query)}"` : "No scenarios yet"}</p><span>Add scenarios with their share codes to launch them directly</span></div>`
      return
    }

    const grid = document.createElement("div"); grid.className = "scenarios-grid"
    filtered.forEach(s => grid.appendChild(makeScenarioCard(s)))
    container.appendChild(grid)
  }

  function makeScenarioCard(s) {
    const card = document.createElement("div"); card.className = "scenario-card" + (s.pinned ? " is-pinned" : ""); card.dataset.scenarioId = s.id
    card.innerHTML = `
      <button class="btn-star btn-star-card" data-pin-sc="${s.id}" data-pinned="${s.pinned ? "1" : "0"}" title="${s.pinned ? "Unpin" : "Pin"}">
        <svg viewBox="0 0 24 24" fill="${s.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <div class="sc-name">${esc(s.name)}</div>
      ${s.game_tag ? `<span class="sc-tag">${esc(s.game_tag)}</span>` : ""}
      ${s.share_code ? `<div class="sc-code">${esc(s.share_code)}</div>` : ""}
      <div class="sc-actions">
        ${s.share_code ? `<a class="btn-launch" href="steam://run/824270/?action=jump-to-scenario;sharecode=${esc(s.share_code)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>open
        </a>` : ""}
        <button class="btn-edit" data-scenario-id="${s.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" data-delete-sc="${s.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`
    return card
  }

  // modals
  function openFolderModal(onConfirm) {
    const overlay = document.getElementById("modal-overlay")
    const input = document.getElementById("folder-name-input")
    overlay.classList.remove("hidden"); input.value = ""; input.focus()

    function done(confirmed) {
      overlay.classList.add("hidden")
      cleanup()
      if (confirmed) { const n = input.value.trim(); if (n) onConfirm(n) }
    }
    function cleanup() {
      document.getElementById("modal-confirm").onclick = null
      document.getElementById("modal-cancel").onclick = null
      document.getElementById("modal-close").onclick = null
      overlay.onclick = null; input.onkeydown = null
    }
    document.getElementById("modal-confirm").onclick = () => done(true)
    document.getElementById("modal-cancel").onclick = () => done(false)
    document.getElementById("modal-close").onclick = () => done(false)
    overlay.onclick = e => { if (e.target === overlay) done(false) }
    input.onkeydown = e => { if (e.key === "Enter") done(true) }
  }

  function openEditModal(playlist, folders, onSave) {
    const overlay = document.getElementById("edit-modal-overlay")
    overlay.classList.remove("hidden")
    document.getElementById("edit-pl-name").value = playlist.name || ""
    document.getElementById("edit-pl-game").value = playlist.game_tag || ""
    document.getElementById("edit-pl-notes").value = playlist.notes || ""
    document.getElementById("edit-pl-share").value = playlist.share_code || ""
    document.getElementById("edit-file-label").textContent = "Leave empty to keep current file"
    document.getElementById("edit-pl-file").value = ""
    populateFolderSelect(folders, "edit-pl-folder", playlist.folder_id || "")

    const fileInput = document.getElementById("edit-pl-file")
    fileInput.onchange = () => {
      document.getElementById("edit-file-label").textContent = fileInput.files[0] ? fileInput.files[0].name : "Leave empty to keep current file"
    }

    function cleanup() {
      overlay.classList.add("hidden")
      document.getElementById("edit-modal-save").onclick = null
      document.getElementById("edit-modal-cancel").onclick = null
      document.getElementById("edit-modal-close").onclick = null
      overlay.onclick = null; fileInput.onchange = null
    }

    document.getElementById("edit-modal-save").onclick = async () => {
      const name = document.getElementById("edit-pl-name").value.trim()
      if (!name) { document.getElementById("edit-pl-name").focus(); return }
      let fileData = undefined
      const file = fileInput.files[0]
      if (file) { try { fileData = JSON.parse(await file.text()) } catch { toast("not valid JSON"); return } }
      cleanup()
      onSave({ name, folderId: document.getElementById("edit-pl-folder").value, gameTag: document.getElementById("edit-pl-game").value.trim(), notes: document.getElementById("edit-pl-notes").value.trim(), shareCode: document.getElementById("edit-pl-share").value.trim(), fileData })
    }
    document.getElementById("edit-modal-cancel").onclick = cleanup
    document.getElementById("edit-modal-close").onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  function openScenarioBulkModal(onConfirm) {
    const overlay = document.getElementById("scenario-modal-overlay")
    overlay.classList.remove("hidden")
    document.getElementById("scenario-bulk-input").value = ""
    document.getElementById("scenario-bulk-input").focus()

    function cleanup() {
      overlay.classList.add("hidden")
      document.getElementById("scenario-modal-confirm").onclick = null
      document.getElementById("scenario-modal-cancel").onclick = null
      document.getElementById("scenario-modal-close").onclick = null
      overlay.onclick = null
    }
    document.getElementById("scenario-modal-confirm").onclick = () => {
      const raw = document.getElementById("scenario-bulk-input").value.trim()
      if (!raw) return
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean)
      const parsed = lines.map(line => {
        const parts = line.split("|").map(p => p.trim())
        return { name: parts[0]||"", shareCode: parts[1]||"", gameTag: parts[2]||"" }
      }).filter(s => s.name)
      cleanup(); onConfirm(parsed)
    }
    document.getElementById("scenario-modal-cancel").onclick = cleanup
    document.getElementById("scenario-modal-close").onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  function openEditScenarioModal(scenario, onSave) {
    const overlay = document.getElementById("edit-scenario-modal-overlay")
    overlay.classList.remove("hidden")
    document.getElementById("edit-sc-name").value = scenario.name || ""
    document.getElementById("edit-sc-share").value = scenario.share_code || ""
    document.getElementById("edit-sc-game").value = scenario.game_tag || ""
    document.getElementById("edit-sc-notes").value = scenario.notes || ""

    function cleanup() {
      overlay.classList.add("hidden")
      document.getElementById("edit-scenario-modal-save").onclick = null
      document.getElementById("edit-scenario-modal-cancel").onclick = null
      document.getElementById("edit-scenario-modal-close").onclick = null
      overlay.onclick = null
    }
    document.getElementById("edit-scenario-modal-save").onclick = () => {
      const name = document.getElementById("edit-sc-name").value.trim()
      if (!name) return
      cleanup()
      onSave({ name, shareCode: document.getElementById("edit-sc-share").value.trim(), gameTag: document.getElementById("edit-sc-game").value.trim(), notes: document.getElementById("edit-sc-notes").value.trim() })
    }
    document.getElementById("edit-scenario-modal-cancel").onclick = cleanup
    document.getElementById("edit-scenario-modal-close").onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  function esc(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
  }

  return { toast, setStatus, setFeedback, populateFolderSelect, renderFolders, renderScenarios, openFolderModal, openEditModal, openScenarioBulkModal, openEditScenarioModal }
})()
