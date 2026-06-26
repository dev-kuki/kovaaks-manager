// db.js — thin wrapper around supabase for folders + playlists

const DB = (() => {
  let client = null

  function init(url, key) {
    client = supabase.createClient(url, key)
  }

  function ready() {
    return client !== null
  }

  async function ping() {
    if (!client) return false
    try {
      const { error } = await client.from("folders").select("id").limit(1)
      return !error
    } catch {
      return false
    }
  }

  // ── folders ──

  async function getFolders() {
    const { data, error } = await client
      .from("folders")
      .select("*")
      .order("name")
    if (error) throw error
    return data
  }

  async function createFolder(name) {
    const { data, error } = await client
      .from("folders")
      .insert({ name })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function deleteFolder(id) {
    const { error } = await client.from("folders").delete().eq("id", id)
    if (error) throw error
  }

  // ── playlists ──

  async function getPlaylists(folderId = null) {
    let q = client
      .from("playlists")
      .select("id, name, folder_id, game_tag, notes, created_at")
      .order("name")

    if (folderId !== null) {
      q = folderId === "none"
        ? q.is("folder_id", null)
        : q.eq("folder_id", folderId)
    }

    const { data, error } = await q
    if (error) throw error
    return data
  }

  async function getAllPlaylists() {
    const { data, error } = await client
      .from("playlists")
      .select("id, name, folder_id, game_tag, notes, created_at")
      .order("name")
    if (error) throw error
    return data
  }

  async function uploadPlaylist({ name, folderId, gameTag, notes, fileData }) {
    const { data, error } = await client
      .from("playlists")
      .insert({
        name,
        folder_id: folderId || null,
        game_tag: gameTag || null,
        notes: notes || null,
        file_data: fileData,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async function getPlaylistFile(id) {
    const { data, error } = await client
      .from("playlists")
      .select("file_data, name")
      .eq("id", id)
      .single()
    if (error) throw error
    return data
  }

  async function deletePlaylist(id) {
    const { error } = await client.from("playlists").delete().eq("id", id)
    if (error) throw error
  }

  return {
    init,
    ready,
    ping,
    getFolders,
    createFolder,
    deleteFolder,
    getPlaylists,
    getAllPlaylists,
    uploadPlaylist,
    getPlaylistFile,
    deletePlaylist,
  }
})()
