# Invoicing — features, user paths and epics

The product definition behind `PLAN.md`. Epics are the units that go into Linear (project **Invoicing**). Each epic lists its features; each feature becomes an issue under the epic.

_Last updated 2026-11-18._

Status: ✅ done · 🟡 partly done · ⬜ not started · 🔮 later (needs a signed app, a backend or a decision)

## User paths (the ideal app)

1. **First invoice in five minutes.** Install → open (unsigned first-launch steps) → set up the business (name, address, logo, currency, numbering, bank account) → add a client → create an invoice → add lines → preview → issue → export PDF → send → mark paid when the money arrives.
2. **Monthly repeat.** Open a client → "New invoice from last" → adjust hours/quantities (or paste a timesheet) → issue → send. Under a minute.
3. **Getting paid / chasing.** Dashboard shows what is outstanding and overdue, per currency → open an overdue invoice → send a reminder → record the payment (full or partial) → the invoice moves to Paid.
4. **Fixing a mistake.** Issued invoices are locked → void it (with a reason) or issue a credit note → duplicate as a draft → correct → reissue. The timeline shows what happened.
5. **Month / year end.** Filter invoices by period → see totals, tax per rate and revenue per client → export CSV + a zip of the PDFs for the accountant.
6. **Rebranding.** Change logo, accent colour, font or template → the preview updates. Drafts use the new look; issued invoices keep the look they were issued with.
7. **New computer / safety.** Automatic backups run in the background → export a backup → install on a new machine → import → everything is back, numbering continues.
8. **Staying up to date.** The app checks for updates → Windows/Linux update in place, macOS shows a download link until signed.
9. **Discovering the app.** Landing page → screenshots and features → download for your platform → first-launch instructions.

## Epics

### E1 · Onboarding & business profile ✅

Set up once, never retype your own details.

- ✅ Two-step welcome: business details, then payment account
- ✅ Business profile: legal name, address, tax ID, email, phone, default currency, payment terms
- ✅ Invoice numbering pattern with a live "next number" preview
- ✅ Logo upload (PNG, JPG, WebP, SVG ≤ 2 MB) in settings and setup step 2; files are content-addressed and never deleted, so issued invoices keep their logo
- 🔮 Logo crop and a separate dark-background variant
- ✅ Payment accounts: add, edit, default, archive
- ✅ Tax rates: add, edit, default, archive (generic, no jurisdiction)
- ✅ Workspaces (like Linear): one per business, e.g. Personal and a company. Each is its own database file with its own profile (the issuer on its invoices), clients, invoices, accounts, tax rates and numbering. Switcher at the top of the sidebar; create, rename, delete (file goes to the Trash). The pre-workspace database became the first workspace, unmoved

### E2 · Clients ✅

Never retype a client's details.

- ✅ Client list with search and archived filter
- ✅ Client create / edit / archive / restore
- ✅ Billing defaults: currency, payment terms, private notes
- ✅ Client overview: outstanding, billed, paid and overdue per currency; invoice count and last invoice date
- ✅ Client's invoice list with Open / Overdue / Paid / Void status (rows link to invoices once E3 adds the invoice page)
- ✅ Other contacts per client (name + email), to be CC'd on invoice emails (E6)
- ✅ Import clients from CSV: comma/semicolon/tab, common header names, per-row errors, existing names skipped

### E3 · Invoice editor ✅

Create a correct invoice quickly with a live preview.

- ✅ New draft (from Invoices or a client page): pick client → prefills currency, terms, payment account; changing client or currency re-applies them
- ✅ Line items: add, remove, reorder (drag), description, quantity, unit, rate, tax rate
- ✅ Invoice-level discount (amount or percent), notes, terms, issue/due dates (moving the issue date keeps the terms)
- ✅ Totals panel: subtotal, discount, tax summary per rate, total
- ✅ Autosave drafts (0.6 s after typing, and on leaving); Saved / Saving / Not saved states; fields that don't parse are highlighted and block saving
- ✅ Live preview beside the form, from `@dawnstudio/invoice-templates` (the same component the PDF will use)
- ✅ Saved items catalog: Items page (search, edit, archive) with description, unit, rate, currency and tax; "From items" in the editor fills a line (rate only carries over in the same currency); bookmark button saves a line as an item
- 🔮 Timesheet lines: paste or import tracked hours (CSV). Postponed (2026-11-18): not needed for now

### E4 · Issuing & invoice lifecycle ✅

Issued invoices are legal documents: numbered, frozen, auditable.

