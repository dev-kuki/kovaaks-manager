;(async () => {
  // Falls back to a no-op if js/theme.js didn't load for any reason (e.g. a deploy
  // that's missing the new file) — appearance settings just won't do anything in that
  // case, instead of taking playlists/scenarios down with it.
  const ThemeSafe = (typeof Theme !== "undefined") ? Theme : {
    PRESETS: [], load: () => ({ preset: "cyan", transparency: 50 }),
    set: () => ({ preset: "cyan", transparency: 50 }), reset: () => ({ preset: "cyan", transparency: 50 }),
  }

  let folders = [], playlists = [], scenarios = [], scenarioFolders = []
  let plQuery = "", scQuery = ""


  // view switching
  // ── popups: Routine / Sensitivity / Export-Import open over the page instead of being nav tabs ──
  const panelBackdrop = document.createElement("div"); panelBackdrop.id = "panel-backdrop"; document.body.appendChild(panelBackdrop)
  function closePanel() {
    document.querySelectorAll(".view.panel.open").forEach(p => p.classList.remove("open", "active"))
    panelBackdrop.classList.remove("show")
  }
  function openPanel(name) {
    closePanel(); const p = document.getElementById("view-" + name); if (!p) return
    p.classList.add("open", "active"); panelBackdrop.classList.add("show"); p.scrollTop = 0
    if (name === "sens") initSens()
  }
  document.querySelectorAll(".view.panel").forEach(p => {
    document.body.appendChild(p) // top level, so the backdrop (also on body) can never sit on top of it
    const bar = p.querySelector(".topbar"), x = document.createElement("button")
    x.type = "button"; x.className = "panel-close"; x.setAttribute("aria-label", "Close"); x.dataset.closePanel = ""; x.textContent = "✕"
    if (bar) bar.appendChild(x); else p.prepend(x)
  })
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-open-panel]"); if (o) return openPanel(o.dataset.openPanel)
    if (e.target.closest("[data-close-panel]") || e.target === panelBackdrop) closePanel()
  })
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !document.querySelector(".modal-backdrop:not(.hidden)")) closePanel() })
  window.openPanel = openPanel; window.closePanel = closePanel

  function showView(name) {
    closePanel()
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name))
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name))
    document.getElementById("main").scrollTop = 0
    if (name === "resources") Resources.init()
  }
  document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)))

  // "Add playlist" now opens as a modal from the Playlists tab instead of its own nav tab —
  // same form, same fields, same upload logic below, just no dedicated view to navigate to.
  const uploadOverlay = document.getElementById("upload-modal-overlay")
  function openUploadModal() {
    UI.populateFolderSelect(folders, "pl-folder")
    uploadOverlay.classList.remove("hidden")
    document.getElementById("pl-name").focus()
  }
  function closeUploadModal() { uploadOverlay.classList.add("hidden") }
  document.getElementById("btn-add-playlist").addEventListener("click", openUploadModal)
  document.getElementById("upload-modal-close").addEventListener("click", closeUploadModal)
  document.getElementById("upload-modal-cancel").addEventListener("click", closeUploadModal)
  uploadOverlay.addEventListener("click", e => { if (e.target === uploadOverlay) closeUploadModal() })

  // connect
  document.getElementById("btn-save-settings").addEventListener("click", async () => {
    const url = document.getElementById("sb-url").value.trim()
    const key = document.getElementById("sb-key").value.trim()
    if (!url || !key) { UI.setFeedback("settings-feedback", "fill in both fields", true); return }
    await connect(url, key, false)
  })

  async function connect(url, key, silent = false) {
    UI.setStatus("connecting"); UI.setFeedback("settings-feedback", "")
    try {
      DB.init(url, key)
      if (!await DB.ping()) throw new Error("couldn't reach the database — check your URL and key")
      localStorage.setItem("sb-url", url); localStorage.setItem("sb-key", key)
      UI.setStatus("connected")
      if (!silent) UI.setFeedback("settings-feedback", "connected ✓")
      await refresh(); initSens(); Resources.init(true)
      if (!silent) showView("playlists")
    } catch (err) { UI.setStatus("disconnected"); UI.setFeedback("settings-feedback", err.message, true); if (silent) showView("settings") }
  }

  async function refresh() {
    if (!DB.ready()) return
    try {
      ;[folders, playlists, scenarios, scenarioFolders] = await Promise.all([DB.getFolders(), DB.getAllPlaylists(), DB.getAllScenarios(), DB.getScenarioFolders().catch(() => [])])
      UI.populateFolderSelect(folders, "pl-folder")
      render()
      Routine.populateQuickAdd(playlists, scenarios)
    } catch (err) { UI.toast("refresh failed: " + err.message) }
  }

  function render() {
    UI.renderFolders(folders, playlists, plQuery)
    UI.renderScenarioFolders(scenarioFolders, scenarios, scQuery)
    updateAside()
  }

  // Fills the empty space next to the playlists list with a few at-a-glance stats.
  // Purely additive — doesn't read from or touch the folders-container markup.
  function updateAside() {
    const favCount = playlists.filter(p => p.pinned).length
    document.getElementById("stat-playlists").textContent = playlists.length
    document.getElementById("stat-folders").textContent = folders.length
    document.getElementById("stat-fav-playlists").textContent = favCount
    document.getElementById("stat-scenarios").textContent = scenarios.length

    const counts = {}
    ;[...playlists, ...scenarios].forEach(x => { if (x.game_tag) counts[x.game_tag] = (counts[x.game_tag] || 0) + 1 })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const listEl = document.getElementById("aside-games-list")
    const cardEl = document.getElementById("aside-games-card")
    if (!top.length) { cardEl.style.display = "none"; return }
    cardEl.style.display = ""
    listEl.innerHTML = top.map(([tag, n]) => `<div class="aside-stat"><span>${UI.esc(tag)}</span><strong>${n}</strong></div>`).join("")
  }

  // ── playlists ──

  document.getElementById("search-input").addEventListener("input", e => {
    plQuery = e.target.value.toLowerCase().trim()
    UI.renderFolders(folders, playlists, plQuery)
  })

  document.getElementById("btn-new-folder").addEventListener("click", () => {
    UI.openFolderModal(async (name, parentId) => {
      if (!DB.ready()) { UI.toast("not connected"); return }
      try { await DB.createFolder(name, null, parentId); if (parentId) sessionStorage.setItem("fo-" + parentId, "1"); await refresh(); UI.toast(`"${name}" created`) }
      catch (err) { UI.toast("error: " + err.message + (parentId ? " (subfolders need the parent_id SQL in Settings)" : ""), 4500) }
    }, null, { parents: UI.folderOptions(folders), parentId: "" })
  })

  // drag & drop — optimistic: the UI updates instantly, saving happens in the background (reverts on error)
  UI.wireFolderDragDrop(document.getElementById("folders-container"), {
    onMoveFolder: async (id, parentId, ids) => {
      const f = folders.find(x => x.id === id); if (!f) return
      const changed = (f.parent_id || null) !== (parentId || null)
      f.parent_id = parentId || null
      ids.forEach((fid, i) => { const x = folders.find(y => y.id === fid); if (x) x.position = i })
      if (parentId) sessionStorage.setItem("fo-" + parentId, "1")
      render()
      try { if (changed) await DB.setFolderParent(id, parentId); await DB.reorderFolders(ids) }
      catch (err) { UI.toast("couldn't save — run the SQL migration in Settings (parent_id / position). " + err.message, 4500); await refresh() }
    },
    onDropItem: async (id, targetFolderId, ids) => {
      const folderId = targetFolderId === "none" ? null : targetFolderId
      const pl = playlists.find(p => p.id === id); if (!pl) return
      const moved = pl.folder_id !== folderId
      pl.folder_id = folderId
      ids.forEach((pid, i) => { const p = playlists.find(x => x.id === pid); if (p) p.position = i })
      sessionStorage.setItem("fo-" + (folderId || "none"), "1")
      render()
      try { if (moved) await DB.movePlaylistToFolder(id, folderId); await DB.reorderPlaylists(ids) }
      catch (err) { UI.toast("couldn't save — run the SQL migration in Settings. " + err.message); await refresh() }
    },
  })

  document.getElementById("folders-container").addEventListener("click", async e => {
    const pinBtn = e.target.closest("[data-pin-pl]")
    if (pinBtn) {
      const pl = playlists.find(p => p.id === pinBtn.dataset.pinPl); if (!pl) return
      pl.pinned = !pl.pinned; render()
      try { await DB.togglePlaylistPin(pl.id, pl.pinned) }
      catch (err) { pl.pinned = !pl.pinned; render(); UI.toast("couldn't favorite — run the SQL migration in Settings (pinned column). " + err.message) }
      return
    }
    const subBtn = e.target.closest("[data-folder-sub]")
    if (subBtn) {
      const pid = subBtn.dataset.folderSub, pf = folders.find(x => x.id === pid)
      UI.openFolderModal(async name => {
        try { await DB.createFolder(name, null, pid); sessionStorage.setItem("fo-" + pid, "1"); await refresh(); UI.toast(`"${name}" created inside "${pf ? pf.name : "folder"}"`) }
        catch (err) { UI.toast("couldn't create subfolder — run the parent_id SQL in Settings. " + err.message, 4500) }
      }, null, { title: "New subfolder" })
      return
    }
    const renameBtn = e.target.closest("[data-folder-rename]")
    if (renameBtn) {
      const id = renameBtn.dataset.folderRename
      const f0 = folders.find(x => x.id === id)
      const bad = UI.descendantsOf(folders, id) // a folder can't be moved into itself or its own subfolders
      UI.openFolderModal(async (name, parentId) => {
        try {
          await DB.renameFolder(id, name)
          if (parentId !== undefined && (parentId || null) !== ((f0 && f0.parent_id) || null)) await DB.setFolderParent(id, parentId)
          await refresh(); UI.toast(`"${name}" saved`)
        } catch (err) { UI.toast("error: " + err.message + " (moving folders needs the parent_id SQL in Settings)", 4500) }
      }, { name: renameBtn.dataset.folderName }, { parents: UI.folderOptions(folders).filter(o => !bad.has(o.id)), parentId: (f0 && f0.parent_id) || "" })
      return
    }
    if (e.target.closest(".folder-del")) {
      const id = e.target.closest("[data-folder-id]").dataset.folderId
      const f = folders.find(x => x.id === id)
      if (!f || !confirm(`Delete folder "${f.name}"?\nPlaylists will become unsorted and any subfolders move to the top level.`)) return
      try { await DB.deleteFolder(id); await refresh(); UI.toast(`"${f.name}" deleted`) }
      catch (err) { UI.toast("error: " + err.message) }
      return
    }
    const copyBtn = e.target.closest(".btn-copy")
    if (copyBtn) {
      try { await navigator.clipboard.writeText(copyBtn.dataset.name); UI.toast("copied: " + copyBtn.dataset.name) }
      catch { UI.toast("clipboard unavailable") }
      return
    }
    const editBtn = e.target.closest(".btn-edit[data-playlist-id]")
    if (editBtn) {
      const pl = playlists.find(p => p.id === editBtn.dataset.playlistId)
      if (!pl) return
      UI.openEditModal(pl, folders, async updates => {
        try { Object.assign(pl, await DB.updatePlaylist(pl.id, updates)); render(); UI.toast(`"${updates.name}" updated`) }
        catch (err) { UI.toast("error: " + err.message) }
      })
      return
    }
    const dlBtn = e.target.closest("[data-download-id]")
    if (dlBtn) {
      try {
        const { file_data, name } = await DB.getPlaylistFile(dlBtn.dataset.downloadId)
        const blob = new Blob([JSON.stringify(file_data, null, 2)], { type: "application/json" })
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name.replace(/[^a-z0-9_\-. ]/gi,"_") + ".json" })
        a.click(); URL.revokeObjectURL(a.href); UI.toast("downloading…")
      } catch (err) { UI.toast("error: " + err.message) }
      return
    }
    const delBtn = e.target.closest("[data-delete-pl]")
    if (delBtn) {
      const pl = playlists.find(p => p.id === delBtn.dataset.deletePl)
      if (!pl || !confirm(`Delete "${pl.name}"?`)) return
      try { await DB.deletePlaylist(pl.id); await refresh(); UI.toast(`"${pl.name}" deleted`) }
      catch (err) { UI.toast("error: " + err.message) }
    }
  })

  // upload
  const fileInput = document.getElementById("pl-file")
  const fileLabel = document.getElementById("file-label")
  const fileDrop  = document.getElementById("file-drop")

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0]
    fileLabel.textContent = f ? f.name : "Drop .json or click to browse"
    const nameEl = document.getElementById("pl-name")
    if (f && !nameEl.value.trim()) nameEl.value = f.name.replace(/\.json$/i, "")
  })
  fileDrop.addEventListener("dragover", e => { e.preventDefault(); fileDrop.classList.add("over") })
  fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("over"))
  fileDrop.addEventListener("drop", e => {
    e.preventDefault(); fileDrop.classList.remove("over")
    const f = e.dataTransfer.files[0]; if (!f) return
    const dt = new DataTransfer(); dt.items.add(f); fileInput.files = dt.files
    fileLabel.textContent = f.name
  })

  document.getElementById("btn-upload").addEventListener("click", async () => {
    if (!DB.ready()) { UI.setFeedback("upload-feedback", "not connected", true); return }
    const name = document.getElementById("pl-name").value.trim()
    const file = fileInput.files[0]
    if (!name) { UI.setFeedback("upload-feedback", "name is required", true); return }
    UI.setFeedback("upload-feedback", "uploading…")
    document.getElementById("btn-upload").disabled = true
    try {
      let parsed = null; if (file) { try { parsed = JSON.parse(await file.text()) } catch { throw new Error("that file isn't valid JSON — remove it or pick another") } }
      await DB.uploadPlaylist({ name, folderId: document.getElementById("pl-folder").value, gameTag: document.getElementById("pl-game").value.trim(), notes: document.getElementById("pl-notes").value.trim(), shareCode: document.getElementById("pl-share").value.trim(), fileData: parsed })
      UI.setFeedback("upload-feedback", `"${name}" uploaded ✓`)
      ;["pl-name","pl-game","pl-notes","pl-share"].forEach(id => document.getElementById(id).value = "")
      document.getElementById("pl-folder").value = ""; fileInput.value = ""; fileLabel.textContent = "Drop .json or click to browse"
      await refresh(); closeUploadModal(); UI.toast(`"${name}" added`)
    } catch (err) { UI.setFeedback("upload-feedback", err.message, true) }
    finally { document.getElementById("btn-upload").disabled = false }
  })

  // ── scenarios ──
  // Mirrors the playlists folder setup above (new folder button, drag & drop between
  // folders, rename/delete) so scenarios work the same way playlists do.

  document.getElementById("scenario-search").addEventListener("input", e => {
    scQuery = e.target.value.toLowerCase().trim()
    UI.renderScenarioFolders(scenarioFolders, scenarios, scQuery)
  })

  document.getElementById("btn-new-scenario-folder").addEventListener("click", () => {
    UI.openFolderModal(async (name, parentId) => {
      if (!DB.ready()) { UI.toast("not connected"); return }
      try { await DB.createScenarioFolder(name, null, parentId); if (parentId) sessionStorage.setItem("sfo-" + parentId, "1"); await refresh(); UI.toast(`"${name}" created`) }
      catch (err) { UI.toast("couldn't create folder — run the scenario folders SQL in Settings. " + err.message, 4500) }
    }, null, { parents: UI.folderOptions(scenarioFolders), parentId: "" })
  })

  document.getElementById("btn-add-scenario").addEventListener("click", () => {
    UI.openScenarioBulkModal(scenarioFolders, async items => {
      if (!DB.ready()) { UI.toast("not connected"); return }
      try {
        await Promise.all(items.map(s => DB.insertScenario(s)))
        await refresh(); UI.toast(`added ${items.length} scenario${items.length !== 1 ? "s" : ""}`)
      } catch (err) { UI.toast("couldn't add — if this is a fresh feature, run the SQL migration in Settings. " + err.message) }
    })
  })

  UI.wireFolderDragDrop(document.getElementById("scenarios-container"), {
    itemSelector: ".scenario-card", dataKey: "scenarioId",
    onMoveFolder: async (id, parentId, ids) => {
      const f = scenarioFolders.find(x => x.id === id); if (!f) return
      const changed = (f.parent_id || null) !== (parentId || null)
      f.parent_id = parentId || null
      ids.forEach((fid, i) => { const x = scenarioFolders.find(y => y.id === fid); if (x) x.position = i })
      if (parentId) sessionStorage.setItem("sfo-" + parentId, "1")
      render()
      try { if (changed) await DB.setScenarioFolderParent(id, parentId); await DB.reorderScenarioFolders(ids) }
      catch (err) { UI.toast("couldn't save — run the scenario folders SQL in Settings (parent_id). " + err.message, 4500); await refresh() }
    },
    onDropItem: async (id, targetFolderId, ids) => {
      const folderId = targetFolderId === "none" ? null : targetFolderId
      const sc = scenarios.find(s => s.id === id); if (!sc) return
      const moved = sc.folder_id !== folderId
      sc.folder_id = folderId
      ids.forEach((sid, i) => { const s = scenarios.find(x => x.id === sid); if (s) s.position = i })
      sessionStorage.setItem("sfo-" + (folderId || "none"), "1")
      render()
      try { if (moved) await DB.moveScenarioToFolder(id, folderId); await DB.reorderScenarios(ids) }
      catch (err) { UI.toast("couldn't save — run the SQL migration in Settings. " + err.message); await refresh() }
    },
  })

  document.getElementById("scenarios-container").addEventListener("click", async e => {
    const pinBtn = e.target.closest("[data-pin-sc]")
    if (pinBtn) {
      const sc = scenarios.find(s => s.id === pinBtn.dataset.pinSc); if (!sc) return
      sc.pinned = !sc.pinned; render()
      try { await DB.toggleScenarioPin(sc.id, sc.pinned) }
      catch (err) { sc.pinned = !sc.pinned; render(); UI.toast("couldn't favorite — run the SQL migration in Settings (pinned column). " + err.message) }
      return
    }
    const subBtn = e.target.closest("[data-scenario-folder-sub]")
    if (subBtn) {
      const pid = subBtn.dataset.scenarioFolderSub, pf = scenarioFolders.find(x => x.id === pid)
      UI.openFolderModal(async name => {
        try { await DB.createScenarioFolder(name, null, pid); sessionStorage.setItem("sfo-" + pid, "1"); await refresh(); UI.toast(`"${name}" created inside "${pf ? pf.name : "folder"}"`) }
        catch (err) { UI.toast("couldn't create subfolder — run the scenario folders SQL in Settings. " + err.message, 4500) }
      }, null, { title: "New subfolder" })
      return
    }
    const renameBtn = e.target.closest("[data-scenario-folder-rename]")
    if (renameBtn) {
      const id = renameBtn.dataset.scenarioFolderRename
      const f0 = scenarioFolders.find(x => x.id === id)
      const bad = UI.descendantsOf(scenarioFolders, id)
      UI.openFolderModal(async (name, parentId) => {
        try {
          await DB.renameScenarioFolder(id, name)
          if (parentId !== undefined && (parentId || null) !== ((f0 && f0.parent_id) || null)) await DB.setScenarioFolderParent(id, parentId)
          await refresh(); UI.toast(`"${name}" saved`)
        } catch (err) { UI.toast("error: " + err.message + " (moving folders needs the scenario folders SQL in Settings)", 4500) }
      }, { name: renameBtn.dataset.folderName }, { parents: UI.folderOptions(scenarioFolders).filter(o => !bad.has(o.id)), parentId: (f0 && f0.parent_id) || "" })
      return
    }
    if (e.target.closest(".folder-del")) {
      const id = e.target.closest("[data-scenario-folder-id]").dataset.scenarioFolderId
      const f = scenarioFolders.find(x => x.id === id)
      if (!f || !confirm(`Delete folder "${f.name}"?\nScenarios will become unsorted and any subfolders move to the top level.`)) return
      try { await DB.deleteScenarioFolder(id); await refresh(); UI.toast(`"${f.name}" deleted`) }
      catch (err) { UI.toast("error: " + err.message) }
      return
    }
    const editBtn = e.target.closest(".btn-edit[data-scenario-id]")
    if (editBtn) {
      const sc = scenarios.find(s => s.id === editBtn.dataset.scenarioId)
      if (!sc) return
      UI.openEditScenarioModal(sc, scenarioFolders, async updates => {
        try { Object.assign(sc, await DB.updateScenario(sc.id, updates)); render(); UI.toast(`"${updates.name}" updated`) }
        catch (err) { UI.toast("error: " + err.message) }
      })
      return
    }
    const delBtn = e.target.closest("[data-delete-sc]")
    if (delBtn) {
      const sc = scenarios.find(s => s.id === delBtn.dataset.deleteSc)
      if (!sc || !confirm(`Delete "${sc.name}"?`)) return
      try { await DB.deleteScenario(sc.id); await refresh(); UI.toast(`"${sc.name}" deleted`) }
      catch (err) { UI.toast("error: " + err.message) }
    }
  })

  // ── colors: folders + playlists ──
  document.addEventListener("color-pick", async e => {
    const { kind, id, color } = e.detail
    const map = {
      folder:   [() => folders,         DB.setFolderColor,         render],
      playlist: [() => playlists,       DB.setPlaylistColor,       render],
      sfolder:  [() => scenarioFolders, DB.setScenarioFolderColor, render],
    }
    const entry = map[kind]; if (!entry) return
    const item = entry[0]().find(x => x.id === id); if (!item) return
    const prev = item.color || null
    item.color = color || null; render()
    try { await entry[1](id, color) }
    catch (err) { item.color = prev; render(); UI.toast("couldn't save color — run the color SQL in Settings. " + err.message, 4500) }
  })

  // ── export / import ──

  const importFileInput = document.getElementById("import-file")
  const importDrop = document.getElementById("import-drop")
  const importLabel = document.getElementById("import-file-label")
  const importBtn = document.getElementById("btn-import")

  importFileInput.addEventListener("change", () => {
    const f = importFileInput.files[0]
    importLabel.textContent = f ? f.name : "Drop .zip or click to browse"
    importBtn.disabled = !f
  })
  importDrop.addEventListener("dragover", e => { e.preventDefault(); importDrop.classList.add("over") })
  importDrop.addEventListener("dragleave", () => importDrop.classList.remove("over"))
  importDrop.addEventListener("drop", e => {
    e.preventDefault(); importDrop.classList.remove("over")
    const f = e.dataTransfer.files[0]; if (!f) return
    const dt = new DataTransfer(); dt.items.add(f); importFileInput.files = dt.files
    importLabel.textContent = f.name; importBtn.disabled = false
  })

  document.getElementById("btn-export").addEventListener("click", async () => {
    if (!DB.ready()) { UI.setFeedback("export-feedback", "not connected", true); return }
    UI.setFeedback("export-feedback", "building zip…")
    try {
      const [allFolders, allPlaylists, allScFolders, allScenarios] = await Promise.all([
        DB.getFolders(), DB.getAllPlaylistsWithFiles(),
        DB.getScenarioFolders().catch(() => []), DB.getAllScenarios().catch(() => []),
      ])
      const zip = new JSZip()
      const manifest = { folders: allFolders, playlists: [], scenarioFolders: allScFolders, scenarios: allScenarios }

      allPlaylists.forEach(p => {
        const filename = `playlists/${p.id}.json`
        zip.file(filename, JSON.stringify(p.file_data, null, 2))
        manifest.playlists.push({ id: p.id, name: p.name, folder_id: p.folder_id, game_tag: p.game_tag, notes: p.notes, share_code: p.share_code, color: p.color || null, file: filename })
      })

      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
      const blob = await zip.generateAsync({ type: "blob" })
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `kovaaks-library-${new Date().toISOString().slice(0,10)}.zip` })
      a.click(); URL.revokeObjectURL(a.href)
      UI.setFeedback("export-feedback", `exported ${allPlaylists.length} playlists, ${allScenarios.length} scenarios ✓`)
    } catch (err) { UI.setFeedback("export-feedback", err.message, true) }
  })

  importBtn.addEventListener("click", async () => {
    if (!DB.ready()) { UI.setFeedback("import-feedback", "not connected", true); return }
    const file = importFileInput.files[0]; if (!file) return
    if (!confirm("This will import all folders, playlists and scenarios from the zip. Existing data won't be deleted. Continue?")) return
    UI.setFeedback("import-feedback", "importing…"); importBtn.disabled = true
    try {
      const zip = await JSZip.loadAsync(file)
      const manifestFile = zip.file("manifest.json")
      if (!manifestFile) throw new Error("no manifest.json found — is this a valid export?")
      const manifest = JSON.parse(await manifestFile.async("string"))

      // folders first (so ids can be mapped), then nesting, in the order they were exported
      async function importTree(list, create, setParent) {
        const map = {}
        for (const f of (list || []).slice().sort(UI.byOrder)) map[f.id] = (await create(f)).id
        for (const f of list || []) if (f.parent_id && map[f.parent_id]) await setParent(map[f.id], map[f.parent_id])
        return map
      }
      const folderMap = await importTree(manifest.folders, f => DB.createFolder(f.name, f.color), DB.setFolderParent)
      const scMap = await importTree(manifest.scenarioFolders, f => DB.createScenarioFolder(f.name, f.color), DB.setScenarioFolderParent)

      let count = 0
      for (const p of manifest.playlists) {
        const jsonFile = zip.file(p.file)
        const fileData = jsonFile ? JSON.parse(await jsonFile.async("string")) : null
        await DB.uploadPlaylist({ name: p.name, folderId: folderMap[p.folder_id]||null, gameTag: p.game_tag, notes: p.notes, shareCode: p.share_code, fileData, color: p.color })
        count++
      }
      for (const sc of manifest.scenarios || []) {
        await DB.insertScenario({ name: sc.name, shareCode: sc.share_code, gameTag: sc.game_tag, notes: sc.notes, folderId: scMap[sc.folder_id] || null }); count++
      }

      await refresh()
      UI.setFeedback("import-feedback", `imported ${count} items ✓`)
    } catch (err) { UI.setFeedback("import-feedback", err.message, true) }
    finally { importBtn.disabled = false }
  })

  // Esc closes whatever modal is open
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return
    const open = document.querySelector(".modal-backdrop:not(.hidden)")
    const x = open && open.querySelector(".modal-x"); if (x) x.click()
  })

  // ── init (runs last so every handler above is wired before we touch the network) ──
  const savedUrl = localStorage.getItem("sb-url") || ""
  const savedKey = localStorage.getItem("sb-key") || ""
  if (savedUrl && savedKey) {
    document.getElementById("sb-url").value = savedUrl
    document.getElementById("sb-key").value = savedKey
    await connect(savedUrl, savedKey, true)
  } else showView("settings")

})()
