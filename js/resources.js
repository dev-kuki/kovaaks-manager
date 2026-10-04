// Resources tab: curated links grouped into sections (Title/Link · Description · Author(s)), stored in Supabase.
const Resources = (() => {
  // starter list — links are blank on purpose, add yours with the edit button. [title, description, authors, featured]
  const SEED = [
    ["Documents / Benchmarks", [
      ["Voltaic's Aim Journey", "All about aim theory and the basics of aim training. A really good place to start for new people.", "Voltaic/Sini"],
      ["Voltaic Advice FAQ", "Common questions and answers from the sparky advice channel.", "Voltaic/Sini", 1],
      ["Voltaic Benchmarks", "The best way to test and measure improvement.", "Voltaic/Sini", 1],
      ["Mindset and attitude", "Simple resources to improve your mindset and attitude so you get the most out of training and perform.", "Voltaic/Sini"],
      ["Strafe Aiming 101", "Theory of strafe aiming, also includes routines.", "Aimer7", 1],
      ["Aimer7's Original Aim Workout / Guide", "Very much outdated for the routines but the theory is good.", "Aimer7"],
      ["Aim Coaching 101", "All about what aim coaching is and why it's bad and good. Start here if you want aim coaching.", "Anima"],
      ["Mouse Sensitivity 101", "Sensitivities, the benefits and downsides of different sens, and how to choose a range to play in.", "Anima", 1],
      ["Aim Improvement Guide", "Simple improvement techniques.", "Coach Bitey"],
      ["Aimbot.EXE Guide", "Kinda outdated but still good for low level people as a beginner guide.", "Aimbot.exe"],
      ["Plateaus by krascsi", "What plateaus are and how to overcome them when training.", "krascsi"],
      ["Aim Training Scheduling", "A guide on when and how long to aim train for maximum efficiency.", "Prosper"],
      ["Aim training guide by Fallen", "Great introductory document about the basics of aim training and some simple starting resources.", "Fallen"],
      ["Beginner's Guide to Aim Lab benchmarks", "", "revosect"],
      ["revosect's Aim Lab Benchmarks", "", "revosect", 1],
      ["Aim Training Experiments, General Information and Routines", "A document packed full of good aim training theory, techniques, tips and even some really good routines.", "sdk"]]],
    ["Routines (General)", [
      ["Voltaic Fundamental aim routines 2.0", "The best basic routine with the benchmarks built in. My recommendation for a simple routine for all levels.", "Voltaic", 1],
      ["Voltaic recommended scenarios", "Good basis to make a personalized routine and find new scenarios.", "Voltaic", 1],
      ["Tammas' Routine Addendum", "Updated Aimer7's routine to remove outdated scenarios, with newer techniques and progression.", "Tammas"],
      ["Zeeq's Advanced Playlists", "Really good clicking routines for advanced players.", "Zeeq"],
      ["sdk's Routines and general guides", "A lot of good scenarios, with specific routines like Reactivity, CPS training, Speed, Ult smoothness and some good aim theory.", "sdk"],
      ["7 day overkill routine for grinders", "For advanced. Each day is 2+ hours and covers almost all raw aiming aspects.", "Cowser"],
      ["Laizirz's Routine", "A routine for experienced aimers or future crackheads. Simple complete routine with some good unknown scenarios.", "Laizirz"],
      ["Routine Generator Sheet", "Creates a new routine every day.", "Fallen, Daan"],
      ["Krascsi's KovaaK's playlists", "Covers most aiming styles and problems players might have. The playlist names speak for themselves.", "Krascsi"],
      ["wA Playlist Compilation", "Individual .plo / .json playlist files for KovaaK's, including some of the routines on this list.", "wow Aims"],
      ["Collection of playlists for KovaaK's", "Another collection of .json playlist files for KovaaK's inbuilt playlist feature.", "ridd"],
      ["Lapu4's Playlists", "7 different playlist files created by lapu4 with a focus on static targets.", "Lapu4"]]],
  ]
  let items = [], query = "", state = "idle", errMsg = "", editId = null
  const $ = id => document.getElementById(id), esc = s => UI.esc(s == null ? "" : String(s))
  const safeUrl = u => /^https?:\/\//i.test((u || "").trim()) ? u.trim() : ""
  const byPos = (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || String(a.created_at || "").localeCompare(String(b.created_at || ""))
  const getCollapsed = () => { try { return new Set(JSON.parse(sessionStorage.getItem("res-collapsed") || "[]")) } catch { return new Set() } }
  const EXT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
  const CHEV = `<svg class="res-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 6 15 12 9 18"/></svg>`
  const msg = (glyph, p, span, extra = "") => `<div class="empty-state"><div class="empty-glyph">${glyph}</div><p>${p}</p><span>${span}</span>${extra}</div>`

  function groups() {
    const q = query.trim().toLowerCase()
    const shown = items.filter(r => !q || [r.title, r.description, r.authors, r.section].some(v => (v || "").toLowerCase().includes(q)))
    const sections = [...new Set(items.slice().sort(byPos).map(r => r.section))]
    return sections.map(name => ({ name, rows: shown.filter(r => r.section === name).sort(byPos) })).filter(g => g.rows.length)
  }

  function rowHtml(r, i) {
    const url = safeUrl(r.url)
    const link = url
      ? `<a class="res-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}${EXT}</a>`
      : `<span class="res-link nolink" title="No link yet - hit edit to add one">${esc(r.title)}</span>`
    return `<div class="res-row${r.featured ? " featured" : ""}" style="--i:${Math.min(i, 24)}">
      <div class="res-title">${r.featured ? `<span class="res-star" title="Featured">★</span>` : ""}${link}</div>
      <div class="res-desc">${esc(r.description)}</div>
      <div class="res-auth">${r.authors ? `<span class="res-chip">${esc(r.authors)}</span>` : ""}</div>
      <div class="res-actions"><button class="btn-edit" data-res-edit="${r.id}" title="Edit">${UI.ICON_EDIT}</button><button class="btn-icon" data-res-del="${r.id}" title="Delete">${UI.ICON_TRASH}</button></div>
    </div>`
  }

  function render() {
    const box = $("resources-container"); if (!box) return
    $("resource-count").textContent = items.length
    if (!DB.ready()) { box.innerHTML = msg("⚿", "Not connected", "Connect your database in Settings to use Resources."); return }
    if (state === "loading") { box.innerHTML = msg("…", "Loading resources", ""); return }
    if (state === "error") { box.innerHTML = msg("!", "Couldn't load resources", `Run the <code>resources</code> SQL from Settings once. <br>${esc(errMsg)}`); return }
    if (!items.length) { box.innerHTML = msg("▤", "No resources yet", "Add guides, routines and benchmarks with their links, grouped into sections.", `<button class="btn-primary" id="btn-seed-resources" style="margin-top:14px">Import starter list (${SEED.reduce((n, s) => n + s[1].length, 0)})</button>`); return }
    const gs = groups(), collapsed = getCollapsed()
    if (!gs.length) { box.innerHTML = msg("◻", `No results for "${esc(query)}"`, ""); return }
    let i = 0
    box.innerHTML = gs.map(g => `<section class="res-section${collapsed.has(g.name) ? " collapsed" : ""}" data-sec="${esc(g.name)}">
      <button class="res-sec-head" type="button" data-res-toggle>${CHEV}<h2>${esc(g.name)}</h2><span class="res-sec-count">${g.rows.length}</span></button>
      <div class="res-body"><div class="res-body-in">
        <div class="res-row res-head"><div>Title / Link</div><div>Description</div><div>Author(s)</div><div></div></div>
        ${g.rows.map(r => rowHtml(r, i++)).join("")}
      </div></div></section>`).join("")
  }

  async function init(force = false) {
    if (!DB.ready()) { render(); return }
    if (state === "ready" && !force) return
    state = "loading"; render()
    try { items = await DB.getResources(); state = "ready" } catch (err) { state = "error"; errMsg = err.message }
    render()
  }

  // modal
  const fields = ["section", "title", "url", "desc", "authors"].reduce((o, k) => (o[k] = () => $("res-" + k), o), {})
  function openModal(item) {
    editId = item ? item.id : null
    $("res-modal-title").textContent = item ? "Edit resource" : "Add resource"
    $("res-sections").innerHTML = [...new Set(items.map(r => r.section))].map(s => `<option value="${esc(s)}">`).join("")
    fields.section().value = item ? item.section : ($("res-section").dataset.last || "")
    fields.title().value = item ? item.title : ""
    fields.url().value = item ? (item.url || "") : ""
    fields.desc().value = item ? (item.description || "") : ""
    fields.authors().value = item ? (item.authors || "") : ""
    $("res-featured").checked = !!(item && item.featured)
    $("res-modal").classList.remove("hidden"); fields.title().focus()
  }
  const closeModal = () => $("res-modal").classList.add("hidden")

  async function save() {
    const section = fields.section().value.trim(), title = fields.title().value.trim()
    if (!section || !title) { UI.toast("section and title are required"); return }
    let url = fields.url().value.trim(); if (url && !/^https?:\/\//i.test(url)) url = "https://" + url
    const row = { section, title, url: url || null, description: fields.desc().value.trim() || null, authors: fields.authors().value.trim() || null, featured: $("res-featured").checked }
    try {
      if (editId) { await DB.updateResource(editId, row); Object.assign(items.find(r => r.id === editId), row) }
      else {
        const sameSec = items.filter(r => r.section === section).map(r => r.position ?? 0)
        row.position = (sameSec.length ? Math.max(...sameSec) : items.reduce((m, r) => Math.max(m, r.position ?? 0), -1) + 1) + (sameSec.length ? 0.001 * (sameSec.length) : 0)
        items.push(await DB.insertResource(row))
      }
      $("res-section").dataset.last = section
      closeModal(); render(); UI.toast(editId ? "saved" : `"${title}" added`)
    } catch (err) { UI.toast("couldn't save - " + err.message, 4500) }
  }

  async function seed() {
    let pos = 0; const rows = []
    SEED.forEach(([section, list]) => list.forEach(([title, description, authors, featured]) => rows.push({ section, title, description: description || null, authors: authors || null, featured: !!featured, position: pos++ })))
    try { items = items.concat(await DB.insertResources(rows)); state = "ready"; render(); UI.toast(`imported ${rows.length} resources - add links with the edit button`, 4500) }
    catch (err) { UI.toast("couldn't import - " + err.message, 4500) }
  }

  function bind() {
    $("btn-add-resource").addEventListener("click", () => openModal(null))
    $("resource-search").addEventListener("input", e => { query = e.target.value; render() })
    $("res-save").addEventListener("click", save)
    $("res-cancel").addEventListener("click", closeModal); $("res-modal-close").addEventListener("click", closeModal)
    $("res-modal").addEventListener("mousedown", e => { if (e.target.id === "res-modal") closeModal() })
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal() })
    $("res-modal").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") { e.preventDefault(); save() } })
    $("resources-container").addEventListener("click", async e => {
      if (e.target.closest("#btn-seed-resources")) return seed()
      const tog = e.target.closest("[data-res-toggle]")
      if (tog) {
        const sec = tog.closest(".res-section"), set = getCollapsed(), name = sec.dataset.sec
        sec.classList.toggle("collapsed"); sec.classList.contains("collapsed") ? set.add(name) : set.delete(name)
        sessionStorage.setItem("res-collapsed", JSON.stringify([...set])); return
      }
      const ed = e.target.closest("[data-res-edit]"); if (ed) return openModal(items.find(r => r.id === ed.dataset.resEdit))
      const del = e.target.closest("[data-res-del]")
      if (del) {
        const r = items.find(x => x.id === del.dataset.resDel); if (!r || !confirm(`Delete "${r.title}"?`)) return
        try { await DB.deleteResource(r.id); items = items.filter(x => x.id !== r.id); render(); UI.toast("deleted") } catch (err) { UI.toast("couldn't delete - " + err.message) }
      }
    })
  }
  bind()
  return { init, render, _items: () => items }
})()
