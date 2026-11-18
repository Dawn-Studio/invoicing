# Invoicing — features, user paths and epics

The product definition behind `PLAN.md`. Epics are the units that go into Linear (project **Invoicing**). Each epic lists its features; each feature becomes an issue under the epic.

_Last updated 2026-11-17._

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

### E2 · Clients ✅

Never retype a client's details.

- ✅ Client list with search and archived filter
- ✅ Client create / edit / archive / restore
- ✅ Billing defaults: currency, payment terms, private notes
- ✅ Client overview: outstanding, billed, paid and overdue per currency; invoice count and last invoice date
- ✅ Client's invoice list with Open / Overdue / Paid / Void status (rows link to invoices once E3 adds the invoice page)
- ✅ Other contacts per client (name + email), to be CC'd on invoice emails (E6)
- ✅ Import clients from CSV: comma/semicolon/tab, common header names, per-row errors, existing names skipped

### E3 · Invoice editor ⬜

Create a correct invoice quickly with a live preview.

- ⬜ New draft: pick client → prefills currency, terms, payment account
- ⬜ Line items: add, remove, reorder (drag), description, quantity, unit, rate, tax rate
- ⬜ Invoice-level discount (amount or percent), notes, terms, issue/due dates
- ⬜ Totals panel: subtotal, discount, tax summary per rate, total
- ⬜ Autosave drafts; unsaved/validation states
- ⬜ Live preview beside the form (same template as the PDF)
- ⬜ Saved items catalog (services/products with default rate) for quick insert
- ⬜ Timesheet lines: hours × rate, paste or import hours (CSV)

### E4 · Issuing & invoice lifecycle ⬜

Issued invoices are legal documents: numbered, frozen, auditable.

- ⬜ Issue flow: confirm dialog, assign number, write snapshot, lock
- ⬜ Read-only issued invoice view rendered from the snapshot
- ⬜ Record payments (full and partial, date, method, note); balance due
- ⬜ Mark unpaid / undo payment
- ⬜ Void with reason
- ⬜ Duplicate (any status) into a new draft
- ⬜ Activity timeline from `invoice_events`
- 🔮 Credit notes linked to the original invoice

### E5 · Branding, templates & PDF ⬜

Invoices that look like your studio, identical on screen and in the PDF.

- ⬜ `packages/invoice-templates` with 2–3 templates (React, shared by preview and PDF)
- ⬜ Branding settings: accent colour, font, template, logo placement, footer text
- ⬜ PDF export via hidden window + `printToPDF`; A4 / Letter
- ⬜ Save dialog, default export folder, file name pattern, reveal in Finder
- ⬜ Snapshot stores the branding/template version so old invoices never change
- ⬜ Print

### E6 · Sending & sharing ⬜

Get the invoice to the client with as little friction as possible, without integrations.

- ⬜ "Send" action: export PDF + open a pre-filled email (macOS Mail / share sheet, Windows/Linux fallback)
- ⬜ Email message templates with variables (`{client.name}`, `{invoice.number}`, `{invoice.total}`, `{invoice.dueDate}`)
- ⬜ Copy invoice summary to clipboard
- ⬜ Record "sent" in the timeline; reminders for overdue invoices use the same flow

### E7 · Invoice management ⬜

Find any invoice and know its state at a glance.

- ⬜ Invoice list: status, client, number, dates, amount, currency
- ⬜ Filters (status, client, period, currency) and search (number, client, line text)
- ⬜ Overdue derived from due date, with "due in N days" / "N days overdue" labels
- ⬜ Bulk actions: export PDFs, mark paid
- ⬜ Keyboard navigation and quick actions from the list

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

- ✅ Sidebar layout, light/dark following the OS, reference-style panels
- ⬜ Command palette (⌘K): jump to client/invoice, create new
- ⬜ Keyboard shortcuts (⌘N new invoice, ⌘E export, ⌘, settings)
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
- 🔮 Multiple businesses
- 🔮 Jurisdiction-specific tax (VAT, reverse charge)
- 🔮 Cloud sync

## Suggested order

E3 → E4 → E5 → E6 → E7 → E8 → E9 → E10 (polish alongside) → E11 → E12. E13 and E14 later.
