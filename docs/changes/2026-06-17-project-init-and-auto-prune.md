# 2026-06-17 Project Init And Auto Prune

## Goal

- Initialize the repository with basic project documentation.
- Add an agent workflow document for future collaboration.
- Fix the conversation sync issue by automatically deleting local records for removed conversations.

## Planned Changes

- Add `README.md` with project overview, features, install instructions, and data behavior notes.
- Add `AGENT.md` to document the repo workflow, including the rule to create a change note before code edits.
- Update `index.js` so conversation scans prune stale local records that no longer exist in the ChatGPT sidebar.

## Notes

- Auto-prune will only run when the page scan finds at least one conversation link, to reduce the chance of wiping local data before the sidebar loads.