- ✅ Issue flow: confirm dialog (or a list of what's missing), assign number, write snapshot, lock
- ✅ Read-only issued invoice view rendered from the snapshot (with the logo it was issued with); "Void" stamp on voided invoices
- ✅ Record payments (full and partial, date, method, note); balance due; "Partly paid" status; client totals count part payments. Invoices marked paid before this got one full payment in the migration
- ✅ Mark as paid today (one payment for the balance); remove a payment to undo it (a paid invoice reopens)
- ✅ Void with an optional reason (only without payments; the number is never reused)
- ✅ Duplicate (any status) into a new draft; delete drafts
- ✅ Activity timeline from `invoice_events`
- 🔮 Credit notes linked to the original invoice

### E5 · Branding, templates & PDF ✅

Invoices that look like your studio, identical on screen and in the PDF.

- ✅ `packages/invoice-templates`: Classic, Modern and Minimal (React, shared by the live preview and the PDF); shared parts in `parts.tsx`
- ✅ Branding settings: template cards with live previews of your invoice, accent colour (swatches + any hex), font (sans / serif / mono), logo left or right, footer text
- ✅ PDF export via a hidden window on the `/print/:id` route + `printToPDF`; A4 / Letter (paper size is part of branding)
- ✅ Save dialog opening in the last-used folder (or one set in Settings), file name pattern (`{number} {client}`, `{date}`), "Show in Finder" after saving, "Exported …" in the activity
- ✅ Snapshot stores the branding (template id, colour, font, paper, footer); older snapshots get defaults for newer fields; template ids are never reshaped, new looks get new ids
- ✅ Print… (system print dialog, same rendering as the PDF)

### E6 · Sending & sharing ✅

Get the invoice to the client with as little friction as possible, without integrations.

- ✅ "Send" action: PDF written to an outbox, then an Apple Mail draft with it attached (macOS, via AppleScript; needs the Automation permission once) or the default email app via mailto (all platforms) with the PDF shown in the file manager. To = client email, CC = the client's other contacts (toggle each)
- ✅ Email templates in Settings (invoice and payment reminder) with variables `{client.name}`, `{client.contact}`, `{invoice.number}`, `{invoice.total}`, `{invoice.balance}`, `{invoice.dueDate}`, `{business.name}`
- ✅ Copy invoice summary to clipboard (number, amount, due date, payment details)
- ✅ "Mark as sent" after the email opens records it in the activity (the app can't see the email client); overdue invoices get "Send reminder" with the reminder template

### E7 · Invoice management ✅

Find any invoice and know its state at a glance.

- ✅ Invoice list: status, client, number, dates, amount, currency; outstanding total per currency for the current view
- ✅ Status tabs with counts (All, Drafts, Open, Overdue, Paid, Void), filters for client, period (this/last month, quarter, year) and currency, search by number, client or line item text; filters live in the URL so Back keeps them
- ✅ Overdue derived from due date, with "due in N days" / "N days overdue" labels
- ✅ Bulk actions with a selection bar: mark paid today, export PDFs to a folder (drafts skipped, existing files never overwritten)
- ✅ Keyboard (TanStack Hotkeys, `lib/hotkeys.ts`): J/K or arrows, Enter open, X select, ⌘A all, Esc clear, / search, P mark paid, E export; global C new invoice, G then D/I/C/T to navigate, ⌘, settings, ? shortcuts sheet

### E8 · Dashboard & reports ⬜

Know how the business is doing without a spreadsheet.

- ⬜ Outstanding and overdue, per currency
- ⬜ Paid this month / year, revenue per month chart
- ⬜ Revenue per client
- ⬜ Tax summary per rate for a period
- ⬜ Export CSV (invoices, payments, line items) and a zip of PDFs for a period

### E9 · Data safety & portability ⬜

Local-first means the user's data must never be lost.

- ⬜ Automatic SQLite backups (rotating, on quit and daily)
- ⬜ Manual backup export / import (restore) with a confirmation
- ⬜ Show the data folder; open in Finder
- ⬜ Migration safety: back up before running migrations
- 🔮 Encrypted backups

### E10 · App shell & experience 🟡

A fast, keyboard-friendly, native-feeling desktop app.

- ✅ Sidebar layout, light/dark following the OS
- ✅ Redesign: own brand (lime #8FFF4A, Be Vietnam Pro, rounded buttons; the user rejected pill buttons) on a Linear-inspired layout; glass sidebar (macOS vibrancy, Windows 11 acrylic), blurred sticky header and overlays, inset content card, status icons, Lucide icons throughout, "New invoice" button in the sidebar
- ⬜ Command palette (⌘K): jump to client/invoice, create new
- 🟡 Keyboard shortcuts: app-wide set and `?` sheet done (see E7); editor shortcuts still to add
- ⬜ Native menus (macOS app menu, Windows/Linux menu bar)
- ⬜ Theme override (system / light / dark) in settings
- ⬜ App icon and window polish (traffic lights, titlebar drag areas)
- ⬜ Empty states, loading and error states across screens

### E11 · Distribution & updates 🟡

Installable on macOS, Windows and Linux without an Apple Developer account.

- ✅ Unsigned macOS `.dmg` (arm64)
- ⬜ macOS x64 / universal build
- ⬜ Windows NSIS build (unsigned) and Linux AppImage/deb
- ⬜ Release pipeline: build on tag, publish to GitHub Releases
- ⬜ Auto-update on Windows/Linux; "update available" link on macOS
- 🔮 Developer ID signing + notarization, macOS auto-update

### E12 · Landing page ⬜

- ⬜ Hero, feature sections with Motion, real screenshots
- ⬜ Download page with per-platform links from GitHub Releases and first-launch instructions
- ⬜ Domain, SEO, Open Graph images
- ⬜ Changelog page

### E13 · Integrations 🔮

Not in current scope; the architecture leaves room (event log, main-process side effects, snapshots).

- 🔮 Integration framework: provider interface, connections, secrets in OS keychain
- 🔮 Email delivery (SMTP + one email API)
- 🔮 Stripe payment links + payment status sync
- 🔮 Slack delivery (channel/DM, PDF upload)

### E14 · More document types 🔮

- 🔮 Quotes / estimates → convert to invoice
- 🔮 Recurring invoices (schedule, auto-draft)
- ✅ Multiple businesses → workspaces (E1)
- 🔮 Jurisdiction-specific tax (VAT, reverse charge)
- 🔮 Cloud sync

## Suggested order

E3 → E4 → E5 → E6 → E7 → E8 → E9 → E10 (polish alongside) → E11 → E12. E13 and E14 later.
