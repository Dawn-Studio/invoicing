import { currencyExponent } from "./currency";
import { fromMinor } from "./money";
import type { InvoiceSnapshot } from "./snapshot";

/**
 * Email text for sending invoices and reminders. Templates are plain text with `{variable}`
 * placeholders; unknown placeholders are left as typed so mistakes are visible.
 */

export interface EmailTemplate {
	subject: string;
	body: string;
}

export interface EmailTemplates {
	invoice: EmailTemplate;
	reminder: EmailTemplate;
}

export const EMAIL_VARIABLES = [
	"client.name",
	"client.contact",
	"invoice.number",
	"invoice.total",
	"invoice.balance",
	"invoice.dueDate",
	"business.name",
] as const;
export type EmailVariable = (typeof EMAIL_VARIABLES)[number];

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
	invoice: {
		subject: "Invoice {invoice.number} from {business.name}",
		body: [
			"Hi {client.contact},",
			"",
			"Please find attached invoice {invoice.number} for {invoice.total}, due on {invoice.dueDate}.",
			"",
			"Thank you!",
			"{business.name}",
		].join("\n"),
	},
	reminder: {
		subject: "Reminder: invoice {invoice.number} is overdue",
		body: [
			"Hi {client.contact},",
			"",
			"A friendly reminder that invoice {invoice.number} was due on {invoice.dueDate}. The balance of {invoice.balance} is still open. I've attached the invoice again for convenience.",
			"",
			"If you've already paid, please ignore this message.",
			"",
			"Best regards,",
			"{business.name}",
		].join("\n"),
	},
};

/** Replaces `{name}` placeholders; anything not in `values` stays as written. */
export function fillTemplate(
	template: string,
	values: Partial<Record<EmailVariable, string>>,
): string {
	return template.replaceAll(/\{([a-zA-Z.]+)\}/g, (match, name: string) =>
		Object.hasOwn(values, name) ? (values[name as EmailVariable] ?? match) : match,
	);
}

const longDate = (iso: string) =>
	new Intl.DateTimeFormat(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${iso}T00:00:00Z`));

const money = (minor: number, currency: string) =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
		minimumFractionDigits: currencyExponent(currency),
		maximumFractionDigits: currencyExponent(currency),
	}).format(fromMinor(minor, currency) as Intl.StringNumericLiteral);

/** The values for an issued invoice. The contact falls back to the client's name. */
export function emailValues(
	invoice: InvoiceSnapshot,
	amountPaid: number,
): Record<EmailVariable, string> {
	return {
		"client.name": invoice.client.name,
		"client.contact": invoice.client.contactName || invoice.client.name,
		"invoice.number": invoice.number,
		"invoice.total": money(invoice.totals.total, invoice.currency),
		"invoice.balance": money(invoice.totals.total - amountPaid, invoice.currency),
		"invoice.dueDate": longDate(invoice.dueDate),
		"business.name": invoice.issuer.name,
	};
}

/** A short plain-text summary for pasting into chat or email. */
export function invoiceSummary(invoice: InvoiceSnapshot, amountPaid: number): string {
	const values = emailValues(invoice, amountPaid);
	const lines = [
		`Invoice ${invoice.number} from ${invoice.issuer.name} to ${invoice.client.name}`,
		amountPaid > 0
			? `Total ${values["invoice.total"]}, balance due ${values["invoice.balance"]} by ${values["invoice.dueDate"]}`
			: `Amount due ${values["invoice.total"]} by ${values["invoice.dueDate"]}`,
	];
	if (invoice.paymentAccount && invoice.paymentAccount.details.length > 0) {
		lines.push("", "Payment details:");
		for (const detail of invoice.paymentAccount.details)
			lines.push(`${detail.label}: ${detail.value}`);
	}
	return lines.join("\n");
}
