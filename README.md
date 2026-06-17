# ChatGPT Custom Category Plugin

This repository contains a userscript that adds local conversation categories to ChatGPT.

## What It Does

- Scans conversations from the ChatGPT sidebar
- Stores local category metadata with Tampermonkey or compatible userscript managers
- Lets you edit conversation title, category, note, and color
- Supports category color management
- Supports JSON export and import
- Opens a fixed floating manager instead of modifying the sidebar layout

## File Layout

- [index.js](/d:/gpt-category-plugin/index.js:1): Main userscript entry and all runtime logic
- [AGENT.md](/d:/gpt-category-plugin/AGENT.md:1): Collaboration workflow for future changes
- [docs/changes/2026-06-17-project-init-and-auto-prune.md](/d:/gpt-category-plugin/docs/changes/2026-06-17-project-init-and-auto-prune.md:1): Change note for the current update

## Usage

1. Install a userscript manager such as Tampermonkey.
2. Create a new script and paste the contents of `index.js`.
3. Open `https://chatgpt.com/` or `https://chat.openai.com/`.
4. Use the floating category button in the lower-left corner.

## Data Model

The script stores all category data locally through userscript storage.

- Categories are local-only.
- Notes and colors are local-only.
- Export and import operate on the local JSON structure.

## Sync Behavior

- The script scans visible conversations from the ChatGPT page.
- Missing local records are now removed automatically when a scan finds current sidebar conversations.
- If ChatGPT has not rendered any conversation links yet, auto-prune is skipped for safety.
