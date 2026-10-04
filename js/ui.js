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

  // Builds the folder tree. Safe against broken data: a folder whose parent is missing,
  // itself, or part of a loop (A inside B inside A) is shown at the top level instead of
  // silently vanishing from the page.
  function buildTree(folders) {
    const byId = new Map(folders.map(f => [f.id, f])), parentOf = {}
    folders.forEach(f => { parentOf[f.id] = f.parent_id && f.parent_id !== f.id && byId.has(f.parent_id) ? f.parent_id : null })
    folders.forEach(f => {
      const seen = new Set([f.id]); let cur = parentOf[f.id]
      while (cur) {
        if (cur === f.id) { parentOf[f.id] = null; break }
        if (seen.has(cur)) break
        seen.add(cur); cur = parentOf[cur]
      }
    })
    const kidsOf = {}
    folders.forEach(f => { const k = parentOf[f.id] || "root"; (kidsOf[k] = kidsOf[k] || []).push(f) })
    Object.values(kidsOf).forEach(l => l.sort(byOrder))
    return { kidsOf, parentOf }
  }

  // a folder plus everything nested under it (what it can't be moved into)
  function descendantsOf(folders, id) {
    const { kidsOf } = buildTree(folders), out = new Set([id])
    ;(function walk(k) { (kidsOf[k] || []).forEach(c => { if (!out.has(c.id)) { out.add(c.id); walk(c.id) } }) })(id)
    return out
  }

  // folders flattened in tree order, with "Parent / Child" labels (flat lists just come out in order)
  function folderOptions(folders) {
    const { kidsOf } = buildTree(folders), out = []
    ;(function walk(key, path, depth) {
      (kidsOf[key] || []).forEach(f => { const label = path ? path + " / " + f.name : f.name; out.push({ id: f.id, label, name: f.name, depth }); walk(f.id, label, depth + 1) })
    })("root", "", 0)
    return out
  }

  function populateFolderSelect(folders, selId = "pl-folder", selectedId = "") {
    const sel = document.getElementById(selId); if (!sel) return
    sel.innerHTML = '<option value="">— no folder —</option>'
    folderOptions(folders).forEach(f => {
      const o = document.createElement("option"); o.value = f.id; o.textContent = f.label
      if (f.id === selectedId) o.selected = true; sel.appendChild(o)
    })
  }

  const dragHandleSvg = `<span class="drag-handle" draggable="true" title="Drag to reorder"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg></span>`

  const ICON_SUBFOLDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`
  const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
  const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`

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
    const { kidsOf } = buildTree(folders)
    const total = f => (byFolder[f.id] || []).length + (kidsOf[f.id] || []).reduce((n, k) => n + total(k), 0)
    const ctx = { kidsOf, byFolder, total, query }
    ;(kidsOf.root || []).forEach(f => { if (query && !total(f)) return; list.appendChild(makeFolderEl(f, byFolder[f.id] || [], "", ctx)) })
    if (unassigned.length || (!query && folders.length)) list.appendChild(makeFolderEl({ id: "none", name: "Unsorted" }, unassigned, "ghost"))
    if (!list.children.length) { container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◻</div><p>No results for "${esc(query)}"</p></div>`; return }
    container.appendChild(list)
  }

  // mode: "" = real folder, "ghost" = Unsorted, "fav" = Favorites
  function makeFolderEl(folder, playlists, mode = "", ctx = null) {
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
        <span class="folder-count">${ctx && real ? ctx.total(folder) : playlists.length}</span>
        ${real ? colorBtn("folder", folder.id, folder.color) : ""}
        ${real ? `<button class="btn-edit" data-folder-sub="${folder.id}" title="New subfolder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
        </button>
        <button class="btn-edit" data-folder-rename="${folder.id}" data-folder-name="${esc(folder.name)}" title="Rename folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon folder-del" data-folder-id="${folder.id}" title="Delete folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ""}
      </div>
      <div class="folder-body"></div>`
    applyColor(el, folder)

    el.querySelector(".folder-header").addEventListener("click", e => {
      if (e.target.closest(".folder-del, [data-folder-rename], [data-folder-sub], .drag-handle, .color-btn")) return
      el.classList.toggle("open"); sessionStorage.setItem(key, el.classList.contains("open") ? "1" : "0")
    })

    const body = el.querySelector(".folder-body")
    const subs = ctx && real ? (ctx.kidsOf[folder.id] || []).filter(sf => !ctx.query || ctx.total(sf)) : []
    if (subs.length) {
      const wrap = document.createElement("div"); wrap.className = "subfolders"
      subs.forEach(sf => wrap.appendChild(makeFolderEl(sf, ctx.byFolder[sf.id] || [], "", ctx)))
      body.appendChild(wrap)
    }
    if (!playlists.length && !subs.length) body.innerHTML = `<div class="empty-state" style="padding:20px"><span>Drop a playlist here</span></div>`
    else playlists.forEach(p => body.appendChild(makePlaylistRow(p, mode !== "fav")))
    return el
  }

  function makePlaylistRow(p, showHandle = true) {
    const row = document.createElement("div"); row.className = "playlist-row" + (p.pinned ? " is-pinned" : ""); row.dataset.playlistId = p.id; applyColor(row, p)
    row.innerHTML = `
      ${showHandle ? dragHandleSvg : '<span class="drag-handle-spacer"></span>'}
      <button class="btn-star" data-pin-pl="${p.id}" data-pinned="${p.pinned ? "1" : "0"}" title="${p.pinned ? "Remove from favorites" : "Add to favorites"}">
        <svg viewBox="0 0 24 24" fill="${p.pinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
      <span class="pl-dot"></span>
      <span class="pl-name" title="${esc(p.notes || p.name)}">${esc(p.name)}</span>
      ${p.game_tag ? `<span class="pl-tag">${esc(p.game_tag)}</span>` : ""}
      <div class="pl-actions">
        ${colorBtn("playlist", p.id, p.color)}
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

  // Scenario folders — mirrors renderFolders/makeFolderEl exactly, but bodies hold a
  // scenarios-grid of cards instead of playlist-rows. Kept separate from the playlist
  // functions above so nothing about playlists changes.
  function matchesScenario(s, q) {
    return !q || [s.name, s.game_tag, s.notes, s.share_code].some(v => (v || "").toLowerCase().includes(q))
  }

  function renderScenarioFolders(folders, scenarios, query = "") {
    const container = document.getElementById("scenarios-container")
    const byFolder = {}, unassigned = []
    const visible = scenarios.filter(s => matchesScenario(s, query))
    visible.forEach(s => { if (s.folder_id) (byFolder[s.folder_id] = byFolder[s.folder_id] || []).push(s); else unassigned.push(s) })
    Object.values(byFolder).forEach(l => l.sort(byOrder)); unassigned.sort(byOrder)
    document.getElementById("scenario-count").textContent = visible.length
    container.classList.toggle("no-drag", !!query)
    container.innerHTML = ""

    if (!scenarios.length && !folders.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◎</div><p>No scenarios yet</p><span>Add scenarios with their share codes to launch them directly</span></div>`
      return
    }
    const list = document.createElement("div"); list.className = "folders-list"
    const favs = visible.filter(s => s.pinned).sort(byOrder)
    if (favs.length) list.appendChild(makeScenarioFolderEl({ id: "fav", name: "★ Favorites" }, favs, "fav"))
    const { kidsOf } = buildTree(folders)
    const total = f => (byFolder[f.id] || []).length + (kidsOf[f.id] || []).reduce((n, k) => n + total(k), 0)
    const ctx = { kidsOf, byFolder, total, query }
    ;(kidsOf.root || []).forEach(f => { if (query && !total(f)) return; list.appendChild(makeScenarioFolderEl(f, byFolder[f.id] || [], "", ctx)) })
    if (unassigned.length || (!query && folders.length)) list.appendChild(makeScenarioFolderEl({ id: "none", name: "Unsorted" }, unassigned, "ghost"))
    if (!list.children.length) { container.innerHTML = `<div class="empty-state"><div class="empty-glyph">◻</div><p>No results for "${esc(query)}"</p></div>`; return }
    container.appendChild(list)
  }

  // mode: "" = real folder, "ghost" = Unsorted, "fav" = Favorites
  function makeScenarioFolderEl(folder, scenarios, mode = "", ctx = null) {
    const el = document.createElement("div"); el.className = "folder-item"; el.dataset.folderId = folder.id
    const key = "sfo-" + folder.id
    const stored = sessionStorage.getItem(key)
    if (stored === "1" || (stored === null && mode === "fav")) el.classList.add("open")
    const real = !mode

    el.innerHTML = `
      <div class="folder-header">
        ${real ? dragHandleSvg : `<span class="drag-handle-spacer"></span>`}
        <span class="folder-chevron">›</span>
        <span class="folder-name">${esc(folder.name)}</span>
        <span class="folder-count">${ctx && real ? ctx.total(folder) : scenarios.length}</span>
        ${real ? colorBtn("sfolder", folder.id, folder.color) : ""}
        ${real ? `<button class="btn-edit" data-scenario-folder-sub="${folder.id}" title="New subfolder">${ICON_SUBFOLDER}</button>
        <button class="btn-edit" data-scenario-folder-rename="${folder.id}" data-folder-name="${esc(folder.name)}" title="Rename / move folder">${ICON_EDIT}</button>
        <button class="btn-icon folder-del" data-scenario-folder-id="${folder.id}" title="Delete folder">${ICON_TRASH}</button>` : ""}
      </div>
      <div class="folder-body"></div>`
    applyColor(el, folder)

    el.querySelector(".folder-header").addEventListener("click", e => {
      if (e.target.closest(".folder-del, [data-scenario-folder-rename], [data-scenario-folder-sub], .drag-handle, .color-btn")) return
      el.classList.toggle("open"); sessionStorage.setItem(key, el.classList.contains("open") ? "1" : "0")
    })

    const body = el.querySelector(".folder-body")
    const subs = ctx && real ? (ctx.kidsOf[folder.id] || []).filter(sf => !ctx.query || ctx.total(sf)) : []
    if (subs.length) {
      const wrap = document.createElement("div"); wrap.className = "subfolders"
      subs.forEach(sf => wrap.appendChild(makeScenarioFolderEl(sf, ctx.byFolder[sf.id] || [], "", ctx)))
      body.appendChild(wrap)
    }
    if (!scenarios.length && !subs.length) body.innerHTML = `<div class="empty-state" style="padding:20px"><span>Drop a scenario here</span></div>`
    else if (scenarios.length) {
      const grid = document.createElement("div"); grid.className = "scenarios-grid"
      scenarios.forEach(s => grid.appendChild(makeScenarioCard(s, mode !== "fav")))
      body.appendChild(grid)
    }
    return el
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

  function makeScenarioCard(s, showHandle = true) {
    const card = document.createElement("div"); card.className = "scenario-card" + (s.pinned ? " is-pinned" : ""); card.dataset.scenarioId = s.id
    card.innerHTML = `
      <div class="sc-card-top">
        ${showHandle ? dragHandleSvg : '<span class="drag-handle-spacer"></span>'}
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
  // Dragging a FOLDER over another folder's header:
  //   top edge    → drop just above it (same level as that folder)
  //   bottom edge → drop just below it
  //   middle      → drop INSIDE it (becomes a subfolder)
  // Dropping a folder on "Unsorted" moves it back to the top level.
  // Rows reorder within a folder or drop onto any folder.
  function wireFolderDragDrop(container, { onMoveFolder, onDropItem, itemSelector = ".playlist-row", dataKey = "playlistId" }) {
    let dragType = null, dragId = null, openTimer = null, openFor = null
    const isReal = id => id && id !== "none" && id !== "fav"
    const findFolderEl = id => container.querySelector('.folder-item[data-folder-id="' + id + '"]')
    const realChildIds = host => [...host.children].filter(c => c.classList.contains("folder-item")).map(c => c.dataset.folderId).filter(isReal)

    function clearMarks() {
      container.querySelectorAll(".drag-over-top,.drag-over-bottom,.drop-into").forEach(el => el.classList.remove("drag-over-top", "drag-over-bottom", "drop-into"))
    }
    function stopOpenTimer() { clearTimeout(openTimer); openTimer = null; openFor = null }
    function mark(el, e) {
      const rect = el.getBoundingClientRect()
      el.classList.remove("drag-over-top", "drag-over-bottom")
      el.classList.add((e.clientY - rect.top) < rect.height / 2 ? "drag-over-top" : "drag-over-bottom")
    }
    function autoOpen(target) {
      if (openFor && openFor !== target) stopOpenTimer()
      if (!target.classList.contains("open") && !openFor) { openFor = target; openTimer = setTimeout(() => target.classList.add("open"), 450) }
    }
    // where is the pointer on a folder? "before" / "after" (its header edges) or "into"
    function zoneFor(target, e) {
      const header = target.querySelector(":scope > .folder-header"); if (!header) return "into"
      const h = header.getBoundingClientRect()
      if (e.clientY < h.top || e.clientY > h.bottom) return "into"
      const rel = (e.clientY - h.top) / h.height
      return rel < 0.28 ? "before" : rel > 0.72 ? "after" : "into"
    }

    container.addEventListener("dragstart", e => {
      const handle = e.target.closest && e.target.closest(".drag-handle")
      if (!handle || container.classList.contains("no-drag")) { e.preventDefault(); return }
      const row = handle.closest(itemSelector), folderEl = handle.closest(".folder-item")
      if (row) {
        dragType = "item"; dragId = row.dataset[dataKey]; row.classList.add("dragging")
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
        const dragEl = findFolderEl(dragId); if (!dragEl) return
        if (tid === "none") {
          if (dragEl.parentElement.classList.contains("folders-list")) return // already top level
          e.preventDefault(); target.classList.add("drop-into"); return
        }
        // can't drop onto Favorites, onto itself, or into its own subfolders
        if (!isReal(tid) || dragEl.contains(target)) return
        e.preventDefault()
        const z = zoneFor(target, e)
        if (z === "into") { target.classList.add("drop-into"); autoOpen(target) }
        else { stopOpenTimer(); target.classList.add(z === "before" ? "drag-over-top" : "drag-over-bottom") }
      } else {
        if (tid === "fav") return
        e.preventDefault()
        const row = e.target.closest(itemSelector)
        if (row && row.dataset[dataKey] !== dragId) mark(row, e); else target.classList.add("drop-into")
        autoOpen(target)
      }
    })

    container.addEventListener("drop", e => {
      if (!dragType) return
      e.preventDefault()
      const target = e.target.closest(".folder-item"); const tid = target && target.dataset.folderId
      if (dragType === "folder") {
        const dragEl = findFolderEl(dragId)
        let parentId = undefined, ids = null
        if (target && dragEl && tid === "none") {
          const root = container.querySelector(".folders-list")
          parentId = null; ids = realChildIds(root).filter(x => x !== dragId); ids.push(dragId)
        } else if (target && dragEl && isReal(tid) && !dragEl.contains(target)) {
          const z = zoneFor(target, e)
          if (z === "into") {
            const sub = target.querySelector(":scope > .folder-body > .subfolders")
            parentId = tid; ids = (sub ? realChildIds(sub) : []).filter(x => x !== dragId); ids.push(dragId)
          } else {
            const host = target.parentElement, pf = host.closest(".folder-item")
            parentId = pf ? pf.dataset.folderId : null
            ids = realChildIds(host).filter(x => x !== dragId)
            let to = ids.indexOf(tid); if (z === "after") to++
            ids.splice(to, 0, dragId)
          }
        }
        const moving = dragId
        clearMarks(); stopOpenTimer()
        if (ids) onMoveFolder(moving, parentId, ids)
      } else if (target && tid !== "fav") {
        const ids = [...target.querySelectorAll(itemSelector)].filter(r => r.closest(".folder-item") === target).map(r => r.dataset[dataKey]).filter(id => id !== dragId)
        const row = e.target.closest(itemSelector)
        if (row && row.dataset[dataKey] !== dragId) {
          let idx = ids.indexOf(row.dataset[dataKey]); if (!row.classList.contains("drag-over-top")) idx++
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
  function openFolderModal(onConfirm, existing = null, opts = {}) {
    const overlay = document.getElementById("modal-overlay")
    const input = document.getElementById("folder-name-input")
    const title = document.getElementById("modal-title")
    const confirmBtn = document.getElementById("modal-confirm")
    title.textContent = opts.title || (existing ? "Edit folder" : "New folder")
    confirmBtn.textContent = existing ? "Save" : "Create"
    const pf = document.getElementById("folder-parent-field"), ps = document.getElementById("folder-parent-select")
    if (opts.parents && pf && ps) {
      pf.style.display = ""
      ps.innerHTML = '<option value="">— top level —</option>' + opts.parents.map(o => `<option value="${esc(o.id)}">${"— ".repeat(o.depth)}${esc(o.name)}</option>`).join("")
      ps.value = opts.parentId || ""
    } else if (pf) pf.style.display = "none"
    overlay.classList.remove("hidden"); input.value = existing ? existing.name : ""; input.focus(); input.select()

    function done(confirmed) {
      overlay.classList.add("hidden")
      cleanup()
      if (confirmed) { const n = input.value.trim(); if (n) onConfirm(n, opts.parents && ps ? (ps.value || null) : undefined) }
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

  function openScenarioBulkModal(folders, onConfirm) {
    const overlay = document.getElementById("scenario-modal-overlay")
    overlay.classList.remove("hidden")
    document.getElementById("scenario-bulk-input").value = ""
    populateFolderSelect(folders, "scenario-bulk-folder", "")
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
      const folderId = document.getElementById("scenario-bulk-folder").value
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean)
      const parsed = lines.map(line => {
        const parts = line.split("|").map(p => p.trim())
        return { name: parts[0]||"", shareCode: parts[1]||"", gameTag: parts[2]||"", folderId }
      }).filter(s => s.name)
      cleanup(); onConfirm(parsed)
    }
    document.getElementById("scenario-modal-cancel").onclick = cleanup
    document.getElementById("scenario-modal-close").onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  function openEditScenarioModal(scenario, folders, onSave) {
    const overlay = document.getElementById("edit-scenario-modal-overlay")
    overlay.classList.remove("hidden")
    document.getElementById("edit-sc-name").value = scenario.name || ""
    document.getElementById("edit-sc-share").value = scenario.share_code || ""
    document.getElementById("edit-sc-game").value = scenario.game_tag || ""
    document.getElementById("edit-sc-notes").value = scenario.notes || ""
    populateFolderSelect(folders, "edit-sc-folder", scenario.folder_id || "")

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
      onSave({ name, shareCode: document.getElementById("edit-sc-share").value.trim(), gameTag: document.getElementById("edit-sc-game").value.trim(), notes: document.getElementById("edit-sc-notes").value.trim(), folderId: document.getElementById("edit-sc-folder").value })
    }
    document.getElementById("edit-scenario-modal-cancel").onclick = cleanup
    document.getElementById("edit-scenario-modal-close").onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  // ── colors (folders + playlists) ──
  const COLORS = ["#5ad1ff","#4f8cff","#8b7bff","#d36bff","#ff6b9a","#ff6b5a","#ffa24d","#ffd24d","#4fdc8a","#2ee6c1"]
  const safeColor = c => /^#[0-9a-f]{6}$/i.test(c || "") ? c : ""
  function colorBtn(kind, id, color) {
    const c = safeColor(color)
    return `<button type="button" class="color-btn${c ? " has" : ""}" data-color-kind="${kind}" data-color-id="${id}" data-color="${c}" title="Change color" style="--c:${c || "transparent"}"></button>`
  }
  function applyColor(el, item) {
    const c = safeColor(item.color)
    if (c) { el.classList.add("has-color"); el.style.setProperty("--fc", c) }
  }
  let popEl = null
  function closeColorPop() { if (popEl) { popEl.remove(); popEl = null } }
  function openColorPicker(btn, current, onPick) {
    closeColorPop()
    const pop = document.createElement("div"); pop.className = "color-pop"
    pop.innerHTML = COLORS.map(c => `<button type="button" class="sw${c === current ? " active" : ""}" data-sw="${c}" style="--c:${c}"></button>`).join("") +
      `<button type="button" class="sw-clear" data-sw="">no color</button><label class="sw-custom">custom<input type="color" value="${current || "#5ad1ff"}"></label>`
    document.body.appendChild(pop); popEl = pop
    const r = btn.getBoundingClientRect()
    pop.style.top = Math.min(r.bottom + 6, window.innerHeight - pop.offsetHeight - 8) + "px"
    pop.style.left = Math.max(8, Math.min(r.left - 10, window.innerWidth - pop.offsetWidth - 8)) + "px"
    pop.addEventListener("click", e => { const b = e.target.closest("[data-sw]"); if (!b) return; onPick(b.dataset.sw); closeColorPop() })
    pop.querySelector("input[type=color]").addEventListener("change", e => { onPick(e.target.value); closeColorPop() })
  }
  document.addEventListener("click", e => {
    const btn = e.target.closest(".color-btn")
    if (btn) {
      e.stopPropagation()
      openColorPicker(btn, btn.dataset.color, color => document.dispatchEvent(new CustomEvent("color-pick", { detail: { kind: btn.dataset.colorKind, id: btn.dataset.colorId, color } })))
      return
    }
    if (popEl && !e.target.closest(".color-pop")) closeColorPop()
  })
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeColorPop() })
  window.addEventListener("scroll", closeColorPop, true)

  function esc(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
  }

  return {
    toast, setStatus, setFeedback, byOrder, esc, safeColor, colorBtn, applyColor, buildTree, descendantsOf, ICON_SUBFOLDER, ICON_EDIT, ICON_TRASH, folderOptions, populateFolderSelect, renderFolders, renderScenarios, renderScenarioFolders,
    wireFolderDragDrop, wireGridDragDrop,
    openFolderModal, openEditModal, openScenarioBulkModal, openEditScenarioModal, dragHandleSvg,
  }
})()
