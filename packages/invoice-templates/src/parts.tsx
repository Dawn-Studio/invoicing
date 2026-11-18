import type { InvoiceSnapshot } from "@dawnstudio/core";
import type { CSSProperties, ReactNode } from "react";
import { addressLines, date, figure, money, percent, quantity } from "./format";
import { FONT_STACKS, PAGE_SIZES, type TemplateProps } from "./types";

/**
 * Building blocks shared by the templates. Colours are fixed (not theme tokens): invoices
 * are always printed on white.
 */

/** The sheet: page width, at least one page tall, grows (and paginates in PDFs) if longer. */
export function Sheet({
	branding,
	stamp,
	className = "",
	style,
	children,
}: Pick<TemplateProps, "branding" | "stamp"> & {
	className?: string;
	style?: CSSProperties;
	children: ReactNode;
}) {
	const size = PAGE_SIZES[branding.paperSize];
	return (
		<article
			className={`invoice-sheet relative flex flex-col bg-white text-[13px] leading-[1.5] text-neutral-900 antialiased select-text ${className}`}
			style={{
				width: size.width,
				minHeight: size.height,
				fontFamily: FONT_STACKS[branding.font],
				...style,
			}}
		>
			{stamp ? (
				<div className="invoice-stamp pointer-events-none absolute top-[300px] left-1/2 z-10 -translate-x-1/2 -rotate-12 rounded-lg border-4 border-red-500/60 px-6 py-1 text-5xl font-bold tracking-[0.2em] text-red-500/60 uppercase">
					{stamp}
				</div>
			) : null}
			{children}
		</article>
	);
}

export const Muted = ({ children }: { children: ReactNode }) => (
	<span className="text-neutral-400 italic">{children}</span>
);

/** Placeholder text, shown only while editing a draft. */
export const placeholderFor = (draft: boolean) => (text: string) =>
	draft ? <Muted>{text}</Muted> : null;

export const Heading = ({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) => (
	<h3
		className={`mb-2 text-[11px] font-medium tracking-wider text-neutral-500 uppercase ${className}`}
	>
		{children}
	</h3>
);

export function Logo({
	invoice,
	logoSrc,
	draft,
	className = "max-h-16 max-w-[240px]",
}: Pick<TemplateProps, "invoice" | "logoSrc" | "draft"> & { className?: string }) {
	if (logoSrc) return <img src={logoSrc} alt="" className={`object-contain ${className}`} />;
	return (
		<div className="text-xl font-semibold tracking-tight">
			{invoice.issuer.name || placeholderFor(Boolean(draft))("Your business")}
		</div>
	);
}

type PartyDetails = Omit<InvoiceSnapshot["client"], "contactName" | "phone"> & {
	contactName?: string;
};

export function Party({
	label,
	party,
	empty,
}: {
	label: string;
	party: PartyDetails;
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

/** The line-item table. `headClassName` styles the header row (templates differ there). */
export function ItemsTable({
	invoice,
	draft,
	headClassName = "border-b border-neutral-300",
	headStyle,
}: Pick<TemplateProps, "invoice" | "draft"> & {
	headClassName?: string;
	headStyle?: CSSProperties;
}) {
	const { currency } = invoice;
	const showTax = invoice.items.some((item) => item.taxRate > 0);
	const showUnits = invoice.items.some((item) => item.unit.trim() !== "");
	const placeholder = placeholderFor(Boolean(draft));
	return (
		<table className="w-full border-collapse tabular-nums">
			<thead>
				<tr
					className={`text-left text-[11px] tracking-wider text-neutral-500 uppercase ${headClassName}`}
					style={headStyle}
				>
					<th className="py-2 pr-4 pl-0 font-medium">Description</th>
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
						<tr key={index} className="break-inside-avoid border-b border-neutral-200 align-top">
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
	);
}

/** Subtotal, discount, tax per rate and the total. */
export function Totals({
	invoice,
	accent,
	className = "w-[300px]",
}: {
	invoice: InvoiceSnapshot;
	accent?: string;
	className?: string;
}) {
	const { totals, currency } = invoice;
	return (
		<dl className={`grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 tabular-nums ${className}`}>
			<dt className="text-neutral-500">Subtotal</dt>
			<dd className="text-right">{money(totals.subtotal, currency)}</dd>
			{totals.discountTotal > 0 ? (
				<>
					<dt className="text-neutral-500">
						Discount
						{invoice.discount?.type === "percent" ? ` (${percent(invoice.discount.value)})` : ""}
					</dt>
					<dd className="text-right">−{money(totals.discountTotal, currency)}</dd>
				</>
			) : null}
			{totals.taxes.map((tax) => (
				<div key={tax.rate} className="contents">
					<dt className="text-neutral-500">Tax {percent(tax.rate)}</dt>
					<dd className="text-right">{money(tax.amount, currency)}</dd>
				</div>
			))}
			{/* One row with one rule across both columns. */}
			<div className="col-span-2 mt-2 flex items-baseline justify-between gap-6 border-t border-neutral-300 pt-3">
				<dt className="font-semibold">Total due</dt>
				<dd className="text-right text-[15px] font-semibold" style={{ color: accent }}>
					{money(totals.total, currency)}
					<span className="ml-1.5 font-mono text-[11px] font-normal text-neutral-500">
						{currency}
					</span>
				</dd>
			</div>
		</dl>
	);
}

export function Dates({ invoice }: { invoice: InvoiceSnapshot }) {
	return (
		<dl className="grid grid-cols-[auto_auto] content-start gap-x-6 gap-y-1">
			<dt className="text-neutral-500">Issued</dt>
			<dd className="text-right">{date(invoice.issueDate)}</dd>
			<dt className="text-neutral-500">Due</dt>
			<dd className="text-right">{date(invoice.dueDate)}</dd>
		</dl>
	);
}

/** Notes, tax notes, payment details, terms and the footer: the bottom of the page. */
export function Closing({
	invoice,
	draft,
	branding,
}: Pick<TemplateProps, "invoice" | "draft" | "branding">) {
	const { issuer } = invoice;
	const placeholder = placeholderFor(Boolean(draft));
	const contact = [issuer.legalName || issuer.name, issuer.email, issuer.phone, issuer.website]
		.filter((part) => part.trim() !== "")
		.join("  ·  ");
	return (
		<div className="mt-auto flex break-inside-avoid flex-col gap-8 pt-10">
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

			<footer className="flex flex-col gap-1 border-t border-neutral-200 pt-4 text-[11px] text-neutral-500">
				<span>{contact}</span>
				{branding.footer.trim() ? (
					<span className="whitespace-pre-line">{branding.footer}</span>
				) : null}
			</footer>
		</div>
	);
}
