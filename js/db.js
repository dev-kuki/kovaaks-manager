const DB = (() => {
  let client = null

  function init(url, key) { client = supabase.createClient(url, key) }
  function ready() { return client !== null }

  async function ping() {
    if (!client) return false
    try { const { error } = await client.from("folders").select("id").limit(1); return !error } catch { return false }
  }

  // folders
  async function getFolders() {
    const { data, error } = await client.from("folders").select("*").order("name")
    if (error) throw error; return data
  }
  async function createFolder(name) {
    const { data, error } = await client.from("folders").insert({ name }).select().single()
    if (error) throw error; return data
  }
  async function deleteFolder(id) {
    const { error } = await client.from("folders").delete().eq("id", id)
    if (error) throw error
  }

  // playlists
  async function getAllPlaylists() {
    const { data, error } = await client.from("playlists").select("id,name,folder_id,game_tag,notes,share_code,created_at,pinned").order("name")
    if (!error) return data
    // "pinned" column may not exist yet if the migration hasn't been run — fall back gracefully
    const fallback = await client.from("playlists").select("id,name,folder_id,game_tag,notes,share_code,created_at").order("name")
    if (fallback.error) throw fallback.error
    return fallback.data
  }
  async function togglePlaylistPin(id, pinned) {
    const { error } = await client.from("playlists").update({ pinned }).eq("id", id)
    if (error) throw error
  }
  async function uploadPlaylist({ name, folderId, gameTag, notes, shareCode, fileData }) {
    const { data, error } = await client.from("playlists").insert({ name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, share_code: shareCode||null, file_data: fileData }).select().single()
    if (error) throw error; return data
  }
  async function updatePlaylist(id, { name, folderId, gameTag, notes, shareCode, fileData }) {
    const fields = { name, folder_id: folderId||null, game_tag: gameTag||null, notes: notes||null, share_code: shareCode||null }
    if (fileData !== undefined) fields.file_data = fileData
    const { data, error } = await client.from("playlists").update(fields).eq("id", id).select().single()
    if (error) throw error; return data
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

  // scenarios
  async function getAllScenarios() {
    const { data, error } = await client.from("scenarios").select("*").order("name")
    if (error) throw error; return data
  }
  async function insertScenario({ name, shareCode, gameTag, notes }) {
    const { data, error } = await client.from("scenarios").insert({ name, share_code: shareCode||null, game_tag: gameTag||null, notes: notes||null }).select().single()
    if (error) throw error; return data
  }
  async function updateScenario(id, { name, shareCode, gameTag, notes }) {
    const { data, error } = await client.from("scenarios").update({ name, share_code: shareCode||null, game_tag: gameTag||null, notes: notes||null }).eq("id", id).select().single()
    if (error) throw error; return data
  }
  async function toggleScenarioPin(id, pinned) {
    const { error } = await client.from("scenarios").update({ pinned }).eq("id", id)
    if (error) throw error
  }
  async function deleteScenario(id) {
    const { error } = await client.from("scenarios").delete().eq("id", id)
    if (error) throw error
  }

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
    const { data, error } = await client.from("aimbeast_folders").select("*").order("name")
    if (error) throw error; return data
  }
  async function createAimFolder(name) {
    const { data, error } = await client.from("aimbeast_folders").insert({ name }).select().single()
    if (error) throw error; return data
  }
  async function deleteAimFolder(id) {
    const { error } = await client.from("aimbeast_folders").delete().eq("id", id)
    if (error) throw error
  }

  // aimbeast playlists
  async function getAllAimPlaylists() {
    const { data, error } = await client.from("aimbeast_playlists").select("id,name,folder_id,game_tag,notes,workshop_url,playlist_code,created_at").order("name")
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
  async function deleteAimPlaylist(id) {
    const { error } = await client.from("aimbeast_playlists").delete().eq("id", id)
    if (error) throw error
  }
  return { init, ready, ping, getFolders, createFolder, deleteFolder, getAllPlaylists, togglePlaylistPin, uploadPlaylist, updatePlaylist, getPlaylistFile, deletePlaylist, getAllPlaylistsWithFiles, getAllScenarios, insertScenario, updateScenario, toggleScenarioPin, deleteScenario, getSens, upsertSens, addSensType, deleteSensType, getAimFolders, createAimFolder, deleteAimFolder, getAllAimPlaylists, uploadAimPlaylist, updateAimPlaylist, deleteAimPlaylist }
})()
