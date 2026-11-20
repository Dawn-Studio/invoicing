import { fileURLToPath } from "node:url";
import { formatMoney } from "@dawnstudio/core";
import {
	createRepositories,
	type OpenedDatabase,
	openDatabase,
	type Repositories,
} from "@dawnstudio/db";
import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { describeError } from "./errors";
import { createTools, describeRecord } from "./tools";

const migrationsFolder = fileURLToPath(
	new URL("../../../../../packages/db/migrations", import.meta.url),
);

let database: OpenedDatabase;
let repos: Repositories;
let tools: ReturnType<typeof createTools>;

/** Runs a tool the way the AI SDK would after the model calls it. */
const run = <N extends keyof typeof tools>(name: N, input: unknown) =>
	(tools[name].execute as (input: unknown, options: unknown) => unknown)(
		(tools[name].inputSchema as unknown as { parse: (v: unknown) => unknown }).parse(input),
		{ toolCallId: "call", messages: [] },
	);

beforeEach(() => {
	database = openDatabase({ file: ":memory:", migrationsFolder });
	repos = createRepositories(database.db, { today: () => "2026-11-20" });
	repos.profile.save({ name: "Dawn Studio", defaultCurrency: "EUR", paymentTermsDays: 14 });
	tools = createTools(() => repos);
});

afterEach(() => database.close());

describe("assistant tools", () => {
	it("creates a draft from decimal strings, with the client's terms and a tax rate", () => {
		const client = repos.clients.create({
			name: "Nordlys AS",
			currency: "NOK",
			paymentTermsDays: 30,
		});
		const vat = repos.taxRates.create({ name: "VAT", rate: 2500 });
		const result = run("createDraftInvoice", {
			clientId: client.id,
			items: [
				{ description: "Brand identity", quantity: "1", unitPrice: "42000" },
				{
					description: "Design support",
					quantity: "1.5",
					unit: "h",
					unitPrice: "950.50",
					taxRateId: vat.id,
				},
			],
		}) as { invoiceId: string; total: string };

		const invoice = repos.invoices.get(result.invoiceId);
		expect(invoice.status).toBe("draft");
		expect(invoice.currency).toBe("NOK");
		expect(invoice.dueDate).toBe("2026-12-20");
		expect(invoice.items.map((i) => [i.quantity, i.unitPrice, i.taxRate])).toEqual([
			[1000, 4_200_000, 0],
			[1500, 95_050, 2500],
		]);
		expect(result.total).toBe(formatMoney(invoice.total, "NOK", "en"));
	});

	it("only changes drafts, and replaces lines when asked", () => {
		const client = repos.clients.create({ name: "Acme" });
		const draft = repos.invoices.createDraft({ clientId: client.id });
		run("updateDraftInvoice", {
			id: draft.id,
			notes: "Thanks!",
			items: [{ description: "A", quantity: "2", unitPrice: "10" }],
		});
		expect(repos.invoices.get(draft.id).notes).toBe("Thanks!");
		expect(repos.invoices.get(draft.id).total).toBe(2000);

		repos.invoices.issue(draft.id);
		expect(() => run("updateDraftInvoice", { id: draft.id, notes: "Changed" })).toThrow(
			/Only drafts/,
		);
	});

	it("rejects amounts that aren't plain decimals", () => {
		expect(() =>
			run("createDraftInvoice", {
				items: [{ description: "A", quantity: "1", unitPrice: "1,000" }],
			}),
		).toThrow();
		expect(() =>
			run("createDraftInvoice", {
				items: [{ description: "A", quantity: "0.0001", unitPrice: "1" }],
			}),
		).toThrow();
	});

	it("searches and describes records for mentions", () => {
		const client = repos.clients.create({ name: "Kestrel Labs", email: "ap@kestrel.dev" });
		expect(run("searchClients", { query: "kestrel" })).toEqual([
			expect.objectContaining({ id: client.id, name: "Kestrel Labs", email: "ap@kestrel.dev" }),
		]);
		expect(describeRecord(repos, { type: "client", id: client.id })).toMatchObject({
			name: "Kestrel Labs",
		});
		expect(
			describeRecord(repos, { type: "invoice", id: "01a1f66c-f3ee-78bb-9b0d-e1f2904c0f03" }),
		).toBeNull();
	});
});

describe("describeError", () => {
	const apiError = (statusCode: number, responseBody: string) =>
		new APICallError({
			message: "x",
			url: "https://x",
			requestBodyValues: {},
			statusCode,
			responseBody,
		});

	it("explains the ChatGPT plan limit and OpenRouter credits", () => {
		expect(
			describeError(
				apiError(429, '{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}'),
			),
		).toMatch(/limit for this app/);
		expect(describeError(apiError(402, '{"error":{"message":"Insufficient credits"}}'))).toMatch(
			/out of credits/,
		);
		expect(describeError(apiError(400, '{"error":{"message":"Bad thing"}}'))).toBe(
			"The provider said: Bad thing",
		);
	});
});
