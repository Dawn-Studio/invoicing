# Invoicing by Dawn Studio

Local-first desktop invoicing app (Electron) plus its landing page (Astro), in one Turborepo.
See [PLAN.md](PLAN.md) for the architecture and roadmap.

## Requirements

- Node 26 (see `.nvmrc`; Astro needs ≥ 22.23) — `nvm install && nvm use`
- pnpm 10 (`packageManager` in `package.json`)

## Commands

| Command                     | What it does                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| `pnpm install`              | Install all workspace dependencies                                 |
| `pnpm dev:desktop`          | Run the Electron app with hot reload                               |
| `pnpm dev:web`              | Run the landing page at http://localhost:4321                      |
| `pnpm lint` / `pnpm format` | Biome check / apply fixes and formatting                           |
| `pnpm test`                 | Unit tests (`core` domain logic, `db` repositories against SQLite) |
| `pnpm typecheck`            | TypeScript across all packages (`astro check` for the site)        |
| `pnpm build`                | Build the app and the site                                         |
| `pnpm package:mac`          | Build `.dmg` files (arm64 + x64) into `apps/desktop/release`       |

## Layout

- `apps/desktop` — Electron app (`src/main`, `src/preload`, `src/renderer`, `src/shared`)
- `apps/web` — Astro landing page using the same components as React islands
- `packages/core` — domain logic shared by main and renderer: money, totals, numbering, snapshots, zod input schemas
- `packages/db` — SQLite schema (Drizzle), migrations and repositories; used only by the Electron main process
- `packages/ui` — shadcn/ui components, theme tokens (`src/styles/theme.css`), Motion presets
- `packages/config` — shared tsconfig presets

## Changing the database schema

Edit `packages/db/src/schema.ts`, then generate a migration and commit it:

```bash
pnpm --filter @dawnstudio/db db:generate --name describe_the_change
```

Migrations run automatically when the app starts. Development builds keep their data in
`~/Library/Application Support/Invoicing (Dev)`, separate from the installed app.

## Adding shadcn components

Run the wrapper, not the shadcn CLI directly:

```bash
pnpm --filter @dawnstudio/ui shadcn:add dialog
```

shadcn 4.x rewrites the `cn` import to a third-party npm package named `cn`; the wrapper fixes the
imports, removes that package and formats the result. Pass `-o` to let it overwrite existing
components that the new one depends on.

## macOS builds are unsigned

Until there is an Apple Developer ID, builds are ad-hoc signed and not notarized. On first launch,
right-click the app → Open (or System Settings → Privacy & Security → Open Anyway).
