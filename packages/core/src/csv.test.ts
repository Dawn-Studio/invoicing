import { describe, expect, it } from "vitest";
import { parseClientsCsv } from "./client-import";
import { detectDelimiter, parseCsv } from "./csv";

describe("parseCsv", () => {
	it("reads quoted fields, escaped quotes and newlines inside quotes", () => {
		expect(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([
			["a", "b, c", 'say "hi"'],
			["1", "two\nlines", "3"],
		]);
	});

	it("strips a BOM and keeps a last line without a newline", () => {
		expect(parseCsv("﻿name,email\nAcme,a@acme.com")).toEqual([
			["name", "email"],
			["Acme", "a@acme.com"],
		]);
	});

	it("keeps empty fields", () => {
		expect(parseCsv("a,,c\n,,\n")).toEqual([
			["a", "", "c"],
			["", "", ""],
		]);
	});

	it("detects semicolon and tab delimiters from the header", () => {
		expect(detectDelimiter('name;"a,b";email\nx,y')).toBe(";");
		expect(detectDelimiter("name\temail\n")).toBe("\t");
		expect(detectDelimiter("name")).toBe(",");
		expect(parseCsv("name;email\nAcme;a@acme.com")).toEqual([
			["name", "email"],
			["Acme", "a@acme.com"],
		]);
	});
});

describe("parseClientsCsv", () => {
	it("maps common header names and validates each row", () => {
		const preview = parseClientsCsv(
			[
				"Company,Contact Person,E-mail,VAT number,Street,ZIP,City,Country,Currency,Payment terms,Extra",
				"Acme Inc,Jane Doe,jane@acme.com,SE123,1 Main St,111 22,Stockholm,Sweden,sek,Net 30,x",
				"Broken,,not-an-email,,,,,,ABC,,",
				",,,,,,,,,,",
			].join("\n"),
		);
		expect(preview.error).toBeNull();
		expect(preview.columns.map((c) => c.field)).toEqual([
			"name",
			"contactName",
			"email",
			"taxId",
			"address.line1",
			"address.postalCode",
			"address.city",
			"address.country",
			"currency",
			"paymentTermsDays",
			null,
		]);
		expect(preview.rows).toHaveLength(2);
		expect(preview.rows[0]).toMatchObject({
			line: 2,
			errors: [],
			client: {
				name: "Acme Inc",
				contactName: "Jane Doe",
				email: "jane@acme.com",
				taxId: "SE123",
				currency: "SEK",
				paymentTermsDays: 30,
				address: { line1: "1 Main St", postalCode: "111 22", city: "Stockholm", country: "Sweden" },
			},
		});
		expect(preview.rows[1]?.client).toBeNull();
		expect(preview.rows[1]?.line).toBe(3);
		expect(preview.rows[1]?.errors).toEqual([
			expect.stringMatching(/^Email:/),
			expect.stringMatching(/^Currency:/),
		]);
	});

	it("requires a name column", () => {
		expect(parseClientsCsv("email\na@b.co").error).toMatch(/name/);
	});

	it("reports a file without rows", () => {
		expect(parseClientsCsv("name,email\n").error).toMatch(/no client rows/);
	});
});
