import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TEMPLATES, emailValues, fillTemplate, invoiceSummary } from "./email";
import type { InvoiceSnapshot } from "./snapshot";

const invoice = {
	number: "INV-2026-0042",
	dueDate: "2026-12-02",
	currency: "EUR",
	issuer: { name: "Dawn Studio" },
	client: { name: "Halden Studio AB", contactName: "Ingrid" },
	totals: { total: 76_000 },
	paymentAccount: {
		label: "Wise",
		currency: "EUR",
		details: [{ label: "IBAN", value: "BE68 5390" }],
	},
} as unknown as InvoiceSnapshot;

describe("email templates", () => {
	it("fills known variables and keeps unknown ones visible", () => {
		expect(fillTemplate("Hi {client.name}, {oops}", { "client.name": "Acme" })).toBe(
			"Hi Acme, {oops}",
		);
	});

	it("builds values from an invoice, with the balance after payments", () => {
		const values = emailValues(invoice, 26_000);
		expect(values["client.contact"]).toBe("Ingrid");
		expect(values["invoice.total"]).toContain("760.00");
		expect(values["invoice.balance"]).toContain("500.00");
		expect(values["invoice.dueDate"]).toContain("2026");
	});

	it("falls back to the client name when there is no contact person", () => {
		const noContact = { ...invoice, client: { name: "Acme", contactName: "" } } as InvoiceSnapshot;
		expect(emailValues(noContact, 0)["client.contact"]).toBe("Acme");
	});

	it("fills the default templates completely", () => {
		const values = emailValues(invoice, 0);
		for (const template of Object.values(DEFAULT_EMAIL_TEMPLATES)) {
			expect(fillTemplate(template.subject + template.body, values)).not.toMatch(/\{[a-z.]+\}/i);
		}
	});

	it("summarises an invoice with payment details", () => {
		const summary = invoiceSummary(invoice, 0);
		expect(summary).toContain("Invoice INV-2026-0042 from Dawn Studio to Halden Studio AB");
		expect(summary).toContain("IBAN: BE68 5390");
	});
});
