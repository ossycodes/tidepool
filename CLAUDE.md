# Tidepool

API (NestJS, repo root) + web app (Vue, `web/`). Project docs are an Obsidian
vault in `docs/` — start at `docs/Home.md`.

## Resuming work

When starting a session, resuming work, or after the context is compacted,
read these before continuing so you work from the recorded state rather than
a summary:

- `docs/Home.md`: the map of the vault
- `docs/Changelog.md`: what has shipped, newest first
- `docs/Tracker.base` (Roadmap view) and the notes in `docs/Features/`: what's
  planned, in progress, and known tech debt
- `docs/Decisions.md`: why things are built the way they are

## Keep the docs current

After a PR merges:

- Add a row to `docs/Changelog.md`.
- Set the matching note in `docs/Features/` to `status: shipped` with `pr` and
  `shipped` (create the note if it's new). The tracker (`docs/Tracker.base`)
  reads these properties.
- Record surprising choices in `docs/Decisions.md`.
- Update `docs/API.md` / `docs/Data model.md` when endpoints or the schema change.

## Workflow

- One PR per feature, opened against `main`, merged with merge commits.
  Never base a PR on another PR's branch (GitHub stacks block merging).
- Run `npx prisma generate` after `prisma migrate dev`.
- See `docs/Runbooks/Local development.md` for setup and gotchas.
