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

/** Black or white, whichever reads better on the accent (users pick any colour). */
export function onAccent(hex: string): string {
	const value = Number.parseInt(hex.slice(1), 16);
	const channel = (shift: number) => {
		const c = ((value >> shift) & 255) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
	return luminance > 0.45 ? "#171717" : "#ffffff";
}

/**
 * The accent for text on white: light accents (yellow, pastel) are darkened until they read,
 * dark ones are used as they are.
 */
export function accentInk(hex: string): string {
	if (onAccent(hex) === "#ffffff") return hex;
	const value = Number.parseInt(hex.slice(1), 16);
	const darken = (shift: number) =>
		Math.round(((value >> shift) & 255) * 0.5)
			.toString(16)
			.padStart(2, "0");
	return `#${darken(16)}${darken(8)}${darken(0)}`;
}

/** The accent at an opacity, as #rrggbbaa. */
export const tint = (hex: string, alpha: number) =>
	`${hex}${Math.round(alpha * 255)
		.toString(16)
		.padStart(2, "0")}`;

export const Muted = ({ children }: { children: ReactNode }) => (
	<span className="text-neutral-400 italic">{children}</span>
);

/** Placeholder text, shown only while editing a draft. */
export const placeholderFor = (draft: boolean) => (text: string) =>
	draft ? <Muted>{text}</Muted> : null;

/** A small uppercase label. `color` overrides the grey (e.g. on a coloured band). */
export const Heading = ({
	children,
	className = "",
	color,
}: {
	children: ReactNode;
	className?: string;
	color?: string;
}) => (
	<h3
		className={`mb-2 text-[11px] font-medium tracking-wider uppercase ${color ? "" : "text-neutral-500"} ${className}`}
		style={color ? { color } : undefined}
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

/**
 * The line-item table. `headClassName` styles the header row (templates differ there);
 * `variant` adds zebra rows or full cell borders, `dense` tightens rows for long invoices.
 */
export function ItemsTable({
	invoice,
	draft,
	headClassName = "border-b border-neutral-300",
	headStyle,
	variant = "plain",
	dense = false,
	stripeColor = "#f5f5f5",
}: Pick<TemplateProps, "invoice" | "draft"> & {
	headClassName?: string;
	headStyle?: CSSProperties;
	variant?: "plain" | "striped" | "grid";
	dense?: boolean;
	stripeColor?: string;
}) {
	const { currency } = invoice;
	const showTax = invoice.items.some((item) => item.taxRate > 0);
	const showUnits = invoice.items.some((item) => item.unit.trim() !== "");
	const placeholder = placeholderFor(Boolean(draft));
	const grid = variant === "grid";
	const y = dense ? "py-1.5" : "py-3";
	const cell = grid ? `border border-neutral-300 px-2.5 ${y}` : y;
	const head = grid ? "border border-neutral-300 px-2.5 py-2" : "py-2";
	const first = grid ? "" : "pr-4 pl-0";
	const rest = grid ? "" : "pl-4";
	return (
		<table className="w-full border-collapse tabular-nums">
			<thead>
				<tr
					className={`text-left text-[11px] tracking-wider text-neutral-500 uppercase ${headClassName}`}
					style={headStyle}
				>
					<th className={`${head} ${first} font-medium`}>Description</th>
					<th className={`${head} ${rest} text-right font-medium`}>Qty</th>
					{showUnits ? (
						<th className={`${head} ${grid ? "" : "pl-2"} text-left font-medium`}>Unit</th>
					) : null}
					<th className={`${head} ${rest} text-right font-medium`}>Rate</th>
					{showTax ? <th className={`${head} ${rest} text-right font-medium`}>Tax</th> : null}
					<th className={`${head} ${rest} text-right font-medium`}>Amount</th>
				</tr>
			</thead>
			<tbody>
				{invoice.items.length === 0 ? (
					<tr className="border-b border-neutral-200">
						<td colSpan={6} className={cell}>
							{placeholder("No line items yet")}
						</td>
					</tr>
				) : (
					invoice.items.map((item, index) => (
						<tr
							// Lines have no stable id in the snapshot; position is the identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							key={index}
							className={`break-inside-avoid align-top ${grid ? "" : "border-b border-neutral-200"}`}
							style={
								variant === "striped" && index % 2 === 1
									? { backgroundColor: stripeColor }
									: undefined
							}
						>
							<td
								className={`${cell} ${first} ${variant === "striped" ? "pl-2" : ""} whitespace-pre-line`}
							>
								{item.description || placeholder("Description")}
							</td>
							<td className={`${cell} ${rest} text-right`}>{quantity(item.quantity)}</td>
							{showUnits ? (
								<td className={`${cell} ${grid ? "" : "pl-2"} text-neutral-500`}>{item.unit}</td>
							) : null}
							<td className={`${cell} ${rest} text-right`}>{figure(item.unitPrice, currency)}</td>
							{showTax ? (
								<td className={`${cell} ${rest} text-right text-neutral-500`}>
									{item.taxRate > 0 ? percent(item.taxRate) : "—"}
								</td>
							) : null}
							<td className={`${cell} ${rest} ${variant === "striped" ? "pr-2" : ""} text-right`}>
								{figure(item.amount, currency)}
							</td>
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
	filled = false,
}: {
	invoice: InvoiceSnapshot;
	accent?: string;
	className?: string;
	/** The total on a solid accent bar instead of under a rule. */
	filled?: boolean;
}) {
	const { totals, currency } = invoice;
	const fill = filled && accent ? { backgroundColor: accent, color: onAccent(accent) } : null;
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
			<div
				className={`col-span-2 mt-2 flex items-baseline justify-between gap-6 ${fill ? "rounded-md px-3 py-2.5" : "border-t border-neutral-300 pt-3"}`}
				style={fill ?? undefined}
			>
				<dt className="font-semibold">Total due</dt>
				<dd
					className="text-right text-[15px] font-semibold"
					style={fill || !accent ? undefined : { color: accentInk(accent) }}
				>
					{money(totals.total, currency)}
					<span
						className={`ml-1.5 font-mono text-[11px] font-normal ${fill ? "opacity-75" : "text-neutral-500"}`}
					>
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

/** Where to pay: the payment account's details, label and value per line. */
export function PaymentDetails({
	invoice,
	draft,
	labelColor,
}: Pick<TemplateProps, "invoice" | "draft"> & { labelColor?: string }) {
	if (!invoice.paymentAccount) return placeholderFor(Boolean(draft))("No payment account");
	return (
		<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
			{invoice.paymentAccount.details.map((detail) => (
				<div key={`${detail.label}-${detail.value}`} className="contents">
					<dt
						className={labelColor ? "" : "text-neutral-500"}
						style={labelColor ? { color: labelColor } : undefined}
					>
						{detail.label}
					</dt>
					<dd className="font-mono text-[12px] break-all">{detail.value}</dd>
				</div>
			))}
		</dl>
	);
}

/** Notes, tax notes, payment details, terms and the footer: the bottom of the page. */
export function Closing({
	invoice,
	draft,
	branding,
	payment = true,
	className = "",
}: Pick<TemplateProps, "invoice" | "draft" | "branding"> & {
	/** False when the template shows payment details elsewhere. */
	payment?: boolean;
	className?: string;
}) {
	const { issuer } = invoice;
	const contact = [issuer.legalName || issuer.name, issuer.email, issuer.phone, issuer.website]
		.filter((part) => part.trim() !== "")
		.join("  ·  ");
	return (
		<div className={`mt-auto flex break-inside-avoid flex-col gap-8 pt-10 ${className}`}>
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
				{payment ? (
					<div>
						<Heading>Payment details</Heading>
						<PaymentDetails invoice={invoice} draft={draft} />
					</div>
				) : null}
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

/** A small labelled value: "Due" / "3 December 2026". */
export function Fact({
	label,
	children,
	className = "",
	labelColor,
}: {
	label: string;
	children: ReactNode;
	className?: string;
	labelColor?: string;
}) {
	return (
		<div className={className}>
			<Heading className="mb-1" color={labelColor}>
				{label}
			</Heading>
			<div>{children}</div>
		</div>
	);
}

/** The invoice number, or a hint while it's a draft without one. */
export function InvoiceNumber({ invoice, draft }: Pick<TemplateProps, "invoice" | "draft">) {
	return (
		<>
			{invoice.number || placeholderFor(Boolean(draft))("Number on issue")}
			{draft && invoice.number ? (
				<span className="ml-1.5 text-[0.75em] font-normal opacity-50">draft</span>
			) : null}
		</>
	);
}
