;(async () => {
  let folders = [], playlists = [], scenarios = []
  let plQuery = "", scQuery = ""

  // init from saved creds
  const savedUrl = localStorage.getItem("sb-url") || ""
  const savedKey = localStorage.getItem("sb-key") || ""
  if (savedUrl && savedKey) {
    document.getElementById("sb-url").value = savedUrl
    document.getElementById("sb-key").value = savedKey
    await connect(savedUrl, savedKey, true)
  }

  // view switching
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"))
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"))
      btn.classList.add("active")
      document.getElementById("view-" + btn.dataset.view).classList.add("active")
    })
  })

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
      await refresh()
    } catch (err) { UI.setStatus("disconnected"); UI.setFeedback("settings-feedback", err.message, true) }
  }

  async function refresh() {
    if (!DB.ready()) return
    try {
      ;[folders, playlists, scenarios] = await Promise.all([DB.getFolders(), DB.getAllPlaylists(), DB.getAllScenarios()])
      UI.populateFolderSelect(folders, "pl-folder")
      UI.renderFolders(folders, playlists, plQuery)
      UI.renderScenarios(scenarios, scQuery)
      Routine.populateQuickAdd(playlists, scenarios)
      await initSens()
      await initAimbeast()
    } catch (err) { UI.toast("refresh failed: " + err.message) }
  }

  // ── playlists ──

  document.getElementById("search-input").addEventListener("input", e => {
    plQuery = e.target.value.toLowerCase().trim()
    UI.renderFolders(folders, playlists, plQuery)
  })

  document.getElementById("btn-new-folder").addEventListener("click", () => {
    UI.openFolderModal(async name => {
      if (!DB.ready()) { UI.toast("not connected"); return }
      try { await DB.createFolder(name); await refresh(); UI.toast(`"${name}" created`) }
      catch (err) { UI.toast("error: " + err.message) }
    })
  })

  document.getElementById("folders-container").addEventListener("click", async e => {
    if (e.target.closest(".folder-del")) {
      const id = e.target.closest("[data-folder-id]").dataset.folderId
      const f = folders.find(x => x.id === id)
      if (!f || !confirm(`Delete folder "${f.name}"?\nPlaylists will become unsorted.`)) return
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
        try { await DB.updatePlaylist(pl.id, updates); await refresh(); UI.toast(`"${updates.name}" updated`) }
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
    fileLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "Drop .json or click to browse"
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
    if (!file) { UI.setFeedback("upload-feedback", "pick a .json file", true); return }
    UI.setFeedback("upload-feedback", "uploading…")
    document.getElementById("btn-upload").disabled = true
    try {
      let parsed; try { parsed = JSON.parse(await file.text()) } catch { throw new Error("not valid JSON") }
      await DB.uploadPlaylist({ name, folderId: document.getElementById("pl-folder").value, gameTag: document.getElementById("pl-game").value.trim(), notes: document.getElementById("pl-notes").value.trim(), shareCode: document.getElementById("pl-share").value.trim(), fileData: parsed })
      UI.setFeedback("upload-feedback", `"${name}" uploaded ✓`)
      ;["pl-name","pl-game","pl-notes","pl-share"].forEach(id => document.getElementById(id).value = "")
      document.getElementById("pl-folder").value = ""; fileInput.value = ""; fileLabel.textContent = "Drop .json or click to browse"
      await refresh()
    } catch (err) { UI.setFeedback("upload-feedback", err.message, true) }
    finally { document.getElementById("btn-upload").disabled = false }
  })

  // ── scenarios ──

  document.getElementById("scenario-search").addEventListener("input", e => {
    scQuery = e.target.value.toLowerCase().trim()
    UI.renderScenarios(scenarios, scQuery)
  })

  document.getElementById("btn-add-scenario").addEventListener("click", () => {
    UI.openScenarioBulkModal(async items => {
      if (!DB.ready()) { UI.toast("not connected"); return }
      try {
        await Promise.all(items.map(s => DB.insertScenario(s)))
        await refresh(); UI.toast(`added ${items.length} scenario${items.length !== 1 ? "s" : ""}`)
      } catch (err) { UI.toast("error: " + err.message) }
    })
  })

  document.getElementById("scenarios-container").addEventListener("click", async e => {
    const editBtn = e.target.closest(".btn-edit[data-scenario-id]")
    if (editBtn) {
      const sc = scenarios.find(s => s.id === editBtn.dataset.scenarioId)
      if (!sc) return
      UI.openEditScenarioModal(sc, async updates => {
        try { await DB.updateScenario(sc.id, updates); await refresh(); UI.toast(`"${updates.name}" updated`) }
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
      const [allFolders, allPlaylists] = await Promise.all([DB.getFolders(), DB.getAllPlaylistsWithFiles()])
      const zip = new JSZip()
      const manifest = { folders: allFolders, playlists: [] }

      allPlaylists.forEach(p => {
        const filename = `playlists/${p.id}.json`
        zip.file(filename, JSON.stringify(p.file_data, null, 2))
        manifest.playlists.push({ id: p.id, name: p.name, folder_id: p.folder_id, game_tag: p.game_tag, notes: p.notes, share_code: p.share_code, file: filename })
      })

      zip.file("manifest.json", JSON.stringify(manifest, null, 2))
      const blob = await zip.generateAsync({ type: "blob" })
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `kovaaks-library-${new Date().toISOString().slice(0,10)}.zip` })
      a.click(); URL.revokeObjectURL(a.href)
      UI.setFeedback("export-feedback", `exported ${allPlaylists.length} playlists ✓`)
    } catch (err) { UI.setFeedback("export-feedback", err.message, true) }
  })

  importBtn.addEventListener("click", async () => {
    if (!DB.ready()) { UI.setFeedback("import-feedback", "not connected", true); return }
    const file = importFileInput.files[0]; if (!file) return
    if (!confirm("This will import all folders and playlists from the zip. Existing data won't be deleted. Continue?")) return
    UI.setFeedback("import-feedback", "importing…"); importBtn.disabled = true
    try {
      const zip = await JSZip.loadAsync(file)
      const manifestFile = zip.file("manifest.json")
      if (!manifestFile) throw new Error("no manifest.json found — is this a valid export?")
      const manifest = JSON.parse(await manifestFile.async("string"))

      // create folders and build id map
      const folderMap = {}
      for (const f of manifest.folders) {
        const created = await DB.createFolder(f.name)
        folderMap[f.id] = created.id
      }

      // upload playlists
      let count = 0
      for (const p of manifest.playlists) {
        const jsonFile = zip.file(p.file)
        const fileData = jsonFile ? JSON.parse(await jsonFile.async("string")) : null
        await DB.uploadPlaylist({ name: p.name, folderId: folderMap[p.folder_id]||null, gameTag: p.game_tag, notes: p.notes, shareCode: p.share_code, fileData })
        count++
      }

      await refresh()
      UI.setFeedback("import-feedback", `imported ${count} playlists ✓`)
    } catch (err) { UI.setFeedback("import-feedback", err.message, true) }
    finally { importBtn.disabled = false }
  })

})()
