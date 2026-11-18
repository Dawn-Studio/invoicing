# Invoicing — Implementation Plan

A local-first desktop app for creating, branding, storing and sending invoices.
macOS is the primary platform, then Windows, then Linux. A marketing site ships alongside it and uses the same UI components.

- **App ID:** `com.dawnstudio.invoicing`
- **Product name:** Invoicing (by Dawn Studio)
- **Workspace package scope:** `@dawnstudio/*` (e.g. `@dawnstudio/ui`, `@dawnstudio/core`)

## Stack

| Concern       | Choice                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Monorepo      | pnpm workspaces + Turborepo                                                              |
| Language      | TypeScript (strict)                                                                      |
| Lint / format | Biome (single root config)                                                               |
| Desktop       | Electron via electron-vite; packaged with electron-builder; updates via electron-updater |
| UI            | React, shadcn/ui on Tailwind v4, Motion (motion.dev)                                     |
| Storage       | SQLite via better-sqlite3 + Drizzle ORM (schema, migrations), main process only          |
| Validation    | zod at every boundary (IPC, imports, integrations)                                       |
| Landing page  | Astro + `@astrojs/react`, consuming `packages/ui` as React islands                       |
| Tests         | Vitest (unit, mainly `core`); Playwright for Electron e2e later                          |

## Repository layout

```
invoicing/
├─ apps/
│  ├─ desktop/               # Electron app
│  │  ├─ src/main/           # DB, IPC handlers, PDF rendering, integrations runtime, secrets
│  │  ├─ src/preload/        # contextBridge: exposes the typed API only
│  │  ├─ src/renderer/       # React app
│  │  └─ src/shared/         # IPC contract types shared by main/preload/renderer
│  └─ web/                   # Astro landing page
├─ packages/
│  ├─ ui/                    # shadcn components, theme tokens, Motion presets
│  ├─ core/                  # pure domain logic: money, totals, tax, numbering, snapshots
│  ├─ db/                    # Drizzle schema, migrations, repositories
│  ├─ invoice-templates/     # React invoice layouts (live preview AND PDF)
│  ├─ integrations/          # (future) provider interface + providers (email, Slack, Stripe, ...)
│  └─ config/                # shared tsconfig
├─ biome.json
├─ turbo.json
└─ pnpm-workspace.yaml
```

`packages/core` has no Electron/Node dependencies, so it is trivially testable and reusable (e.g. a future server or sync service).

## Architecture principles

1. **Main process owns data and secrets.** The renderer is sandboxed (`contextIsolation: true`, `sandbox: true`, no `nodeIntegration`) and calls a typed API exposed by preload. Every IPC payload is validated with zod in main.
2. **Snapshots on issued invoices.** Drafts reference live records (client, profile, payment account). Issuing an invoice writes an immutable JSON snapshot of issuer details, client details, payment account, line items, tax, totals and branding/template version. Issued invoices are read-only; corrections happen by voiding (and, later, credit notes). Rendering an issued invoice reads only from its snapshot.
3. **Money is integers.** Amounts are stored in minor units with an ISO 4217 currency code; currency exponent (0/2/3 decimals) comes from `core`. Quantities are stored as integer thousandths (1.5 h → 1500). All rounding rules live in `core` and are unit-tested.
4. **Numbers are assigned at issue time**, not when a draft is created, so deleting drafts never leaves gaps. Pattern is configurable, e.g. `INV-{YYYY}-{SEQ:4}`.
5. **One template source.** Invoice templates are React components rendered both in the live preview and, through a hidden window + `webContents.printToPDF`, into the PDF — identical output, shared styling.
6. **Sync-ready IDs.** UUIDv7 primary keys, `createdAt`/`updatedAt` on every row, soft-delete (`archivedAt`) for clients.
7. **Append-only activity log.** Every meaningful action (created, issued, PDF exported, sent via Slack, payment link created, paid, voided) is an `invoice_events` row. This becomes the invoice timeline in the UI and the hook point for integrations.

## Integrations (future — not in current scope)

Integrations are **not being built now**. The architecture must leave room for them so they can be added later without reworking invoices. Today that only means: the `invoice_events` log exists (it also powers the invoice timeline), all side effects go through main, and issued invoices are rendered from their snapshot. Everything below is the target design for when the time comes.

Future integrations (Slack, email, Stripe payment links, more later) plug into one framework so adding a new one does not touch the invoice code.

### Provider model

