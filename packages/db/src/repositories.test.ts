import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DomainError, type ProfileInput } from "@dawnstudio/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type OpenedDatabase, openDatabase } from "./database";
import { createRepositories, type Repositories } from "./repositories";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

const profileInput: ProfileInput = {
	name: "Dawn Studio",
	email: "hello@dawn.studio",
	defaultCurrency: "EUR",
	paymentTermsDays: 14,
	numberPattern: "INV-{YYYY}-{SEQ:4}",
};

let database: OpenedDatabase;
let repos: Repositories;
let clock: number;

beforeEach(() => {
	database = openDatabase({ file: ":memory:", migrationsFolder });
	clock = 1_800_000_000_000;
	repos = createRepositories(database.db, { now: () => clock++, today: () => "2026-11-17" });
});

afterEach(() => database.close());

const expectDomainError = (fn: () => unknown, code: DomainError["code"]) => {
	try {
		fn();
	} catch (error) {
		expect(error).toBeInstanceOf(DomainError);
		expect((error as DomainError).code).toBe(code);
		return;
	}
	throw new Error(`Expected a ${code} error`);
};

describe("profile", () => {
	it("is empty until saved, then updates in place", () => {
		expect(repos.profile.get()).toBeNull();
		const created = repos.profile.save(profileInput);
		expect(created).toMatchObject({ name: "Dawn Studio", nextSequence: 1, logoFile: null });
		const updated = repos.profile.save({ ...profileInput, name: "Dawn Studio Lda" });
		expect(updated.id).toBe(created.id);
		expect(repos.profile.get()?.name).toBe("Dawn Studio Lda");
	});

	it("validates input", () => {
		expect(() => repos.profile.save({ ...profileInput, numberPattern: "INV" })).toThrow(/SEQ/);
		expect(() => repos.profile.save({ ...profileInput, defaultCurrency: "ABC" })).toThrow(
			/currency/,
		);
	});
});

describe("clients", () => {
	it("creates, searches, updates and archives", () => {
		const acme = repos.clients.create({
			name: "Acme",
			email: "billing@acme.test",
			currency: "usd",
		});
		repos.clients.create({ name: "beta 100% Corp", contactName: "Jane" });
		expect(acme.currency).toBe("USD");

		expect(repos.clients.list().map((c) => c.name)).toEqual(["Acme", "beta 100% Corp"]);
		expect(repos.clients.list({ search: "jane" }).map((c) => c.name)).toEqual(["beta 100% Corp"]);
		expect(repos.clients.list({ search: "100%" })).toHaveLength(1);
		expect(repos.clients.list({ search: "_" })).toHaveLength(0);

		repos.clients.update(acme.id, { name: "Acme Inc" });
		repos.clients.archive(acme.id);
		expect(repos.clients.list().map((c) => c.name)).toEqual(["beta 100% Corp"]);
		expect(repos.clients.list({ includeArchived: true })).toHaveLength(2);
		expectDomainError(() => repos.clients.get("00000000-0000-7000-8000-000000000000"), "NOT_FOUND");
	});

	it("stores extra contacts", () => {
		const client = repos.clients.create({
			name: "Acme",
			contacts: [{ name: "Finance", email: "ap@acme.test" }],
		});
		expect(repos.clients.get(client.id).contacts).toEqual([
			{ name: "Finance", email: "ap@acme.test" },
		]);
		expect(repos.clients.create({ name: "Beta" }).contacts).toEqual([]);
		expect(() =>
			repos.clients.update(client.id, { name: "Acme", contacts: [{ name: "", email: "nope" }] }),
		).toThrow(/email/i);
	});

	it("imports many clients, skipping names that already exist", () => {
		repos.clients.create({ name: "Acme" });
		const result = repos.clients.importMany([
			{ name: "ACME" },
			{ name: "Beta", email: "b@beta.test" },
			{ name: "beta" },
			{ name: "Gamma" },
		]);
		expect(result).toEqual({ created: 2, skipped: ["ACME", "beta"] });
		expect(repos.clients.list().map((c) => c.name)).toEqual(["Acme", "Beta", "Gamma"]);
	});

	it("rolls back the whole import when a row is invalid", () => {
		expect(() =>
			repos.clients.importMany([{ name: "Beta" }, { name: "Bad", email: "nope" }]),
		).toThrow();
		expect(repos.clients.list()).toHaveLength(0);
	});
});

