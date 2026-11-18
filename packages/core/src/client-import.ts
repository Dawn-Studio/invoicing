import { parseCsv } from "./csv";
import { type ClientInput, clientInputSchema } from "./schemas";

/** Client fields a CSV column can fill, with the header names we recognise for each. */
const COLUMNS = {
	name: [
		"name",
		"client",
		"clientname",
		"company",
		"companyname",
		"organization",
		"organisation",
		"business",
	],
	contactName: ["contact", "contactname", "contactperson", "person", "fullname"],
	email: ["email", "emailaddress", "mail", "billingemail"],
	phone: ["phone", "phonenumber", "telephone", "tel", "mobile"],
	taxId: ["taxid", "vat", "vatnumber", "vatid", "taxnumber", "tin", "ein", "nif"],
	"address.line1": ["address", "address1", "addressline1", "street", "streetaddress", "line1"],
	"address.line2": ["address2", "addressline2", "line2"],
	"address.city": ["city", "town"],
	"address.region": ["region", "state", "province", "county"],
	"address.postalCode": ["postalcode", "postcode", "zip", "zipcode"],
	"address.country": ["country"],
	currency: ["currency"],
	paymentTermsDays: ["paymentterms", "paymenttermsdays", "terms", "netdays", "duedays"],
	notes: ["notes", "note", "comments"],
} as const;

export type ClientImportField = keyof typeof COLUMNS;

export const CLIENT_IMPORT_LABELS: Record<ClientImportField, string> = {
	name: "Name",
	contactName: "Contact person",
	email: "Email",
	phone: "Phone",
	taxId: "Tax ID",
	"address.line1": "Street address",
	"address.line2": "Address line 2",
	"address.city": "City",
	"address.region": "Region",
	"address.postalCode": "Postal code",
	"address.country": "Country",
	currency: "Currency",
	paymentTermsDays: "Payment terms",
	notes: "Notes",
};

const normalizeHeader = (header: string) => header.toLowerCase().replaceAll(/[^a-z0-9]/g, "");

const fieldByHeader = new Map<string, ClientImportField>(
	Object.entries(COLUMNS).flatMap(([field, aliases]) =>
		aliases.map((alias) => [alias, field as ClientImportField] as const),
	),
);

export interface ClientImportRow {
	/** 1-based line in the file, counting the header, for error messages. */
	line: number;
	/** The validated client, or null when the row has errors. */
	client: ClientInput | null;
	/** Name as written in the file, for showing rows that failed. */
	name: string;
	errors: string[];
}

export interface ClientImportPreview {
	/** Each header and the field it maps to (null = ignored). */
	columns: { header: string; field: ClientImportField | null }[];
	rows: ClientImportRow[];
	/** Set when the file can't be imported at all. */
	error: string | null;
}

/** Reads a client list exported from a spreadsheet or another invoicing tool. */
export function parseClientsCsv(text: string): ClientImportPreview {
	const [header = [], ...records] = parseCsv(text);
	const seen = new Set<ClientImportField>();
	const columns = header.map((raw) => {
		const field = fieldByHeader.get(normalizeHeader(raw)) ?? null;
		// The first column wins when two headers map to the same field.
		if (field && !seen.has(field)) {
			seen.add(field);
			return { header: raw.trim(), field };
		}
		return { header: raw.trim(), field: null };
	});

	if (!seen.has("name")) {
		return {
			columns,
			rows: [],
			error: "The file needs a column for the client name, such as “Name” or “Company”.",
		};
	}

	const rows: ClientImportRow[] = [];
	records.forEach((record, index) => {
		if (record.every((cell) => cell.trim() === "")) return;
		const values = Object.fromEntries(
			columns.flatMap((column, i) =>
				column.field ? [[column.field, (record[i] ?? "").trim()]] : [],
			),
		) as Partial<Record<ClientImportField, string>>;
		rows.push({ line: index + 2, name: values.name ?? "", ...toClient(values) });
	});
	return { columns, rows, error: rows.length === 0 ? "The file has no client rows." : null };
}

function toClient(values: Partial<Record<ClientImportField, string>>): {
	client: ClientInput | null;
	errors: string[];
} {
	const terms = values.paymentTermsDays ?? "";
	// "Net 30", "30 days" → 30.
	const termDigits = terms.match(/\d+/)?.[0];
	const input = {
		name: values.name ?? "",
		contactName: values.contactName ?? "",
		email: values.email ?? "",
		phone: values.phone ?? "",
		taxId: values.taxId ?? "",
		address: {
			line1: values["address.line1"] ?? "",
			line2: values["address.line2"] ?? "",
			city: values["address.city"] ?? "",
			region: values["address.region"] ?? "",
			postalCode: values["address.postalCode"] ?? "",
			country: values["address.country"] ?? "",
		},
		currency: values.currency ? values.currency : null,
		paymentTermsDays: termDigits ? Number(termDigits) : null,
		notes: values.notes ?? "",
	};
	const result = clientInputSchema.safeParse(input);
	if (result.success) return { client: result.data, errors: [] };
	return {
		client: null,
		errors: result.error.issues.map((issue) => {
			const field = issue.path.join(".") as ClientImportField;
			const label = CLIENT_IMPORT_LABELS[field] ?? field;
			return `${label}: ${issue.message}`;
		}),
	};
}