Each provider lives in `packages/integrations/<provider>` and implements:

```ts
interface IntegrationProvider<Config, Secrets> {
	id: string; // "slack", "email-smtp", "stripe"
	name: string;
	capabilities: Capability[]; // "deliver" | "payment-link" | "payment-status"
	configSchema: ZodType<Config>; // non-secret settings, stored in SQLite
	secretsSchema: ZodType<Secrets>; // tokens/keys, stored in the OS keychain
	connect(input): Promise<Connection>;
	test(connection): Promise<HealthCheck>;
	// capability-specific methods:
	deliver?(ctx: DeliveryContext): Promise<DeliveryResult>; // send PDF + message
	createPaymentLink?(ctx: PaymentContext): Promise<PaymentLink>;
	syncPaymentStatus?(ctx: PaymentContext): Promise<PaymentStatus>;
}
```

- **Capabilities, not providers, drive the UI.** The invoice "Send" menu lists every connected provider with `deliver`; the "Payment link" button appears when any provider has `payment-link`. Slack and email are just two delivery channels.
- **Runs in main only.** The renderer asks main to "deliver invoice X via connection Y with message Z"; main loads the snapshot, renders the PDF, calls the provider, and records an `invoice_events` row with the result.
- **Secrets never touch SQLite in plaintext.** Tokens/API keys are encrypted with Electron `safeStorage` (macOS Keychain / Windows DPAPI / libsecret); SQLite stores only a reference.
- **Delivery templates.** Per-channel message templates with variables (`{client.name}`, `{invoice.number}`, `{invoice.total}`, `{invoice.dueDate}`, `{paymentLink}`).

### Constraints to know up front

- **No backend needed initially.** Start with paste-a-key auth: Stripe restricted API key, Slack bot token (needs `chat:write` + `files:write` to upload the PDF), SMTP or an email API key (Resend/Postmark). Proper OAuth "Connect" buttons for Slack/Stripe require a client secret, so they need a tiny token-exchange backend later.
- **Stripe payment status.** A desktop app cannot receive webhooks, so payment status is pulled (on app start, on opening an invoice, and on a periodic timer) rather than pushed. A backend would make this real-time later.
- **Email without an integration.** `mailto:` cannot attach files; the zero-setup fallback is "Export PDF + open a pre-filled draft" (macOS: share sheet / Mail via AppleScript).

### First integrations (in order)

1. Email (SMTP + one email API provider)
2. Stripe payment links (+ status sync; marks invoice paid automatically)
3. Slack (channel or DM, PDF upload + message)

## Data model (initial)

Each **workspace** (a separate business: its own issuer details, clients, invoices and numbering) is its own SQLite file with the tables below. `userData/workspaces.json` lists the workspaces and the open one; the main process swaps the open database when the user switches. The first workspace adopted the original `invoicing.db` in place; new ones live in `userData/workspaces/<id>.db`. Logos are shared (content-addressed) across workspaces.

| Table                     | Purpose / key columns                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `business_profile`        | name, legal name, address, tax ID, email, phone, logo path, default currency, numbering pattern, next sequence, branding (accent, font, template)                                                          |
| `payment_accounts`        | label, currency, details (IBAN/SWIFT/account fields as JSON), isDefault                                                                                                                                    |
| `clients`                 | name, contact person, email(s), address, tax ID, default currency, default payment terms, notes, archivedAt                                                                                                |
| `tax_rates`               | name, rate (basis points), invoice note, isDefault — optional, generic (no jurisdiction-specific rules); invoices default to no tax                                                                        |
| `invoices`                | number (null until issued), status, clientId, paymentAccountId, currency, issueDate, dueDate, notes, terms, subtotal/tax/total (minor units), snapshot (JSON, null for drafts), issuedAt, paidAt, voidedAt |
| `invoice_items`           | invoiceId, position, description, quantity (thousandths), unitPrice (minor), taxRateId / rate                                                                                                              |
| `invoice_events`          | invoiceId, type, payload (JSON), createdAt — append-only                                                                                                                                                   |
| `integration_connections` | _(future)_ provider, label, config (JSON, non-secret), secretRef, status, lastCheckedAt                                                                                                                    |
| `settings`                | key / value                                                                                                                                                                                                |

Invoice statuses: `draft → issued → paid`, plus `void`; `overdue` is derived from `dueDate`, not stored.

## Phases

### Phase 0 — Foundations ✅ (2026-11-04)

