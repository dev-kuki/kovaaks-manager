// routine.js — local session timer, no supabase needed

const Routine = (() => {
  let queue = []        // array of { id, name, totalSecs, shareCode }
  let currentIdx = -1
  let remaining = 0
  let totalSecs = 0
  let ticker = null
  let running = false

  // ── queue rendering ──

  function renderQueue() {
    const container = document.getElementById("routine-queue")
    const totalEl   = document.getElementById("queue-total")
    const totalTime = document.getElementById("queue-total-time")
    container.innerHTML = ""

    if (!queue.length) {
      container.innerHTML = `<div class="empty-state" id="empty-queue"><div class="empty-glyph">⏱</div><p>Queue is empty</p><span>Add blocks to build your session</span></div>`
      totalEl.style.display = "none"
      return
    }

    const grandTotal = queue.reduce((s, b) => s + b.totalSecs, 0)
    totalEl.style.display = "block"
    totalTime.textContent = fmt(grandTotal)

    queue.forEach((block, i) => {
      const el = document.createElement("div")
      el.className = "queue-block" + (i === currentIdx ? " active-block" : "") + (running && i < currentIdx ? " done-block" : "")
      el.dataset.idx = i
      el.innerHTML = `
        <span class="queue-block-index">${i + 1}</span>
        <span class="queue-block-name">${esc(block.name)}</span>
        <span class="queue-block-time">${fmt(block.totalSecs)}</span>
        <div class="queue-block-actions">
          ${block.shareCode ? `<a class="btn-launch" href="steam://run/824270/?action=jump-to-playlist;sharecode=${esc(block.shareCode)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>open
          </a>` : ""}
          <button class="btn-icon" data-remove-idx="${i}" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`
      container.appendChild(el)
    })
  }

  // ── timer display ──

  function updateTimerDisplay() {
    const display = document.getElementById("timer-display")
    const progress = document.getElementById("timer-progress-bar")
    const nameEl = document.getElementById("timer-block-name")
    const nextEl = document.getElementById("timer-up-next")

    if (currentIdx < 0 || currentIdx >= queue.length) {
      display.textContent = "00:00"
      display.className = "timer-display"
      nameEl.textContent = "—"
      progress.style.width = "0%"
      nextEl.textContent = ""
      return
    }

    const block = queue[currentIdx]
    nameEl.textContent = block.name
    display.textContent = fmt(remaining)
    display.className = "timer-display" + (remaining <= 10 ? " warn" : "")

    const pct = block.totalSecs > 0 ? (1 - remaining / block.totalSecs) * 100 : 100
    progress.style.width = pct + "%"

    const next = queue[currentIdx + 1]
    nextEl.textContent = next ? `up next: ${next.name} (${fmt(next.totalSecs)})` : "last block"
  }

  function updatePlayPause() {
    document.getElementById("icon-play").style.display = running ? "none" : ""
    document.getElementById("icon-pause").style.display = running ? "" : "none"
  }

  // ── timer logic ──

  function startTick() {
    clearInterval(ticker)
    ticker = setInterval(() => {
      if (!running) return
      remaining--
      if (remaining <= 0) {
        advance()
      } else {
        updateTimerDisplay()
      }
    }, 1000)
  }

  function advance() {
    if (currentIdx + 1 < queue.length) {
      currentIdx++
      remaining = queue[currentIdx].totalSecs
      renderQueue()
      updateTimerDisplay()
      // auto-open in kovaaks if share code present
      const block = queue[currentIdx]
      if (block.shareCode) {
        window.location.href = `steam://run/824270/?action=jump-to-playlist;sharecode=${block.shareCode}`
      }
    } else {
      // done
      running = false
      clearInterval(ticker)
      updatePlayPause()
      document.getElementById("timer-display").textContent = "done"
      document.getElementById("timer-display").className = "timer-display done"
      document.getElementById("timer-up-next").textContent = "session complete"
    }
  }

  function play() {
    if (!queue.length) return
    if (currentIdx < 0) {
      currentIdx = 0
      remaining = queue[0].totalSecs
    }
    running = true
    updatePlayPause()
    renderQueue()
    updateTimerDisplay()
    startTick()
  }

  function pause() {
    running = false
    updatePlayPause()
  }

  function prev() {
    if (currentIdx > 0) {
      currentIdx--
      remaining = queue[currentIdx].totalSecs
      renderQueue()
      updateTimerDisplay()
    }
  }

  function next() {
    if (currentIdx + 1 < queue.length) {
      currentIdx++
      remaining = queue[currentIdx].totalSecs
      renderQueue()
      updateTimerDisplay()
    }
  }

  // ── block add ──

  function addBlock({ name, totalSecs, shareCode }) {
    if (!name || totalSecs <= 0) return false
    queue.push({ id: Date.now() + Math.random(), name, totalSecs, shareCode: shareCode || "" })
    renderQueue()
    return true
  }

  function removeBlock(idx) {
    queue.splice(idx, 1)
    if (currentIdx >= queue.length) currentIdx = queue.length - 1
    renderQueue()
    updateTimerDisplay()
  }

  function clearQueue() {
    queue = []; currentIdx = -1; running = false
    clearInterval(ticker); updatePlayPause(); renderQueue(); updateTimerDisplay()
  }

  // ── save / load (localStorage) ──

  function saveRoutine(name) {
    const saved = JSON.parse(localStorage.getItem("kv-routines") || "{}")
    saved[name] = { name, blocks: queue.map(b => ({ name: b.name, totalSecs: b.totalSecs, shareCode: b.shareCode })), savedAt: Date.now() }
    localStorage.setItem("kv-routines", JSON.stringify(saved))
    return true
  }

  function getSavedRoutines() {
    return Object.values(JSON.parse(localStorage.getItem("kv-routines") || "{}"))
  }

  function loadRoutine(name) {
    const saved = JSON.parse(localStorage.getItem("kv-routines") || "{}")
    const routine = saved[name]; if (!routine) return false
    clearQueue()
    routine.blocks.forEach(b => {
      queue.push({ id: Date.now() + Math.random(), name: b.name, totalSecs: b.totalSecs, shareCode: b.shareCode || "" })
    })
    renderQueue(); updateTimerDisplay()
    return true
  }

  function deleteRoutine(name) {
    const saved = JSON.parse(localStorage.getItem("kv-routines") || "{}"))
    delete saved[name]
    localStorage.setItem("kv-routines", JSON.stringify(saved))
  }

  // ── quick add from library ──

  function populateQuickAdd(playlists, scenarios) {
    const wrap = document.getElementById("quick-add-wrap")
    const list = document.getElementById("quick-add-list")
    const items = [
      ...playlists.map(p => ({ name: p.name, shareCode: p.share_code || "" })),
      ...scenarios.map(s => ({ name: s.name, shareCode: s.share_code || "" }))
    ]
    if (!items.length) { wrap.style.display = "none"; return }
    wrap.style.display = "block"
    list.innerHTML = ""
    items.slice(0, 12).forEach(item => {
      const row = document.createElement("div"); row.className = "quick-add-item"
      row.innerHTML = `
        <span class="quick-add-name">${esc(item.name)}</span>
        <button class="quick-add-btn" data-qa-name="${esc(item.name)}" data-qa-code="${esc(item.shareCode)}">+ 5 min</button>`
      list.appendChild(row)
    })

    list.addEventListener("click", e => {
      const btn = e.target.closest(".quick-add-btn"); if (!btn) return
      addBlock({ name: btn.dataset.qaName, totalSecs: 300, shareCode: btn.dataset.qaCode })
      UI.toast(`added "${btn.dataset.qaName}"`)
    })
  }

  // ── utils ──

  function fmt(s) {
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
  }

  function esc(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")
  }

  return { addBlock, removeBlock, clearQueue, play, pause, prev, next, saveRoutine, getSavedRoutines, loadRoutine, deleteRoutine, populateQuickAdd, renderQueue, updateTimerDisplay, get running() { return running } }
})()

