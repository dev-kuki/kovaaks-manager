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

  // items with no explicit position sort to the bottom, alphabetically
  function byOrder(a, b) {
    const pa = a.position == null ? Infinity : a.position
    const pb = b.position == null ? Infinity : b.position
    return pa - pb || String(a.name).localeCompare(String(b.name))
  }

  function populateFolderSelect(folders, selId = "pl-folder", selectedId = "") {
    const sel = document.getElementById(selId); if (!sel) return
    sel.innerHTML = '<option value="">— no folder —</option>'
    folders.slice().sort(byOrder).forEach(f => {
      const o = document.createElement("option"); o.value = f.id; o.textContent = f.name
      if (f.id === selectedId) o.selected = true; sel.appendChild(o)
    })
  }

  const dragHandleSvg = `<span class="drag-handle" draggable="true" title="Drag to reorder"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></span>`

  function matches(p, q) {
    return !q || [p.name, p.game_tag, p.notes, p.share_code].some(v => (v || "").toLowerCase().includes(q))
  }

  // Favorites (pinned) get their own section on top, "Unsorted" is always there as a drop target,
  // and the empty state no longer crashes after the last playlist is deleted.
  function renderFolders(folders, playlists, query = "") {
    const container = document.getElementById("folders-container")
    const byFolder = {}, unassigned = []
    const visible = playlists.filter(p => matches(p, query))
    visible.forEach(p => { if (p.folder_id) (byFolder[p.folder_id] = byFolder[p.folder_id] || []).push(p); else unassigned.push(p) })
    Object.values(byFolder).forEach(l => l.sort(byOrder)); unassigned.sort(byOrder)
    document.getElementById("playlist-count").textContent = visible.length
    container.classList.toggle("no-drag", !!query)
    container.innerHTML = ""

    if (!playlists.length && !folders.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-glyph">⬡</div><p>No playlists yet</p><span>Hit “Add playlist” — the .json file is optional, a share code is enough</span></div>`
      return
    }
    const list = document.createElement("div"); list.className = "folders-list"
    const favs = visible.filter(p => p.pinned).sort(byOrder)
    if (favs.length) list.appendChild(makeFolderEl({ id: "fav", name: "★ Favorites" }, favs, "fav"))
    folders.slice().sort(byOrder).forEach(f => { const items = byFolder[f.id] || []; if (query && !items.length) return; list.appendChild(makeFolderEl(f, items)) })
    if (unassigned.length || (!query && folders.length)) list.appendChild(makeFolderEl({ id: "none", name: "Unsorted" }, unassigned, "ghost"))
    if (!list.children.length) { container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◻</div><p>No results for "${esc(query)}"</p></div>`; return }
    container.appendChild(list)
  }

  // mode: "" = real folder, "ghost" = Unsorted, "fav" = Favorites
  function makeFolderEl(folder, playlists, mode = "") {
    const el = document.createElement("div"); el.className = "folder-item"; el.dataset.folderId = folder.id
    const key = "fo-" + folder.id
    const stored = sessionStorage.getItem(key)
    if (stored === "1" || (stored === null && mode === "fav")) el.classList.add("open")
    const real = !mode

    el.innerHTML = `
      <div class="folder-header">
        ${real ? dragHandleSvg : `<span class="drag-handle-spacer"></span>`}
        <span class="folder-chevron">›</span>
        <span class="folder-name">${esc(folder.name)}</span>
        <span class="folder-count">${playlists.length}</span>
        ${real ? `<button class="btn-edit" data-folder-rename="${folder.id}" data-folder-name="${esc(folder.name)}" title="Rename folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon folder-del" data-folder-id="${folder.id}" title="Delete folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ""}
      </div>
      <div class="folder-body"></div>`

    el.querySelector(".folder-header").addEventListener("click", e => {
      if (e.target.closest(".folder-del, [data-folder-rename], .drag-handle")) return
      el.classList.toggle("open"); sessionStorage.setItem(key, el.classList.contains("open") ? "1" : "0")
    })

    const body = el.querySelector(".folder-body")
    if (!playlists.length) body.innerHTML = `<div class="empty-state" style="padding:20px"><span>Drop a playlist here</span></div>`
    else playlists.forEach(p => body.appendChild(makePlaylistRow(p, mode !== "fav")))
    return el
  }

  function makePlaylistRow(p, showHandle = true) {
    const row = document.createElement("div"); row.className = "playlist-row" + (p.pinned ? " is-pinned" : ""); row.dataset.playlistId = p.id
    row.innerHTML = `
      ${showHandle ? dragHandleSvg : '<span class="drag-handle-spacer"></span>'}
      <button class="btn-star" data-pin-pl="${p.id}" data-pinned="${p.pinned ? "1" : "0"}" title="${p.pinned ? "Remove from favorites" : "Add to favorites"}">
        <svg viewBox="0 0 24 24" fill="${p.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <span class="pl-dot"></span>
      <span class="pl-name" title="${esc(p.notes || p.name)}">${esc(p.name)}</span>
      ${p.game_tag ? `<span class="pl-tag">${esc(p.game_tag)}</span>` : ""}
      <div class="pl-actions">
        ${p.share_code ? `<a class="btn-launch" href="steam://run/824270/?action=jump-to-playlist;sharecode=${esc(p.share_code)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>open
        </a>` : ""}
        <button class="btn-copy" data-name="${esc(p.name)}">copy</button>
        <button class="btn-edit" data-playlist-id="${p.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" data-download-id="${p.id}" title="Download .json" ${p.file_data ? "" : "hidden"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-icon" data-delete-pl="${p.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`
    return row
  }

  function renderScenarios(scenarios, query = "") {
    const container = document.getElementById("scenarios-container")
    const filtered = scenarios.filter(s => !query || s.name.toLowerCase().includes(query) || (s.game_tag||"").toLowerCase().includes(query))
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || byOrder(a, b)); container.classList.toggle("no-drag", !!query)
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
      <div class="sc-card-top">
        ${dragHandleSvg}
        <button class="btn-star btn-star-card" data-pin-sc="${s.id}" data-pinned="${s.pinned ? "1" : "0"}" title="${s.pinned ? "Remove from favorites" : "Add to favorites"}">
          <svg viewBox="0 0 24 24" fill="${s.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </button>
      </div>
      <div class="sc-name">${esc(s.name)}</div>
      ${s.game_tag ? `<span class="sc-tag">${esc(s.game_tag)}</span>` : ""}
      ${s.share_code ? `<div class="sc-code">${esc(s.share_code)}</div>` : ""}
      <div class="sc-actions">
        ${s.share_code ? `<a class="btn-launch" href="steam://run/824270/?action=jump-to-scenario;sharecode=${esc(s.share_code)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>open
        </a>` : ""}
        <button class="btn-edit" data-scenario-id="${s.id}" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" data-delete-sc="${s.id}" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`
    return card
  }

  // ── drag & drop ──
  // Only the ⋮⋮ handle is draggable, so buttons/links inside rows stay clickable.
  // Folder headers reorder among themselves; rows reorder within a folder or drop onto any folder.
  function wireFolderDragDrop(container, { onReorderFolders, onDropItem }) {
    let dragType = null, dragId = null, openTimer = null, openFor = null
    const isReal = id => id && id !== "none" && id !== "fav"

    function clearMarks() {
      container.querySelectorAll(".drag-over-top,.drag-over-bottom,.drop-into").forEach(el => el.classList.remove("drag-over-top", "drag-over-bottom", "drop-into"))
    }
    function stopOpenTimer() { clearTimeout(openTimer); openTimer = null; openFor = null }
    function mark(el, e) {
      const rect = el.getBoundingClientRect()
      el.classList.remove("drag-over-top", "drag-over-bottom")
      el.classList.add((e.clientY - rect.top) < rect.height / 2 ? "drag-over-top" : "drag-over-bottom")
    }

    container.addEventListener("dragstart", e => {
      const handle = e.target.closest && e.target.closest(".drag-handle")
      if (!handle || container.classList.contains("no-drag")) { e.preventDefault(); return }
      const row = handle.closest(".playlist-row"), folderEl = handle.closest(".folder-item")
      if (row) {
        dragType = "item"; dragId = row.dataset.playlistId; row.classList.add("dragging")
        e.dataTransfer.setDragImage(row, 16, 16)
      } else if (folderEl) {
        dragType = "folder"; dragId = folderEl.dataset.folderId; folderEl.classList.add("dragging")
        e.dataTransfer.setDragImage(folderEl.querySelector(".folder-header"), 16, 16)
      } else { e.preventDefault(); return }
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", dragId) // Firefox won't start a drag without this
    })

    container.addEventListener("dragend", () => {
      container.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging"))
      clearMarks(); stopOpenTimer(); dragType = null; dragId = null
    })

    container.addEventListener("dragover", e => {
      if (!dragType) return
      clearMarks()
      const target = e.target.closest(".folder-item"); if (!target) return
      const tid = target.dataset.folderId
      if (dragType === "folder") {
        if (!isReal(tid) || tid === dragId) return
        e.preventDefault(); mark(target, e)
      } else {
        if (tid === "fav") return
        e.preventDefault()
        const row = e.target.closest(".playlist-row")
        if (row && row.dataset.playlistId !== dragId) mark(row, e); else target.classList.add("drop-into")
        if (openFor && openFor !== target) stopOpenTimer()
        if (!target.classList.contains("open") && !openFor) { openFor = target; openTimer = setTimeout(() => target.classList.add("open"), 450) }
      }
    })

    container.addEventListener("drop", e => {
      if (!dragType) return
      e.preventDefault()
      const target = e.target.closest(".folder-item"); const tid = target && target.dataset.folderId
      if (dragType === "folder") {
        if (target && isReal(tid) && tid !== dragId) {
          const before = target.classList.contains("drag-over-top")
          const ids = [...container.querySelectorAll(".folder-item")].map(el => el.dataset.folderId).filter(isReal)
          ids.splice(ids.indexOf(dragId), 1)
          let to = ids.indexOf(tid); if (!before) to++
          ids.splice(to, 0, dragId)
          clearMarks(); onReorderFolders(ids)
        }
      } else if (target && tid !== "fav") {
        const ids = [...target.querySelectorAll(".folder-body .playlist-row")].map(r => r.dataset.playlistId).filter(id => id !== dragId)
        const row = e.target.closest(".playlist-row")
        if (row && row.dataset.playlistId !== dragId) {
          let idx = ids.indexOf(row.dataset.playlistId); if (!row.classList.contains("drag-over-top")) idx++
          ids.splice(idx, 0, dragId)
        } else ids.push(dragId)
        clearMarks(); onDropItem(dragId, tid, ids)
      }
      clearMarks(); stopOpenTimer()
    })
  }

  // wires a flat grid of draggable cards for reordering only (no folders)
  function wireGridDragDrop(container, itemSelector, dataKey, onReorder) {
    let dragId = null
    function clearMarks() {
      container.querySelectorAll(".drag-over-left,.drag-over-right").forEach(el => el.classList.remove("drag-over-left", "drag-over-right"))
    }
    container.addEventListener("dragstart", e => {
      const handle = e.target.closest && e.target.closest(".drag-handle")
      const item = handle && handle.closest(itemSelector)
      if (!item || container.classList.contains("no-drag")) { e.preventDefault(); return }
      dragId = item.dataset[dataKey]
      item.classList.add("dragging")
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData("text/plain", dragId)
      e.dataTransfer.setDragImage(item, 20, 20)
    })
    container.addEventListener("dragend", () => {
      container.querySelectorAll(".dragging").forEach(el => el.classList.remove("dragging"))
      clearMarks(); dragId = null
    })
    container.addEventListener("dragover", e => {
      if (!dragId) return
      e.preventDefault()
      clearMarks()
      const item = e.target.closest(itemSelector)
      if (item && item.dataset[dataKey] !== dragId) {
        const rect = item.getBoundingClientRect()
        const before = (e.clientX - rect.left) < rect.width / 2
        item.classList.add(before ? "drag-over-left" : "drag-over-right")
      }
    })
    container.addEventListener("drop", e => {
      if (!dragId) return
      e.preventDefault()
      const items = [...container.querySelectorAll(itemSelector)]
      const ids = items.map(el => el.dataset[dataKey]).filter(id => id !== dragId)
      const target = e.target.closest(itemSelector)
      if (target && target.dataset[dataKey] !== dragId) {
        let idx = ids.indexOf(target.dataset[dataKey])
        if (!target.classList.contains("drag-over-left")) idx++
        ids.splice(idx, 0, dragId)
      } else ids.push(dragId)
      clearMarks()
      onReorder(ids)
    })
  }

  // modals
  function openFolderModal(onConfirm, existing = null) {
    const overlay = document.getElementById("modal-overlay")
    const input = document.getElementById("folder-name-input")
    const title = document.getElementById("modal-title")
    const confirmBtn = document.getElementById("modal-confirm")
    title.textContent = existing ? "Rename folder" : "New folder"
    confirmBtn.textContent = existing ? "Save" : "Create"
    overlay.classList.remove("hidden"); input.value = existing ? existing.name : ""; input.focus(); input.select()

    function done(confirmed) {
      overlay.classList.add("hidden")
      cleanup()
      if (confirmed) { const n = input.value.trim(); if (n) onConfirm(n) }
    }
    function cleanup() {
      confirmBtn.onclick = null
      document.getElementById("modal-cancel").onclick = null
      document.getElementById("modal-close").onclick = null
      overlay.onclick = null; input.onkeydown = null
    }
    confirmBtn.onclick = () => done(true)
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

  return {
    toast, setStatus, setFeedback, byOrder, populateFolderSelect, renderFolders, renderScenarios,
    wireFolderDragDrop, wireGridDragDrop,
    openFolderModal, openEditModal, openScenarioBulkModal, openEditScenarioModal, dragHandleSvg,
  }
})()
