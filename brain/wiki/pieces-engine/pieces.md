---
icon: 🧩
---

# Pieces

The metadata catalog of automation integrations ("pieces") — each a named integration like `@activepieces/piece-gmail` providing actions and triggers. Stored in `piece_metadata` and served from an in-memory `pieceCache` rebuilt from the DB on startup and refreshed via pub/sub.

### Entities & services
- `piece_metadata` (PieceMetadataEntity) — unique on `(name, version, platformId)`; `platformId` null = official, set = custom piece for that platform. `actions`/`triggers` are JSON maps (each may carry an optional `outputSchema`).
- `pieceMetadataService` — `list` / `getOrThrow` / `listVersions` / `create` / `delete` / `registry`; owns cache interactions.
- `pieceInstallService.installPiece` — saves archive, dispatches an `EXECUTE_METADATA` engine job to extract metadata, then stores it.
- `pieceSyncService.sync` — upserts official pieces from the bundled registry file.
- Routes under `/v1/pieces`: list, `:name` get, `:name/versions`, `POST /options` (dynamic dropdown eval on a worker), `POST /` (platformAdmin — install custom piece), `POST /sync`, `DELETE /:id`.

### Types
- **PieceType** — `OFFICIAL` (bundled) or `CUSTOM` (platform-installed).
- **PackageType** — `REGISTRY` (NPM) or `ARCHIVE` (uploaded tarball; `archiveId` FKs to `file`).
- **OutputSchema** — optional per-action/trigger structured render hint (`fields`, `itemLabel`); set by the piece author, consumed by the builder's Smart Output Viewer and data selector. Opt-in and non-breaking.

### Gotchas
- Available all editions; base listing + install is Community-level.
- On CE the `.tgz` upload is greyed out in `InstallPieceDialog`, but **the gate is frontend-only** — `disabled={!isEnabled || !privatePiecesEnabled}` in `install-piece-dialog.tsx`. `communityPiecesModule` is registered under `ApEdition.COMMUNITY` and `piece-install-service.ts` handles `PackageType.ARCHIVE` with no edition check, so `POST /v1/pieces` accepts an archive on CE. Useful for testing a custom piece against a stock image — no fork or custom build needed (`npm run build-piece <name>` produces the tarball).
- `ApFlagId.PRIVATE_PIECES_ENABLED` is **not** settable by env or DB. `flag.service.ts` hardcodes it to `system.getEdition() !== ApEdition.COMMUNITY` and `push`es it *after* the `flagRepo().findBy()` results; `flag.module.ts` reduces the array with last-wins spread, so any DB row you insert is overwritten.
- API keys are EE (`PrincipalType.SERVICE`), but install also accepts `PrincipalType.USER`, so on CE authenticate with a user JWT from `POST /v1/authentication/sign-in` (response carries `token`). Caller must be the platform owner (`platformAdminOnly`).
- Installing via `curl`: piece names are npm-scoped (`@activepieces/piece-x`), and a `-F` value starting with `@` makes curl treat it as a *filename* — you get `curl: (26) Failed to open/read local data` that looks like a broken archive but is actually the `pieceName` field. Use `--form-string` for every literal field and reserve `-F ...=@file` for `pieceArchive`.
- `NPM_REGISTRY_URL` in `piece-bundle.ts` is hardcoded to `https://registry.npmjs.org` — there is no private-registry config, so `PackageType.REGISTRY` only resolves public npm packages.
- EE/Cloud per-piece and per-action/trigger visibility flows through `resolveVisibility` (`ee/pieces/filters/piece-filtering-utils.ts`), which returns a `VisibilityPolicy` or `null` on CE / when `platformId`/`projectId` is nil (callers treat `null` as no filtering). The policy is derived from the project's **piece set** (via `project.pieceSetId`, falling back to the platform Default).
- Install and sync also enqueue a tool-search reindex, but only when `isToolSearchEnabled()`; no-op otherwise.
- `delete` removes all versions sharing the name on that platform, and only for `CUSTOM` pieces the caller owns.
- `npm run build-piece <name>` prunes `dist/` down to the manifest `files` allow-list (`pruneDistToPublishedFiles` in `packages/cli/src/lib/utils/prepare-piece-utils.ts`), which is rewritten to `[bundle, package.json, src/i18n]` — anything else in the piece folder is deleted before `npm pack`. `README.md` is copied in and kept explicitly; without that a piece published to npm shows an empty package page, because the allow-list wins over npm's "always include the README" behaviour when the file simply isn't there.
- `npm pack --json` changed output shape in **npm 12**: an array of results up to npm 11, a map keyed by package name from npm 12 on. `buildPiece` (`packages/cli/src/lib/utils/piece-utils.ts`) reads the tarball name through `readPackedTarballName`, which accepts both. Publish workflows that run `npm install -g npm@latest` pick the new npm up silently, so this fails in CI while a local build on the repo's older npm still passes.

### Key files
Entry point: `pieceModule`, the Fastify plugin registered in `packages/server/api/src/app/app.ts` that mounts every `/v1/pieces` route.

- `packages/server/api/src/app/pieces/metadata/` — controller, service, TypeORM entity, and the pub/sub-invalidated `piece-cache.ts`
- `packages/server/api/src/app/pieces/` — `community-piece-module.ts` (POST `/v1/pieces` install), `piece-install-service.ts`, `piece-sync-service.ts`
- `packages/server/api/src/app/ee/pieces/filters/piece-filtering-utils.ts` — `resolveVisibility` and the EE/Cloud `VisibilityPolicy`
- `packages/web/src/features/pieces/api/` — frontend HTTP client
- `packages/web/src/features/pieces/hooks/` — React Query hooks for listing, piece model, options, and output schema
- `packages/web/src/features/pieces/components/` — `PieceIcon`, `PieceIconList`, `PieceSelectorSearch`, `InstallPieceDialog`
- `packages/pieces/framework/src/lib/output-schema.ts` — `OutputSchema` / `OutputSchemaField` / `FieldFormat` types

Paths verified 2026-07-17.
