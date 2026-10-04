const DB = (() => {
  let client = null

  function init(url, key) { client = supabase.createClient(url, key) }
  function ready() { return client !== null }

  async function ping() {
    if (!client) return false
    try { const { error } = await client.from("folders").select("id").limit(1); return !error } catch { return false }
  }

  // generic — writes 0..n-1 as `position` for a list of ids, in the order given
  async function bulkPosition(table, ids) {
    for (let i = 0; i < ids.length; i += 20) {
      const results = await Promise.all(ids.slice(i, i + 20).map((id, j) => client.from(table).update({ position: i + j }).eq("id", id)))
      const failed = results.find(r => r.error)
      if (failed) throw failed.error
    }
  }

  // folders
  // select("*") on purpose — new columns (position, pinned, …) are picked up
  // automatically without every query needing to know the exact column list.
  async function getFolders() {
    const { data, error } = await client.from("folders").select("*")
    if (error) throw error; return data
  }
  async function createFolder(name, color, parentId) {
    const row = { name }
    if (color) row.color = color
    if (parentId) row.parent_id = parentId // only sent when set, so old DBs without the column keep working
    const { data, error } = await client.from("folders").insert(row).select().single()
    if (error) throw error; return data
  }
  async function renameFolder(id, name) {
    const { error } = await client.from("folders").update({ name }).eq("id", id)
    if (error) throw error
  }
  async function deleteFolder(id) {
    const { error } = await client.from("folders").delete().eq("id", id)
    if (error) throw error
  }
  async function reorderFolders(ids) { await bulkPosition("folders", ids) }
  async function setFolderParent(id, parentId) {
    const { error } = await client.from("folders").update({ parent_id: parentId || null }).eq("id", id)
    if (error) throw error
  }
  async function setFolderColor(id, color) {
    const { error } = await client.from("folders").update({ color: color || null }).eq("id", id)
    if (error) throw error
  }
  async function setPlaylistColor(id, color) {
    const { error } = await client.from("playlists").update({ color: color || null }).eq("id", id)
    if (error) throw error
  }

  // playlists
  async function getAllPlaylists() {
    const { data, error } = await client.from("playlists").select("*")
    if (error) throw error; return data
  }
  async function togglePlaylistPin(id, pinned) {
    const { error } = await client.from("playlists").update({ pinned }).eq("id", id)
    if (error) throw error
  }
  async function uploadPlaylist({ name, folderId, gameTag, notes, shareCode, fileData, color }) {
    const row = { name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, share_code: shareCode||null, file_data: fileData == null ? null : fileData }
    if (color) row.color = color // only sent when set, so it never breaks a DB that hasn't run the color migration
    const { data, error } = await client.from("playlists").insert(row).select().single()
    if (error) throw error; return data
  }
  async function updatePlaylist(id, { name, folderId, gameTag, notes, shareCode, fileData }) {
    const fields = { name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, share_code: shareCode||null }
    if (fileData !== undefined) fields.file_data = fileData
    const { data, error } = await client.from("playlists").update(fields).eq("id", id).select().single()
    if (error) throw error; return data
  }
  async function movePlaylistToFolder(id, folderId) {
    const { error } = await client.from("playlists").update({ folder_id: folderId||null }).eq("id", id)
    if (error) throw error
  }
  async function getPlaylistFile(id) {
    const { data, error } = await client.from("playlists").select("file_data,name").eq("id", id).single()
    if (error) throw error; return data
  }
  async function deletePlaylist(id) {
    const { error } = await client.from("playlists").delete().eq("id", id)
    if (error) throw error
  }
  async function getAllPlaylistsWithFiles() {
    const { data, error } = await client.from("playlists").select("*").order("name")
    if (error) throw error; return data
  }
  async function reorderPlaylists(ids) { await bulkPosition("playlists", ids) }

  // scenario folders (mirrors playlist folders)
  async function getScenarioFolders() {
    const { data, error } = await client.from("scenario_folders").select("*")
    if (error) throw error; return data
  }
  async function createScenarioFolder(name, color, parentId) {
    const row = { name }
    if (color) row.color = color
    if (parentId) row.parent_id = parentId
    const { data, error } = await client.from("scenario_folders").insert(row).select().single()
    if (error) throw error; return data
  }
  async function setScenarioFolderParent(id, parentId) {
    const { error } = await client.from("scenario_folders").update({ parent_id: parentId || null }).eq("id", id)
    if (error) throw error
  }
  async function setScenarioFolderColor(id, color) {
    const { error } = await client.from("scenario_folders").update({ color: color || null }).eq("id", id)
    if (error) throw error
  }
  async function renameScenarioFolder(id, name) {
    const { error } = await client.from("scenario_folders").update({ name }).eq("id", id)
    if (error) throw error
  }
  async function deleteScenarioFolder(id) {
    const { error } = await client.from("scenario_folders").delete().eq("id", id)
    if (error) throw error
  }
  async function reorderScenarioFolders(ids) { await bulkPosition("scenario_folders", ids) }

  // scenarios
  async function getAllScenarios() {
    const { data, error } = await client.from("scenarios").select("*")
    if (error) throw error; return data
  }
  async function insertScenario({ name, shareCode, gameTag, notes, folderId }) {
    const { data, error } = await client.from("scenarios").insert({ name, share_code: shareCode||null, game_tag: gameTag||null, notes: notes||null, folder_id: folderId||null }).select().single()
    if (error) throw error; return data
  }
  async function updateScenario(id, { name, shareCode, gameTag, notes, folderId }) {
    const fields = { name, share_code: shareCode||null, game_tag: gameTag||null, notes: notes||null }
    if (folderId !== undefined) fields.folder_id = folderId||null
    const { data, error } = await client.from("scenarios").update(fields).eq("id", id).select().single()
    if (error) throw error; return data
  }
  async function moveScenarioToFolder(id, folderId) {
    const { error } = await client.from("scenarios").update({ folder_id: folderId||null }).eq("id", id)
    if (error) throw error
  }
  async function toggleScenarioPin(id, pinned) {
    const { error } = await client.from("scenarios").update({ pinned }).eq("id", id)
    if (error) throw error
  }
  async function deleteScenario(id) {
    const { error } = await client.from("scenarios").delete().eq("id", id)
    if (error) throw error
  }
  async function createScenarioFull(row) {
    const { data, error } = await client.from("scenarios").insert(row).select().single()
    if (error) throw error; return data
  }
  async function reorderScenarios(ids) { await bulkPosition("scenarios", ids) }

  // sens
  async function getSens() {
    const { data, error } = await client.from("sens").select("*").order("scenario_type")
    if (error) throw error; return data
  }
  async function upsertSens(scenarioType, cm360) {
    const { error } = await client.from("sens").upsert({ scenario_type: scenarioType, cm360, updated_at: new Date().toISOString() }, { onConflict: "scenario_type" })
    if (error) throw error
  }
  async function addSensType(scenarioType) {
    const { error } = await client.from("sens").insert({ scenario_type: scenarioType })
    if (error) throw error
  }
  async function deleteSensType(id) {
    const { error } = await client.from("sens").delete().eq("id", id)
    if (error) throw error
  }

  // aimbeast folders
  async function getAimFolders() {
    const { data, error } = await client.from("aimbeast_folders").select("*")
    if (error) throw error; return data
  }
  async function createAimFolder(name, color, parentId) {
    const row = { name }
    if (color) row.color = color
    if (parentId) row.parent_id = parentId
    const { data, error } = await client.from("aimbeast_folders").insert(row).select().single()
    if (error) throw error; return data
  }
  async function setAimFolderParent(id, parentId) {
    const { error } = await client.from("aimbeast_folders").update({ parent_id: parentId || null }).eq("id", id)
    if (error) throw error
  }
  async function setAimFolderColor(id, color) {
    const { error } = await client.from("aimbeast_folders").update({ color: color || null }).eq("id", id)
    if (error) throw error
  }
  async function renameAimFolder(id, name) {
    const { error } = await client.from("aimbeast_folders").update({ name }).eq("id", id)
    if (error) throw error
  }
  async function deleteAimFolder(id) {
    const { error } = await client.from("aimbeast_folders").delete().eq("id", id)
    if (error) throw error
  }
  async function reorderAimFolders(ids) { await bulkPosition("aimbeast_folders", ids) }

  // aimbeast playlists
  async function getAllAimPlaylists() {
    const { data, error } = await client.from("aimbeast_playlists").select("*")
    if (error) throw error; return data
  }
  async function uploadAimPlaylist({ name, folderId, gameTag, notes, workshopUrl, playlistCode }) {
    const { data, error } = await client.from("aimbeast_playlists").insert({ name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, workshop_url: workshopUrl||null, playlist_code: playlistCode||null }).select().single()
    if (error) throw error; return data
  }
  async function updateAimPlaylist(id, { name, folderId, gameTag, notes, workshopUrl, playlistCode }) {
    const { data, error } = await client.from("aimbeast_playlists").update({ name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, workshop_url: workshopUrl||null, playlist_code: playlistCode||null }).eq("id", id).select().single()
    if (error) throw error; return data
  }
  async function toggleAimPlaylistPin(id, pinned) {
    const { error } = await client.from("aimbeast_playlists").update({ pinned }).eq("id", id)
    if (error) throw error
  }
  async function movePlaylistToAimFolder(id, folderId) {
    const { error } = await client.from("aimbeast_playlists").update({ folder_id: folderId||null }).eq("id", id)
    if (error) throw error
  }
  async function deleteAimPlaylist(id) {
    const { error } = await client.from("aimbeast_playlists").delete().eq("id", id)
    if (error) throw error
  }
  async function reorderAimPlaylists(ids) { await bulkPosition("aimbeast_playlists", ids) }

  return {
    init, ready, ping,
    getFolders, createFolder, renameFolder, deleteFolder, reorderFolders, setFolderParent, setFolderColor, setPlaylistColor,
    getAllPlaylists, togglePlaylistPin, uploadPlaylist, updatePlaylist, movePlaylistToFolder, getPlaylistFile, deletePlaylist, getAllPlaylistsWithFiles, reorderPlaylists,
    getScenarioFolders, createScenarioFolder, renameScenarioFolder, deleteScenarioFolder, reorderScenarioFolders, setScenarioFolderParent, setScenarioFolderColor,
    getAllScenarios, insertScenario, createScenarioFull, updateScenario, moveScenarioToFolder, toggleScenarioPin, deleteScenario, reorderScenarios,
    getSens, upsertSens, addSensType, deleteSensType,
    getAimFolders, createAimFolder, renameAimFolder, deleteAimFolder, reorderAimFolders, setAimFolderParent, setAimFolderColor,
    getAllAimPlaylists, uploadAimPlaylist, updateAimPlaylist, toggleAimPlaylistPin, movePlaylistToAimFolder, deleteAimPlaylist, reorderAimPlaylists,
  }
})()
