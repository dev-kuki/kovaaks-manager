// ui.js — pure rendering helpers, no state

const UI = (() => {

  // ── toast ──

  let toastTimer = null

  function toast(msg, duration = 2500) {
    let el = document.getElementById("toast")
    if (!el) {
      el = document.createElement("div")
      el.id = "toast"
      document.body.appendChild(el)
    }
    el.textContent = msg
    el.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove("show"), duration)
  }

  // ── connection status ──

  function setStatus(state) {
    const dot = document.getElementById("conn-status")
    const label = document.getElementById("conn-label")
    dot.className = "status-dot " + state
    const labels = { connected: "connected", disconnected: "not connected", connecting: "connecting…" }
    label.textContent = labels[state] || state
  }

  // ── feedback ──

  function setFeedback(elId, msg, isError = false) {
    const el = document.getElementById(elId)
    if (!el) return
    el.textContent = msg
    el.className = isError ? "feedback-err" : "feedback-ok"
  }

  // ── folder select in upload form ──

  function populateFolderSelect(folders) {
    const sel = document.getElementById("pl-folder")
    // keep the first "no folder" option
    sel.innerHTML = '<option value="">— no folder —</option>'
    folders.forEach(f => {
      const opt = document.createElement("option")
      opt.value = f.id
      opt.textContent = f.name
      sel.appendChild(opt)
    })
  }

  // ── folders + playlists tree ──

  function renderFolders(folders, playlists, query = "") {
    const container = document.getElementById("folders-container")
    const emptyState = document.getElementById("empty-playlists")

    // group playlists by folder
    const byFolder = {}
    const unassigned = []

    playlists.forEach(p => {
      const matches = !query || p.name.toLowerCase().includes(query) || (p.game_tag || "").toLowerCase().includes(query)
      if (!matches) return

      if (p.folder_id) {
        if (!byFolder[p.folder_id]) byFolder[p.folder_id] = []
        byFolder[p.folder_id].push(p)
      } else {
        unassigned.push(p)
      }
    })

    container.innerHTML = ""

    const totalVisible = playlists.filter(p =>
      !query || p.name.toLowerCase().includes(query) || (p.game_tag || "").toLowerCase().includes(query)
    ).length

    if (totalVisible === 0 && folders.length === 0) {
      container.appendChild(emptyState)
      emptyState.style.display = "flex"
      return
    }

    const list = document.createElement("div")
    list.className = "folders-list"

    // render each folder
    folders.forEach(f => {
      const items = byFolder[f.id] || []
      if (query && items.length === 0) return // hide empty folders during search

      const folderEl = makeFolderEl(f, items)
      list.appendChild(folderEl)
    })

    // unassigned playlists at the bottom
    if (unassigned.length > 0) {
      const ghost = { id: "none", name: "unsorted" }
      const folderEl = makeFolderEl(ghost, unassigned, true)
      list.appendChild(folderEl)
    }

    if (list.children.length === 0) {
      const empty = document.createElement("div")
      empty.className = "empty-state"
      empty.innerHTML = `<div class="empty-icon">◻</div><p>no results for "${query}"</p>`
      container.appendChild(empty)
    } else {
      container.appendChild(list)
    }
  }

  function makeFolderEl(folder, playlists, isGhost = false) {
    const el = document.createElement("div")
    el.className = "folder-item"
    el.dataset.folderId = folder.id

    // restore open state from session
    const openKey = "folder-open-" + folder.id
    if (sessionStorage.getItem(openKey) === "1") el.classList.add("open")

    el.innerHTML = `
      <div class="folder-header">
        <span class="folder-chevron">›</span>
        <span class="folder-icon">${isGhost ? "·" : "▸"}</span>
        <span class="folder-name">${escHtml(folder.name)}</span>
        <span class="folder-count">${playlists.length}</span>
        ${!isGhost ? `<button class="btn-icon folder-delete" data-folder-id="${folder.id}" title="delete folder">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ""}
      </div>
      <div class="folder-body"></div>
    `

    const header = el.querySelector(".folder-header")
    const body = el.querySelector(".folder-body")

    // toggle
    header.addEventListener("click", e => {
      if (e.target.closest(".folder-delete")) return
      el.classList.toggle("open")
      sessionStorage.setItem(openKey, el.classList.contains("open") ? "1" : "0")
    })

    // populate body
    if (playlists.length === 0) {
      body.innerHTML = `<div class="empty-state" style="padding:20px"><span>no playlists in this folder</span></div>`
    } else {
      playlists.forEach(p => body.appendChild(makePlaylistRow(p)))
    }

    return el
  }

  function makePlaylistRow(playlist) {
    const row = document.createElement("div")
    row.className = "playlist-row"
    row.dataset.playlistId = playlist.id

    row.innerHTML = `
      <span class="playlist-dot"></span>
      <span class="playlist-name">${escHtml(playlist.name)}</span>
      ${playlist.game_tag ? `<span class="playlist-tag">${escHtml(playlist.game_tag)}</span>` : ""}
      <div class="playlist-actions">
        <button class="btn-copy" data-playlist-id="${playlist.id}" data-name="${escHtml(playlist.name)}" title="copy name">copy name</button>
        <button class="btn-download" data-playlist-id="${playlist.id}" title="download .json">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="btn-icon" data-delete-playlist="${playlist.id}" title="delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    `

    return row
  }

  // ── modal ──

  function openModal(onConfirm) {
    const overlay = document.getElementById("modal-overlay")
    const input = document.getElementById("folder-name-input")
    overlay.classList.remove("hidden")
    input.value = ""
    input.focus()

    const confirm = document.getElementById("modal-confirm")
    const cancel = document.getElementById("modal-cancel")
    const close = document.getElementById("modal-close")

    function cleanup() {
      overlay.classList.add("hidden")
      confirm.onclick = null
      cancel.onclick = null
      close.onclick = null
    }

    confirm.onclick = () => {
      const name = input.value.trim()
      if (!name) { input.focus(); return }
      cleanup()
      onConfirm(name)
    }

    input.onkeydown = e => {
      if (e.key === "Enter") confirm.onclick()
    }

    cancel.onclick = cleanup
    close.onclick = cleanup
    overlay.onclick = e => { if (e.target === overlay) cleanup() }
  }

  // ── utils ──

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  return {
    toast,
    setStatus,
    setFeedback,
    populateFolderSelect,
    renderFolders,
    openModal,
  }
})()