describe("payment accounts and tax rates", () => {
	it("keeps exactly one default payment account", () => {
		const eur = repos.paymentAccounts.create({ label: "Wise EUR", currency: "EUR" });
		expect(eur.isDefault).toBe(true);
		const usd = repos.paymentAccounts.create({
			label: "Wise USD",
			currency: "USD",
			isDefault: true,
		});
		expect(repos.paymentAccounts.get(eur.id).isDefault).toBe(false);
		expect(repos.paymentAccounts.list()[0]?.id).toBe(usd.id);
	});

	it("doesn't force a default tax rate", () => {
		const vat = repos.taxRates.create({ name: "VAT", rate: 2300 });
		expect(vat.isDefault).toBe(false);
		const reduced = repos.taxRates.create({ name: "Reduced", rate: 600, isDefault: true });
		repos.taxRates.update(vat.id, { name: "VAT", rate: 2300, isDefault: true });
		expect(repos.taxRates.get(reduced.id).isDefault).toBe(false);
	});
});

describe("invoices", () => {
	const setup = () => {
		repos.profile.save(profileInput);
		const client = repos.clients.create({ name: "Acme", currency: "USD", paymentTermsDays: 30 });
		const account = repos.paymentAccounts.create({
			label: "Wise USD",
			currency: "USD",
			details: [{ label: "Account", value: "123" }],
		});
		const vat = repos.taxRates.create({ name: "VAT", rate: 2000, note: "VAT 20%" });
		return { client, account, vat };
	};

	/** A draft for `clientId` (so it gets that client's defaults) with two line items. */
	const fillDraft = (clientId: string, taxRateId: string | null = null) => {
		const draft = repos.invoices.createDraft({ clientId });
		return repos.invoices.updateDraft(draft.id, {
			...draft,
			items: [
				{
					description: "Design",
					unit: "h",
					quantity: 10_000,
					unitPrice: 8_000,
					taxRateId,
					taxRate: taxRateId ? 2000 : 0,
				},
				{ description: "Hosting", quantity: 1_000, unitPrice: 2_000 },
			],
		});
	};

	it("sums what a client was billed, paid and still owes per currency", () => {
		const { client } = setup();
		expect(repos.clients.stats(client.id)).toEqual({
			invoiceCount: 0,
			draftCount: 0,
			lastIssueDate: null,
			totals: [],
		});

		const paid = repos.invoices.issue(fillDraft(client.id).id);
		repos.invoices.markPaid(paid.id);
		const open = repos.invoices.issue(fillDraft(client.id).id);
		const overdue = fillDraft(client.id);
		repos.invoices.updateDraft(overdue.id, {
			...overdue,
			issueDate: "2026-10-01",
			dueDate: "2026-10-15",
		});
		repos.invoices.issue(overdue.id);
		repos.invoices.void(repos.invoices.issue(fillDraft(client.id).id).id);
		fillDraft(client.id);

		const stats = repos.clients.stats(client.id);
		expect(stats).toMatchObject({ invoiceCount: 4, draftCount: 1, lastIssueDate: "2026-11-17" });
		expect(stats.totals).toEqual([
			{
				currency: "USD",
				billed: paid.total * 3,
				paid: paid.total,
				outstanding: open.total * 2,
				overdue: open.total,
			},
		]);
	});

	it("creates drafts with defaults from the client and profile", () => {
		const { client, account } = setup();
		const draft = repos.invoices.createDraft({ clientId: client.id });
		expect(draft).toMatchObject({
			status: "draft",
			number: null,
			currency: "USD",
			issueDate: "2026-11-17",
			dueDate: "2026-12-17",
			paymentAccountId: account.id,
			items: [],
		});
		expect(repos.invoices.events(draft.id).map((e) => e.type)).toEqual(["created"]);
	});

	it("recomputes totals when a draft is saved", () => {
		const { client, vat } = setup();
		const draft = fillDraft(client.id, vat.id);
		expect(draft.items.map((i) => [i.position, i.description])).toEqual([
			[0, "Design"],
			[1, "Hosting"],
		]);
		expect(draft).toMatchObject({ subtotal: 82_000, taxTotal: 16_000, total: 98_000 });
		expect(draft.taxes).toEqual([{ rate: 2000, base: 80_000, amount: 16_000 }]);
	});

	it("issues with the next number and a frozen snapshot", () => {
		const { client, vat } = setup();
		const draft = fillDraft(client.id, vat.id);
		const issued = repos.invoices.issue(draft.id);

		expect(issued).toMatchObject({ status: "issued", number: "INV-2026-0001" });
		expect(issued.snapshot).toMatchObject({
			number: "INV-2026-0001",
			issuer: { name: "Dawn Studio" },
			client: { name: "Acme" },
			paymentAccount: { label: "Wise USD" },
			totals: { total: 98_000 },
			taxNotes: ["VAT 20%"],
		});
		expect(repos.profile.get()?.nextSequence).toBe(2);

		// Later edits don't touch what was issued.
		repos.clients.update(client.id, { name: "Acme Renamed" });
		repos.profile.save({ ...profileInput, name: "New Name" });
		expect(repos.invoices.get(draft.id).snapshot?.client.name).toBe("Acme");
		expect(repos.invoices.get(draft.id).snapshot?.issuer.name).toBe("Dawn Studio");
		expect(repos.invoices.list()[0]?.clientName).toBe("Acme");

		expectDomainError(
			() => repos.invoices.updateDraft(draft.id, repos.invoices.get(draft.id)),
			"INVALID_STATE",
		);
		expectDomainError(() => repos.invoices.deleteDraft(draft.id), "INVALID_STATE");
	});

	it("numbers invoices sequentially and refuses duplicate numbers", () => {
		const { client } = setup();
		const first = fillDraft(client.id);
		const second = fillDraft(client.id);
		expect(repos.invoices.issue(first.id).number).toBe("INV-2026-0001");
		expect(repos.invoices.issue(second.id).number).toBe("INV-2026-0002");

		repos.profile.save({ ...profileInput, nextSequence: 2 });
		const third = fillDraft(client.id);
		expectDomainError(() => repos.invoices.issue(third.id), "CONFLICT");
		expect(repos.invoices.get(third.id).status).toBe("draft");
		expect(repos.profile.get()?.nextSequence).toBe(2);
	});

	it("won't issue incomplete drafts and leaves numbering untouched", () => {
		setup();
		const draft = repos.invoices.createDraft();
		expect(() => repos.invoices.issue(draft.id)).toThrow(/client/);
		expect(repos.profile.get()?.nextSequence).toBe(1);
	});

	it("records partial and full payments, and removes them", () => {
		const { client } = setup();
		const id = fillDraft(client.id).id;
		expectDomainError(() => repos.invoices.markPaid(id), "INVALID_STATE");
		const { total } = repos.invoices.issue(id);

		const partial = repos.invoices.recordPayment(id, {
			amount: 10_000,
			date: "2026-11-20",
			method: "Bank transfer",
		});
		expect(partial).toMatchObject({ status: "issued", amountPaid: 10_000, paidAt: null });
		expectDomainError(
			() => repos.invoices.recordPayment(id, { amount: total, date: "2026-11-20" }),
			"VALIDATION",
		);
		expectDomainError(
			() => repos.invoices.recordPayment(id, { amount: 1, date: "2026-01-01" }),
			"VALIDATION",
		);
		// Can't void an invoice with money on it.
		expectDomainError(() => repos.invoices.void(id), "INVALID_STATE");

		const paid = repos.invoices.markPaid(id);
		expect(paid).toMatchObject({ status: "paid", amountPaid: total });
		expect(paid.paidAt).not.toBeNull();
		expectDomainError(() => repos.invoices.markPaid(id), "INVALID_STATE");

		// Sorted by date: the "mark paid" payment is dated today, before the partial one.
		const [second, first] = repos.invoices.payments(id);
		expect([first?.amount, second?.amount]).toEqual([10_000, total - 10_000]);
		const reopened = repos.invoices.removePayment(second?.id ?? "");
		expect(reopened).toMatchObject({ status: "issued", amountPaid: 10_000, paidAt: null });
		repos.invoices.removePayment(first?.id ?? "");

		expect(repos.invoices.void(id, "Wrong client").status).toBe("void");
		expect(repos.invoices.events(id).map((e) => e.type)).toEqual([
			"created",
			"issued",
			"payment",
			"payment",
			"paid",
			"paymentRemoved",
			"unpaid",
			"paymentRemoved",
			"voided",
		]);
	});

	it("counts partial payments in client totals", () => {
		const { client } = setup();
		const id = fillDraft(client.id).id;
		const { total } = repos.invoices.issue(id);
		repos.invoices.recordPayment(id, { amount: 5_000, date: "2026-11-17" });
		const [usd] = repos.clients.stats(client.id).totals;
		expect(usd).toMatchObject({ billed: total, paid: 5_000, outstanding: total - 5_000 });
	});

	it("duplicates into a fresh draft and deletes drafts", () => {
		const { client } = setup();
		const source = repos.invoices.issue(fillDraft(client.id).id);
		const copy = repos.invoices.duplicate(source.id);
		expect(copy).toMatchObject({
			status: "draft",
			number: null,
			clientId: client.id,
			total: source.total,
		});
		expect(copy.items.map((i) => i.description)).toEqual(["Design", "Hosting"]);
		expect(copy.dueDate).toBe("2026-12-17");

		repos.invoices.deleteDraft(copy.id);
		expectDomainError(() => repos.invoices.get(copy.id), "NOT_FOUND");
		expect(repos.invoices.events(copy.id)).toEqual([]);
	});

	it("lists with status, client and search filters", () => {
		const { client } = setup();
		const other = repos.clients.create({ name: "Globex" });
		const issued = repos.invoices.issue(fillDraft(client.id).id);
		fillDraft(other.id);

		expect(repos.invoices.list()).toHaveLength(2);
		expect(repos.invoices.list({ status: ["draft"] }).map((i) => i.clientName)).toEqual(["Globex"]);
		expect(repos.invoices.list({ clientId: client.id }).map((i) => i.id)).toEqual([issued.id]);
		expect(repos.invoices.list({ search: "0001" }).map((i) => i.id)).toEqual([issued.id]);
		expect(repos.invoices.list({ search: "glob" })).toHaveLength(1);
	});

	it("filters by currency, period and line text", () => {
		const { client } = setup();
		const usd = fillDraft(client.id);
		const eur = repos.invoices.createDraft({ clientId: client.id });
		repos.invoices.updateDraft(eur.id, {
			...eur,
			currency: "EUR",
			issueDate: "2026-01-15",
			dueDate: "2026-01-29",
			items: [{ description: "Logo refresh", quantity: 1_000, unitPrice: 50_000 }],
		});

		expect(repos.invoices.list({ currency: "EUR" }).map((i) => i.id)).toEqual([eur.id]);
		expect(repos.invoices.list({ from: "2026-11-01", to: "2026-11-30" }).map((i) => i.id)).toEqual([
			usd.id,
		]);
		expect(repos.invoices.list({ search: "logo" }).map((i) => i.id)).toEqual([eur.id]);
		expect(repos.invoices.list({ search: "hosting" }).map((i) => i.id)).toEqual([usd.id]);
	});

	it("marks several invoices paid, skipping ones that aren't open", () => {
		const { client } = setup();
		const a = repos.invoices.issue(fillDraft(client.id).id);
		const b = repos.invoices.issue(fillDraft(client.id).id);
		const draft = fillDraft(client.id);
		expect(repos.invoices.markPaidMany([a.id, b.id, draft.id])).toEqual({ paid: 2, skipped: 1 });
		expect(repos.invoices.get(a.id).status).toBe("paid");
		expect(repos.invoices.get(draft.id).status).toBe("draft");
	});

	it("protects clients that invoices refer to", () => {
		const { client } = setup();
		fillDraft(client.id);
		let error: unknown;
		try {
			database.db.run(sql`DELETE FROM clients`);
		} catch (caught) {
			error = caught;
		}
		// Drizzle wraps the SQLite error; the constraint message is on `cause`.
		expect(String((error as Error | undefined)?.cause)).toMatch(/FOREIGN KEY/);
	});
});

