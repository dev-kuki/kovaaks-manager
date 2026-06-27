// app.js — state + event wiring

;(async () => {

  // ── state ──

  let folders = []
  let playlists = []
  let searchQuery = ""

  // ── load saved credentials ──

  const savedUrl = localStorage.getItem("sb-url") || ""
  const savedKey = localStorage.getItem("sb-key") || ""

  if (savedUrl && savedKey) {
    document.getElementById("sb-url").value = savedUrl
    document.getElementById("sb-key").value = savedKey
    await connect(savedUrl, savedKey, true)
  }

  // ── view switching ──

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"))
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"))
      btn.classList.add("active")
      document.getElementById("view-" + btn.dataset.view).classList.add("active")
    })
  })

  // ── settings: save + connect ──

  document.getElementById("btn-save-settings").addEventListener("click", async () => {
    const url = document.getElementById("sb-url").value.trim()
    const key = document.getElementById("sb-key").value.trim()
    if (!url || !key) {
      UI.setFeedback("settings-feedback", "fill in both fields", true)
      return
    }
    await connect(url, key, false)
  })

  async function connect(url, key, silent = false) {
    UI.setStatus("connecting")
    UI.setFeedback("settings-feedback", "")
    try {
      DB.init(url, key)
      const ok = await DB.ping()
      if (!ok) throw new Error("could not reach the database — check your URL and key")
      localStorage.setItem("sb-url", url)
      localStorage.setItem("sb-key", key)
      UI.setStatus("connected")
      if (!silent) UI.setFeedback("settings-feedback", "connected ✓")
      await refresh()
    } catch (err) {
      UI.setStatus("disconnected")
      UI.setFeedback("settings-feedback", err.message, true)
    }
  }

  // ── data refresh ──

  async function refresh() {
    if (!DB.ready()) return
    try {
      ;[folders, playlists] = await Promise.all([DB.getFolders(), DB.getAllPlaylists()])
      UI.populateFolderSelect(folders, "pl-folder")
      UI.renderFolders(folders, playlists, searchQuery)
    } catch (err) {
      UI.toast("refresh failed: " + err.message)
    }
  }

  // ── search ──

  document.getElementById("search-input").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase().trim()
    UI.renderFolders(folders, playlists, searchQuery)
  })

  // ── new folder ──

  document.getElementById("btn-new-folder").addEventListener("click", () => {
    UI.openFolderModal(async name => {
      if (!DB.ready()) { UI.toast("not connected to supabase yet", 3000); return }
      try {
        await DB.createFolder(name)
        await refresh()
        UI.toast(`folder "${name}" created`)
      } catch (err) {
        UI.toast("error: " + err.message)
      }
    })
  })

  // ── playlist actions (delegated) ──

  document.getElementById("folders-container").addEventListener("click", async e => {

    // delete folder
    if (e.target.closest(".folder-delete")) {
      const id = e.target.closest("[data-folder-id]").dataset.folderId
      const folder = folders.find(f => f.id === id)
      if (!folder || !confirm(`delete folder "${folder.name}"?\nplaylists inside will become unsorted.`)) return
      try {
        await DB.deleteFolder(id)
        await refresh()
        UI.toast(`"${folder.name}" deleted`)
      } catch (err) {
        UI.toast("error: " + err.message)
      }
      return
    }

    // copy name
    const copyBtn = e.target.closest(".btn-copy")
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.name)
        UI.toast("copied: " + copyBtn.dataset.name)
      } catch {
        UI.toast("clipboard not available")
      }
      return
    }

    // edit playlist
    const editBtn = e.target.closest(".btn-edit")
    if (editBtn) {
      const id = editBtn.dataset.playlistId
      const playlist = playlists.find(p => p.id === id)
      if (!playlist) return

      UI.openEditModal(playlist, folders, async updates => {
        try {
          await DB.updatePlaylist(id, updates)
          await refresh()
          UI.toast(`"${updates.name}" updated`)
        } catch (err) {
          UI.toast("error: " + err.message)
        }
      })
      return
    }

    // download json
    const dlBtn = e.target.closest(".btn-download")
    if (dlBtn) {
      const id = dlBtn.dataset.playlistId
      try {
        const { file_data, name } = await DB.getPlaylistFile(id)
        const blob = new Blob([JSON.stringify(file_data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = name.replace(/[^a-z0-9_\-. ]/gi, "_") + ".json"
        a.click()
        URL.revokeObjectURL(url)
        UI.toast("downloading…")
      } catch (err) {
        UI.toast("error: " + err.message)
      }
      return
    }

    // delete playlist
    const delBtn = e.target.closest("[data-delete-playlist]")
    if (delBtn) {
      const id = delBtn.dataset.deletePlaylist
      const pl = playlists.find(p => p.id === id)
      if (!pl || !confirm(`delete "${pl.name}"?`)) return
      try {
        await DB.deletePlaylist(id)
        await refresh()
        UI.toast(`"${pl.name}" deleted`)
      } catch (err) {
        UI.toast("error: " + err.message)
      }
    }
  })

  // ── upload ──

  const fileInput = document.getElementById("pl-file")
  const fileLabel = document.getElementById("file-label")
  const fileDrop = document.getElementById("file-drop")

  fileInput.addEventListener("change", () => {
    fileLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "drop a .json here or click to browse"
  })

  fileDrop.addEventListener("dragover", e => { e.preventDefault(); fileDrop.classList.add("dragover") })
  fileDrop.addEventListener("dragleave", () => fileDrop.classList.remove("dragover"))
  fileDrop.addEventListener("drop", e => {
    e.preventDefault()
    fileDrop.classList.remove("dragover")
    const f = e.dataTransfer.files[0]
    if (f) {
      const dt = new DataTransfer()
      dt.items.add(f)
      fileInput.files = dt.files
      fileLabel.textContent = f.name
    }
  })

  document.getElementById("btn-upload").addEventListener("click", async () => {
    if (!DB.ready()) {
      UI.setFeedback("upload-feedback", "not connected — set up supabase in settings first", true)
      return
    }

    const name = document.getElementById("pl-name").value.trim()
    const folderId = document.getElementById("pl-folder").value
    const gameTag = document.getElementById("pl-game").value.trim()
    const notes = document.getElementById("pl-notes").value.trim()
    const shareCode = document.getElementById("pl-share").value.trim()
    const file = fileInput.files[0]

    if (!name) { UI.setFeedback("upload-feedback", "playlist name is required", true); return }
    if (!file) { UI.setFeedback("upload-feedback", "pick a .json file", true); return }

    UI.setFeedback("upload-feedback", "uploading…")
    document.getElementById("btn-upload").disabled = true

    try {
      const text = await file.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { throw new Error("that file isn't valid JSON") }

      await DB.uploadPlaylist({ name, folderId, gameTag, notes, shareCode, fileData: parsed })

      UI.setFeedback("upload-feedback", `"${name}" uploaded ✓`)
      document.getElementById("pl-name").value = ""
      document.getElementById("pl-folder").value = ""
      document.getElementById("pl-game").value = ""
      document.getElementById("pl-notes").value = ""
      document.getElementById("pl-share").value = ""
      fileInput.value = ""
      fileLabel.textContent = "drop a .json here or click to browse"

      await refresh()
    } catch (err) {
      UI.setFeedback("upload-feedback", err.message, true)
    } finally {
      document.getElementById("btn-upload").disabled = false
    }
  })

})()