- pnpm workspace, Turborepo pipelines (`dev`, `build`, `typecheck`, `lint`, `test`), Biome, shared tsconfig
- `packages/ui`: Tailwind v4, theme tokens (`packages/ui/src/styles/theme.css`), shadcn configured for monorepo, Motion presets, light/dark
- `apps/desktop`: electron-vite shell with secure defaults, app layout (sidebar + content), dark mode following the OS
- `apps/web`: Astro skeleton rendering a `ui` component as an island
- **Package an unsigned macOS build now** to flush out native-module (better-sqlite3) issues early
- GitHub Actions: lint + typecheck + test

**Done when:** `pnpm dev` runs both apps with the same look, and a `.dmg` launches.

### Phase 1 — Data layer & domain core ✅ (2026-11-17)

- Drizzle schema + migrations, run on app start; DB in `app.getPath('userData')` (`Invoicing (Dev)` when unpackaged)
- Typed IPC contract + zod validation; repository layer
- `core`: money, currency exponents, line/tax/discount totals, numbering, snapshot builder — fully unit-tested
- `invoice_events` append-only log

**Done when:** `core` tests pass; renderer can read/write through IPC.

Notes from implementation:

- better-sqlite3 13 ships Node-API prebuilds for every platform, so no Electron rebuild step is needed; the package keeps only the target platform's binary.
- Rounding: each line rounds once (half away from zero); the invoice discount is spread over positive lines (largest remainder); tax is computed once per rate on the discounted base.
- Invoice numbers are assigned at issue time inside one transaction with the sequence bump; a clash returns `CONFLICT` and nothing changes.
- Tax-rate notes (e.g. exemption notices) are copied into the snapshot as `taxNotes`.
- The UI proof ("save the business name from Settings") was replaced by an end-to-end IPC check against the built and packaged app, since UI waits for design references.
- For the editor (Phase 3): picking a client on an existing draft should re-apply that client's currency, payment terms and matching payment account in the UI.

### Phase 2 — Business profile & clients ✅ (2026-11-17)

> UI follows the user's references: recessed panel headers over lighter rounded bodies, label/value rows, mono status labels, currency tags. Shared pieces live in `packages/ui` (`panel.tsx`, `amount.tsx`).

- First-run onboarding: business details, logo, default currency, numbering pattern, payment accounts (tax rates optional, in settings)
- Clients: list, search, create/edit, archive

**Done when:** you never have to retype your or a client's details.

### Phase 3 — Invoice editor ✅ (2026-11-18)

- Pick client (prefills currency, terms, payment account), line items (reorder, quantity, rate, tax), discount, notes, dates
- Drafts autosave; live preview beside the form
- Issue: assigns number, writes snapshot, locks invoice

**Done when:** you can create and issue a real invoice.

### Phase 4 — Branding & PDF (MVP)

- Templates in `invoice-templates`; accent colour, logo, font choices
- PDF export via `printToPDF`; save dialog, reveal in Finder, default export folder

**Done when:** this replaces the Wise generator for your own invoices.

### Phase 5 — Invoice management

- Invoice list with filters (status, client, date, currency), search
- Mark paid / void, duplicate invoice, overdue indicators, invoice timeline from `invoice_events`
- Dashboard: outstanding by currency, paid this month, revenue per client

### Phase 6 — Distribution

- macOS builds (`.dmg`, arm64 + x64) **ad-hoc signed, not notarized** — no Apple Developer account yet. First launch needs right-click → Open (or System Settings → Privacy & Security → Open Anyway); documented on the download page
- Windows (NSIS, unsigned — SmartScreen warning) and Linux (AppImage/deb) builds
- Releases published to GitHub Releases from CI
- Automatic DB backups, manual export/import
- Auto-update: Windows/Linux via electron-updater; **macOS auto-update is blocked until the app is signed** (Squirrel.Mac rejects unsigned updates), so macOS shows an "update available" link instead

### Phase 7 — Landing page

- Content, real screenshots, feature sections with Motion, download links pointing at releases

### Later

- **Apple Developer account** → Developer ID signing + notarization, macOS auto-update
- **Integrations** (see the Integrations section): email → Stripe payment links → Slack
- Recurring invoices, credit notes, quotes/estimates, multiple businesses, jurisdiction-specific tax (VAT, reverse charge), cloud sync

## Open questions

- **Workflow write-up** → to be merged into the phases above
- **Landing page domain**
