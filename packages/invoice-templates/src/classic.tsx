import type { InvoiceSnapshot } from "@dawnstudio/core";
import type { ReactNode } from "react";
import { addressLines, date, figure, money, percent, quantity } from "./format";
import type { InvoiceTemplateProps } from "./types";

/**
 * The default layout: logo and title on top, both parties side by side, a line-item table,
 * totals on the right and payment details at the bottom. Sized as an A4 page at 96 dpi.
 * Colours are fixed (not theme tokens): invoices are always printed on white.
 */
export function ClassicTemplate({ invoice, logoSrc, draft = false, stamp }: InvoiceTemplateProps) {
	const { issuer, client, currency, totals } = invoice;
	const accent = invoice.branding.accentColor;
	const showTax = invoice.items.some((item) => item.taxRate > 0);
	const showUnits = invoice.items.some((item) => item.unit.trim() !== "");
	const placeholder = (text: string) => (draft ? <Muted>{text}</Muted> : null);

	return (
		<article
			className="relative flex h-[1123px] w-[794px] flex-col bg-white px-14 py-14 text-[13px] leading-[1.5] text-neutral-900 antialiased select-text"
			style={{ fontFamily: "'Inter Variable', ui-sans-serif, system-ui, sans-serif" }}
		>
			{stamp ? (
				<div className="pointer-events-none absolute top-[300px] left-1/2 -translate-x-1/2 -rotate-12 rounded-lg border-4 border-red-500/60 px-6 py-1 text-5xl font-bold tracking-[0.2em] text-red-500/60 uppercase">
					{stamp}
				</div>
			) : null}

			<header className="flex items-start justify-between gap-10">
				<div className="flex min-h-14 max-w-[300px] items-center">
					{logoSrc ? (
						<img src={logoSrc} alt="" className="max-h-16 max-w-[240px] object-contain" />
					) : (
						<div className="text-xl font-semibold tracking-tight">
							{issuer.name || placeholder("Your business")}
						</div>
					)}
				</div>
				<div className="text-right">
					<div
						className="text-[28px] leading-none font-semibold tracking-tight"
						style={{ color: accent }}
					>
						Invoice
					</div>
					<div className="mt-2 font-mono text-[12px] text-neutral-500">
						{invoice.number || placeholder("Number assigned on issue")}
						{draft && invoice.number ? " · draft" : null}
					</div>
				</div>
			</header>

			<section className="mt-12 grid grid-cols-[1fr_1fr_auto] gap-10">
				<Party label="From" party={issuer} />
				<Party label="Bill to" party={client} empty={placeholder("Choose a client")} />
				<dl className="grid grid-cols-[auto_auto] content-start gap-x-6 gap-y-1">
					<Label>Issued</Label>
					<dd className="text-right">{date(invoice.issueDate)}</dd>
					<Label>Due</Label>
					<dd className="text-right">{date(invoice.dueDate)}</dd>
				</dl>
			</section>

			<table className="mt-12 w-full border-collapse tabular-nums">
				<thead>
					<tr className="border-b border-neutral-300 text-left text-[11px] tracking-wider text-neutral-500 uppercase">
						<th className="py-2 pr-4 font-medium">Description</th>
						<th className="py-2 pl-4 text-right font-medium">Qty</th>
						{showUnits ? <th className="py-2 pl-2 text-left font-medium">Unit</th> : null}
						<th className="py-2 pl-4 text-right font-medium">Rate</th>
						{showTax ? <th className="py-2 pl-4 text-right font-medium">Tax</th> : null}
						<th className="py-2 pl-4 text-right font-medium">Amount</th>
					</tr>
				</thead>
				<tbody>
					{invoice.items.length === 0 ? (
						<tr className="border-b border-neutral-200">
							<td colSpan={6} className="py-3">
								{placeholder("No line items yet")}
							</td>
						</tr>
					) : (
						invoice.items.map((item, index) => (
							// Lines have no stable id in the snapshot; position is the identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<tr key={index} className="border-b border-neutral-200 align-top">
								<td className="py-3 pr-4 whitespace-pre-line">
									{item.description || placeholder("Description")}
								</td>
								<td className="py-3 pl-4 text-right">{quantity(item.quantity)}</td>
								{showUnits ? <td className="py-3 pl-2 text-neutral-500">{item.unit}</td> : null}
								<td className="py-3 pl-4 text-right">{figure(item.unitPrice, currency)}</td>
								{showTax ? (
									<td className="py-3 pl-4 text-right text-neutral-500">
										{item.taxRate > 0 ? percent(item.taxRate) : "—"}
									</td>
								) : null}
								<td className="py-3 pl-4 text-right">{figure(item.amount, currency)}</td>
							</tr>
						))
					)}
				</tbody>
			</table>

			<section className="mt-6 flex justify-end">
				<dl className="grid w-[300px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 tabular-nums">
					<Label>Subtotal</Label>
					<dd className="text-right">{money(totals.subtotal, currency)}</dd>
					{totals.discountTotal > 0 ? (
						<>
							<Label>
								Discount
								{invoice.discount?.type === "percent"
									? ` (${percent(invoice.discount.value)})`
									: ""}
							</Label>
							<dd className="text-right">−{money(totals.discountTotal, currency)}</dd>
						</>
					) : null}
					{totals.taxes.map((tax) => (
						<TaxRow key={tax.rate} invoice={invoice} rate={tax.rate} amount={tax.amount} />
					))}
					<dt className="mt-2 border-t border-neutral-300 pt-3 font-semibold">Total due</dt>
					<dd
						className="mt-2 border-t border-neutral-300 pt-3 text-right text-[15px] font-semibold"
						style={{ color: accent }}
					>
						{money(totals.total, currency)}
						<span className="ml-1.5 font-mono text-[11px] font-normal text-neutral-500">
							{currency}
						</span>
					</dd>
				</dl>
			</section>

			<div className="mt-auto flex flex-col gap-8 pt-10">
				{invoice.notes.trim() || invoice.taxNotes.length > 0 ? (
					<section className="flex flex-col gap-1.5">
						{invoice.notes.trim() ? <p className="whitespace-pre-line">{invoice.notes}</p> : null}
						{invoice.taxNotes.map((note) => (
							<p key={note} className="text-neutral-500">
								{note}
							</p>
						))}
					</section>
				) : null}

				<section className="grid grid-cols-2 gap-10">
					<div>
						<Heading>Payment details</Heading>
						{invoice.paymentAccount ? (
							<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
								{invoice.paymentAccount.details.map((detail) => (
									<div key={`${detail.label}-${detail.value}`} className="contents">
										<dt className="text-neutral-500">{detail.label}</dt>
										<dd className="font-mono text-[12px] break-all">{detail.value}</dd>
									</div>
								))}
							</dl>
						) : (
							placeholder("No payment account")
						)}
					</div>
					{invoice.terms.trim() ? (
						<div>
							<Heading>Terms</Heading>
							<p className="whitespace-pre-line text-neutral-600">{invoice.terms}</p>
						</div>
					) : null}
				</section>

				<footer className="border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
					{[issuer.legalName || issuer.name, issuer.email, issuer.phone, issuer.website]
						.filter((part) => part.trim() !== "")
						.join("  ·  ")}
				</footer>
			</div>
		</article>
	);
}