// ── wire up events ──

;(() => {
  // play/pause
  document.getElementById("btn-timer-play").addEventListener("click", () => {
    Routine.running ? Routine.pause() : Routine.play()
  })
  document.getElementById("btn-timer-prev").addEventListener("click", () => Routine.prev())
  document.getElementById("btn-timer-next").addEventListener("click", () => Routine.next())

  // remove block from queue (delegated)
  document.getElementById("routine-queue").addEventListener("click", e => {
    const btn = e.target.closest("[data-remove-idx]"); if (!btn) return
    Routine.removeBlock(parseInt(btn.dataset.removeIdx))
  })

  // clear queue
  document.getElementById("btn-clear-queue").addEventListener("click", () => {
    if (confirm("Clear the queue?")) Routine.clearQueue()
  })

  // add block modal
  document.getElementById("btn-add-block").addEventListener("click", () => {
    document.getElementById("block-modal-overlay").classList.remove("hidden")
    document.getElementById("block-name").value = ""
    document.getElementById("block-duration").value = "5:00"
    document.getElementById("block-share").value = ""
    setTimeout(() => document.getElementById("block-name").focus(), 50)
  })

  function parseDuration(str) {
    // accepts: "5", "5:00", "5:30", "90" (seconds if no colon)
    str = str.trim()
    if (!str) return 0
    if (str.includes(":")) {
      const [m, s] = str.split(":").map(x => parseInt(x) || 0)
      return m * 60 + s
    }
    const n = parseInt(str) || 0
    // if > 99 treat as seconds, else as minutes
    return n > 99 ? n : n * 60
  }

  function closeBlockModal() {
    document.getElementById("block-modal-overlay").classList.add("hidden")
  }

  document.getElementById("block-modal-close").addEventListener("click", closeBlockModal)
  document.getElementById("block-modal-cancel").addEventListener("click", closeBlockModal)
  document.getElementById("block-modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("block-modal-overlay")) closeBlockModal()
  })

  document.getElementById("block-modal-confirm").addEventListener("click", () => {
    const name = document.getElementById("block-name").value.trim()
    const share = document.getElementById("block-share").value.trim()
    const totalSecs = parseDuration(document.getElementById("block-duration").value)
    if (!name) { document.getElementById("block-name").focus(); return }
    if (totalSecs <= 0) { document.getElementById("block-duration").focus(); UI.toast("set a duration greater than 0"); return }
    queue.push({ id: Date.now() + Math.random(), name, totalSecs, shareCode: share })
    renderQueue()
    closeBlockModal()
    UI.toast(`"${name}" added to queue`)
  })

  ;["block-name", "block-duration", "block-share"].forEach(id => {
    document.getElementById(id).addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("block-modal-confirm").click()
    })
  })

  // save routine
  document.getElementById("btn-save-routine").addEventListener("click", () => {
    const name = prompt("Routine name:")
    if (!name) return
    Routine.saveRoutine(name.trim())
    UI.toast(`"${name}" saved`)
  })

  // load routine modal
  document.getElementById("btn-load-routine").addEventListener("click", () => {
    const routines = Routine.getSavedRoutines()
    const list = document.getElementById("saved-routines-list")
    list.innerHTML = ""

    if (!routines.length) {
      list.innerHTML = `<div class="empty-state" style="padding:20px"><span>No saved routines yet</span></div>`
    } else {
      routines.forEach(r => {
        const row = document.createElement("div"); row.className = "saved-routine-row"
        const total = r.blocks.reduce((s, b) => s + b.totalSecs, 0)
        const mins = Math.floor(total / 60)
        row.innerHTML = `
          <span class="saved-routine-name">${r.name}</span>
          <span class="saved-routine-meta">${r.blocks.length} blocks · ${mins}m</span>
          <button class="btn-primary btn-sm" data-load="${r.name}">Load</button>
          <button class="btn-icon" data-del-routine="${r.name}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>`
        list.appendChild(row)
      })
    }

    document.getElementById("load-routine-modal-overlay").classList.remove("hidden")
  })

  document.getElementById("saved-routines-list").addEventListener("click", e => {
    const loadBtn = e.target.closest("[data-load]")
    if (loadBtn) {
      Routine.loadRoutine(loadBtn.dataset.load)
      document.getElementById("load-routine-modal-overlay").classList.add("hidden")
      UI.toast(`"${loadBtn.dataset.load}" loaded`)
      return
    }
    const delBtn = e.target.closest("[data-del-routine]")
    if (delBtn) {
      if (!confirm(`Delete routine "${delBtn.dataset.delRoutine}"?`)) return
      Routine.deleteRoutine(delBtn.dataset.delRoutine)
      delBtn.closest(".saved-routine-row").remove()
    }
  })

  function closeLoadModal() { document.getElementById("load-routine-modal-overlay").classList.add("hidden") }
  document.getElementById("load-routine-modal-close").addEventListener("click", closeLoadModal)
  document.getElementById("load-routine-modal-cancel").addEventListener("click", closeLoadModal)
  document.getElementById("load-routine-modal-overlay").addEventListener("click", e => { if (e.target === document.getElementById("load-routine-modal-overlay")) closeLoadModal() })
})()
