// sens.js — sensitivity tracker

// ── SENSITIVITY ──

async function initSens() {
  if (!DB.ready()) return
  try {
    const rows = await DB.getSens()
    renderSens(rows)
    populateCalcApplySelect(rows)
  } catch (err) { UI.toast("sens load failed: " + err.message) }
}

// ── quick calculator (eDPI + CS2/Source cm/360) ──

function populateCalcApplySelect(rows) {
  const sel = document.getElementById("calc-apply-type"); if (!sel) return
  sel.innerHTML = '<option value="">apply cm/360 to tracked type…</option>'
  rows.forEach(r => {
    const o = document.createElement("option"); o.value = r.scenario_type; o.textContent = r.scenario_type
    sel.appendChild(o)
  })
}

function runSensCalc() {
  const dpiEl = document.getElementById("calc-dpi"); if (!dpiEl) return
  const dpi = parseFloat(dpiEl.value)
  const sens = parseFloat(document.getElementById("calc-ingame-sens").value)
  const edpiEl = document.getElementById("calc-edpi")
  const cm360El = document.getElementById("calc-cm360")

  if (!dpi || !sens || dpi <= 0 || sens <= 0) {
    edpiEl.textContent = "—"; cm360El.textContent = "—"
    return
  }
  const edpi = dpi * sens
  const cm360 = (360 / (dpi * sens * 0.022)) * 2.54
  edpiEl.textContent = Math.round(edpi)
  cm360El.textContent = cm360.toFixed(2)
  try { localStorage.setItem("kv-mouse-dpi", String(dpi)) } catch {}
}

function initSensCalc() {
  const dpiEl = document.getElementById("calc-dpi"); if (!dpiEl) return
  try {
    const savedDpi = localStorage.getItem("kv-mouse-dpi")
    if (savedDpi) dpiEl.value = savedDpi
  } catch {}
  ;["calc-dpi", "calc-ingame-sens"].forEach(id => {
    document.getElementById(id).addEventListener("input", runSensCalc)
  })
  document.getElementById("calc-apply-btn").addEventListener("click", async () => {
    const type = document.getElementById("calc-apply-type").value
    const cm360 = document.getElementById("calc-cm360").textContent
    if (!type) { UI.toast("pick a tracked type first"); return }
    if (cm360 === "—") { UI.toast("enter DPI and sensitivity first"); return }
    try {
      await DB.upsertSens(type, parseFloat(cm360))
      UI.toast(`applied ${cm360} cm/360 to "${type}"`)
      await initSens()
    } catch (err) { UI.toast("error: " + err.message) }
  })
  runSensCalc()
}
initSensCalc()

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