function Party({
	label,
	party,
	empty,
}: {
	label: string;
	party: Omit<InvoiceSnapshot["client"], "contactName" | "phone"> & { contactName?: string };
	empty?: ReactNode;
}) {
	return (
		<div className="min-w-0">
			<Heading>{label}</Heading>
			{party.name ? (
				<div className="flex flex-col">
					<span className="font-medium">{party.name}</span>
					{party.contactName ? <span>{party.contactName}</span> : null}
					{addressLines(party.address).map((line) => (
						<span key={line}>{line}</span>
					))}
					{party.email ? <span className="text-neutral-500">{party.email}</span> : null}
					{party.taxId ? (
						<span className="text-neutral-500">
							Tax ID <span className="font-mono text-[12px]">{party.taxId}</span>
						</span>
					) : null}
				</div>
			) : (
				empty
			)}
		</div>
	);
}

function TaxRow({
	invoice,
	rate,
	amount,
}: {
	invoice: InvoiceSnapshot;
	rate: number;
	amount: number;
}) {
	return (
		<>
			<Label>Tax {percent(rate)}</Label>
			<dd className="text-right">{money(amount, invoice.currency)}</dd>
		</>
	);
}

const Heading = ({ children }: { children: ReactNode }) => (
	<h3 className="mb-2 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
		{children}
	</h3>
);

const Label = ({ children }: { children: ReactNode }) => (
	<dt className="text-neutral-500">{children}</dt>
);

const Muted = ({ children }: { children: ReactNode }) => (
	<span className="text-neutral-400 italic">{children}</span>
);
