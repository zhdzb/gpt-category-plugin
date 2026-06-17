# 2026-06-17 Draggable Launcher Button

## Goal

- Let the floating launcher button be dragged to any position on screen.
- Persist the launcher position locally so it stays where the user left it.

## Planned Changes

- Add launcher position fields to local UI state.
- Apply saved position when rendering the launcher.
- Add pointer-based dragging with viewport bounds protection.

## Notes

- Dragging should not trigger the launcher click action.
- Default placement should remain the current lower-left position until the user moves it.
