# kovaaks-manager

Self-hosted KovaaK's / Aimbeast playlist manager backed by Supabase. Organize playlists and scenarios into folders, pin favorites, build timed routines, and track sensitivity.

## Setup

1. Create a free [Supabase](https://supabase.com) project.
2. Open **SQL Editor** and run the table setup from the Settings tab in the app (it's all there, copy-paste ready). If you already have the tables from an older version, run the `alter table ... add column if not exists ...` block underneath it too — it's safe to run more than once and won't touch your data. **Updating from an older copy:** scenario folders are new, so also run the `create table if not exists scenario_folders` block plus the `folder_id` line in the alter block — both are in the same Settings guide.
3. Paste your Project URL and anon key into Settings and hit Save & Connect.

## Features

- Folders for playlists, scenarios, and Aimbeast playlists, with drag-and-drop reordering — drag a folder to move it up/down, drag an item onto a different folder to move it there, drag within a folder to reorder
- Pin any playlist/scenario as a favorite (gold star) — pinning is just a visual flag now, it doesn't force a sort order, so it won't fight with your manual ordering
- Rename folders inline
- Scenario library with folders (just like playlists), bulk add with an optional folder, drag-to-reorder cards
- "Add playlist" lives as a button/modal inside the Playlists tab instead of its own nav tab
- Appearance settings: accent color presets + a panel-transparency slider, saved locally in your browser
- Routine builder with a countdown timer and sound cues
- Sensitivity tracker + eDPI / cm-per-360 calculator
- Export/import your whole library as a `.zip`

Everything lives in your own Supabase project — this is a static site with no backend of its own.
