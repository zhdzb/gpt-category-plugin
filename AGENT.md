# AGENT.md

This project currently uses a lightweight single-file userscript structure.

## Working Rules

Before making code changes:

1. Create a new change note under `docs/changes/`.
2. Write the goal, planned changes, and any safety notes in that file.
3. Only then edit code or project docs.

## Repo Intent

- Keep the script easy to copy into a userscript manager.
- Prefer simple, dependency-free browser logic.
- Preserve local-only behavior unless a future task explicitly changes that scope.

## Change Guidance

- Keep DOM queries defensive because the ChatGPT UI can change.
- Avoid destructive data cleanup unless the behavior is intentional and documented.
- When changing sync logic, consider partial sidebar loading and delayed page rendering.
