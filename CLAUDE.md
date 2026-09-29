# Tidepool

API (NestJS, repo root) + web app (Vue, `web/`). Project docs are an Obsidian
vault in `docs/` — start at `docs/Home.md`.

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