describe("database file", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "invoicing-db-"));
	});
	afterEach(() => rmSync(dir, { recursive: true, force: true }));

	it("persists data, reapplies migrations idempotently and backs up", async () => {
		const file = join(dir, "invoicing.db");
		const first = openDatabase({ file, migrationsFolder });
		createRepositories(first.db).profile.save(profileInput);
		await first.backup(join(dir, "backup.db"));
		first.close();

		const second = openDatabase({ file, migrationsFolder });
		expect(createRepositories(second.db).profile.get()?.name).toBe("Dawn Studio");
		second.close();

		const restored = openDatabase({ file: join(dir, "backup.db"), migrationsFolder });
		expect(createRepositories(restored.db).profile.get()?.name).toBe("Dawn Studio");
		restored.close();
	});
});

describe("catalog", () => {
	it("saves, searches, edits and archives items", () => {
		const vat = repos.taxRates.create({ name: "VAT", rate: 2000 });
		const design = repos.catalog.create({
			description: "Design work",
			unit: "h",
			unitPrice: 9_500,
			currency: "eur",
			taxRateId: vat.id,
		});
		repos.catalog.create({ description: "Hosting", unit: "mo", unitPrice: 4_000, currency: "EUR" });
		expect(design).toMatchObject({ currency: "EUR", taxRateId: vat.id, archivedAt: null });
		expect(repos.catalog.list().map((i) => i.description)).toEqual(["Design work", "Hosting"]);
		expect(repos.catalog.list({ search: "host" }).map((i) => i.description)).toEqual(["Hosting"]);

		expect(repos.catalog.update(design.id, { ...design, unitPrice: 10_000 }).unitPrice).toBe(
			10_000,
		);
		expect(() => repos.catalog.create({ description: "", unitPrice: 1, currency: "EUR" })).toThrow(
			"Description is required",
		);

		repos.catalog.archive(design.id);
		expect(repos.catalog.list().map((i) => i.description)).toEqual(["Hosting"]);
		expect(repos.catalog.list({ includeArchived: true })).toHaveLength(2);
		repos.catalog.unarchive(design.id);
		expect(repos.catalog.list()).toHaveLength(2);
	});
});

describe("branding", () => {
	it("keeps branding apart from the profile details and fills defaults", () => {
		repos.profile.save(profileInput);
		expect(repos.profile.get()?.branding).toMatchObject({ template: "classic", paperSize: "a4" });
		repos.profile.setBranding({ accentColor: "#112233", template: "modern", paperSize: "letter" });
		// Saving the details form (with its older copy of branding) leaves branding alone.
		const saved = repos.profile.save({ ...profileInput, branding: { accentColor: "#000000" } });
		expect(saved.branding).toMatchObject({
			accentColor: "#112233",
			template: "modern",
			paperSize: "letter",
			font: "sans",
			footer: "",
		});
	});

	it("reads branding saved before the newer fields existed", () => {
		repos.profile.save(profileInput);
		database.db.run(
			sql`UPDATE business_profiles SET branding = '{"accentColor":"#4f46e5","template":"classic"}'`,
		);
		expect(repos.profile.get()?.branding).toEqual({
			accentColor: "#4f46e5",
			template: "classic",
			font: "sans",
			logoPosition: "left",
			paperSize: "a4",
			footer: "",
		});
	});
});
