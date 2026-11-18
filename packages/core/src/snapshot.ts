import type { BusinessProfile, Client, InvoiceItem, PaymentAccount } from "./entities";
import { DomainError } from "./errors";
import type { Address, Branding, PaymentDetail } from "./schemas";
import { computeTotals, type Discount, type TaxTotal } from "./totals";

/**
 * Everything printed on an issued invoice, frozen at the moment of issuing. Rendering an
 * issued invoice reads only from this, so later edits to the profile, client or payment
 * account never change invoices that were already sent.
 *
 * Bump `version` and add a migration path when the shape changes.
 */
export interface InvoiceSnapshot {
	version: 1;
	number: string;
	issueDate: string;
	dueDate: string;
	currency: string;
	issuer: {
		name: string;
		legalName: string;
		email: string;
		phone: string;
		website: string;
		address: Address;
		taxId: string;
		/** Logo files are content-addressed and never overwritten, so the name stays valid. */
		logoFile: string | null;
	};
	client: {
		name: string;
		contactName: string;
		email: string;
		phone: string;
		address: Address;
		taxId: string;
	};
	paymentAccount: { label: string; currency: string; details: PaymentDetail[] } | null;
	items: {
		description: string;
		unit: string;
		quantity: number;
		unitPrice: number;
		taxRate: number;
		amount: number;
		discount: number;
		net: number;
	}[];
	discount: Discount | null;
	totals: {
		subtotal: number;
		discountTotal: number;
		taxes: TaxTotal[];
		taxTotal: number;
		total: number;
	};
	/** Notes printed for each tax rate used, e.g. exemption notices. */
	taxNotes: string[];
	notes: string;
	terms: string;
	branding: Branding;
}

export interface SnapshotInput {
	number: string;
	issueDate: string;
	dueDate: string;
	currency: string;
	discount: Discount | null;
	notes: string;
	terms: string;
	items: Pick<InvoiceItem, "description" | "unit" | "quantity" | "unitPrice" | "taxRate">[];
	profile: BusinessProfile;
	client: Client | null;
	paymentAccount: PaymentAccount | null;
	taxNotes: string[];
}

/** Checks an invoice can be issued and builds its frozen snapshot. */
export function buildSnapshot(input: SnapshotInput): InvoiceSnapshot {
	const { profile, client, paymentAccount } = input;
	if (!client) throw new DomainError("VALIDATION", "Choose a client before issuing");
	if (input.items.length === 0) throw new DomainError("VALIDATION", "Add at least one line item");
	if (input.items.some((item) => item.description.trim() === "")) {
		throw new DomainError("VALIDATION", "Every line item needs a description");
	}
	if (input.dueDate < input.issueDate) {
		throw new DomainError("VALIDATION", "Due date can't be before the issue date");
	}

	const totals = computeTotals(input.items, input.discount);
	if (totals.total < 0) throw new DomainError("VALIDATION", "Invoice total can't be negative");

	return {
		version: 1,
		number: input.number,
		issueDate: input.issueDate,
		dueDate: input.dueDate,
		currency: input.currency,
		issuer: {
			name: profile.name,
			legalName: profile.legalName,
			email: profile.email,
			phone: profile.phone,
			website: profile.website,
			address: { ...profile.address },
			taxId: profile.taxId,
			logoFile: profile.logoFile,
		},
		client: {
			name: client.name,
			contactName: client.contactName,
			email: client.email,
			phone: client.phone,
			address: { ...client.address },
			taxId: client.taxId,
		},
		paymentAccount: paymentAccount
			? {
					label: paymentAccount.label,
					currency: paymentAccount.currency,
					details: paymentAccount.details.map((detail) => ({ ...detail })),
				}
			: null,
		items: input.items.map((item, i) => {
			const line = totals.lines[i] ?? { amount: 0, discount: 0, net: 0 };
			return {
				description: item.description,
				unit: item.unit,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				taxRate: item.taxRate,
				...line,
			};
		}),
		discount: input.discount,
		totals: {
			subtotal: totals.subtotal,
			discountTotal: totals.discountTotal,
			taxes: totals.taxes,
			taxTotal: totals.taxTotal,
			total: totals.total,
		},
		taxNotes: input.taxNotes.filter((note) => note.trim() !== ""),
		notes: input.notes,
		terms: input.terms,
		branding: { ...profile.branding },
	};
}
