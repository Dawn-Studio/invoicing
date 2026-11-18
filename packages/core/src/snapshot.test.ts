import { describe, expect, it } from "vitest";
import type { BusinessProfile, Client } from "./entities";
import { addressSchema, brandingSchema } from "./schemas";
import { buildSnapshot, issueProblems, previewSnapshot, type SnapshotInput } from "./snapshot";

const profile: BusinessProfile = {
	id: "p",
	name: "Dawn Studio",
	legalName: "",
	email: "hello@example.com",
	phone: "",
	website: "",
	address: addressSchema.parse({ city: "Lisbon" }),
	taxId: "",
	defaultCurrency: "EUR",
	paymentTermsDays: 14,
	numberPattern: "INV-{SEQ:4}",
	nextSequence: 1,
	branding: brandingSchema.parse({}),
	logoFile: null,
	createdAt: 0,
	updatedAt: 0,
};

const client: Client = {
	id: "c",
	name: "Acme",
	contactName: "",
	email: "",
	phone: "",
	address: addressSchema.parse({}),
	taxId: "",
	currency: null,
	paymentTermsDays: null,
	notes: "",
	contacts: [],
	archivedAt: null,
	createdAt: 0,
	updatedAt: 0,
};

const input = (overrides: Partial<SnapshotInput> = {}): SnapshotInput => ({
	number: "INV-0001",
	issueDate: "2026-11-17",
	dueDate: "2026-12-01",
	currency: "EUR",
	discount: null,
	notes: "",
	terms: "",
	items: [{ description: "Design work", unit: "h", quantity: 10000, unitPrice: 8000, taxRate: 0 }],
	profile,
	client,
	paymentAccount: null,
	taxNotes: ["", "VAT reverse charge"],
	...overrides,
});

describe("buildSnapshot", () => {
	it("freezes issuer, client, items and totals", () => {
		const snapshot = buildSnapshot(input());
		expect(snapshot).toMatchObject({
			version: 1,
			number: "INV-0001",
			issuer: { name: "Dawn Studio", address: { city: "Lisbon" } },
			client: { name: "Acme" },
			items: [{ description: "Design work", amount: 80000, net: 80000 }],
			totals: { subtotal: 80000, total: 80000 },
			taxNotes: ["VAT reverse charge"],
		});
	});

	it("copies nested objects instead of sharing them", () => {
		const snapshot = buildSnapshot(input());
		expect(snapshot.issuer.address).not.toBe(profile.address);
		expect(snapshot.branding).not.toBe(profile.branding);
	});

	it.each([
		[{ client: null }, /client/],
		[{ items: [] }, /at least one/],
		[
			{ items: [{ description: " ", unit: "", quantity: 1000, unitPrice: 1, taxRate: 0 }] },
			/description/,
		],
		[{ dueDate: "2026-11-01" }, /Due date/],
		[
			{ items: [{ description: "Refund", unit: "", quantity: 1000, unitPrice: -100, taxRate: 0 }] },
			/negative/,
		],
	])("refuses to issue invalid invoices (%#)", (overrides, message) => {
		expect(() => buildSnapshot(input(overrides as Partial<SnapshotInput>))).toThrow(message);
	});

	it("lists every problem at once for the editor", () => {
		expect(issueProblems(input({ client: null, items: [] }))).toEqual([
			"Choose a client",
			"Add at least one line item",
		]);
		expect(issueProblems(input())).toEqual([]);
	});

	it("previews half-finished drafts without throwing", () => {
		const preview = previewSnapshot(input({ client: null, items: [] }));
		expect(preview.client.name).toBe("");
		expect(preview.totals.total).toBe(0);
	});
});
