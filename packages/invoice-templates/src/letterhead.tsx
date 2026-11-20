import { addressLines, date } from "./format";
import {
	accentInk,
	Closing,
	InvoiceNumber,
	ItemsTable,
	Logo,
	Party,
	placeholderFor,
	Sheet,
	Totals,
} from "./parts";
import type { TemplateProps } from "./types";

/** Formal: a centred letterhead with your address, double rules, and a letter-like layout. */
export function LetterheadTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	const { issuer } = invoice;
	return (
		<Sheet branding={branding} stamp={stamp} className="px-16 py-14">
			<header className="flex flex-col items-center gap-3 text-center">
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-16 max-w-[260px]"
				/>
				<div className="text-[11px] tracking-[0.15em] text-neutral-500 uppercase">
					{[...addressLines(issuer.address), issuer.email, issuer.phone]
						.filter(Boolean)
						.join("  ·  ")}
				</div>
			</header>
			<div className="mt-6 border-t-[3px] border-double" style={{ borderColor: accent }} />
			<section className="mt-10 flex items-start justify-between gap-10">
				<Party label="Addressed to" party={invoice.client} empty={placeholder("Choose a client")} />
				<dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-right">
					<dt className="text-neutral-500">Invoice</dt>
					<dd className="font-medium">
						<InvoiceNumber invoice={invoice} draft={draft} />
					</dd>
					<dt className="text-neutral-500">Date</dt>
					<dd>{date(invoice.issueDate)}</dd>
					<dt className="text-neutral-500">Payable by</dt>
					<dd>{date(invoice.dueDate)}</dd>
				</dl>
			</section>
			<h1
				className="mt-12 text-center text-[13px] font-semibold tracking-[0.35em] uppercase"
				style={{ color: accentInk(accent) }}
			>
				Invoice
			</h1>
			<div className="mt-6">
				<ItemsTable invoice={invoice} draft={draft} headClassName="border-y border-neutral-400" />
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} accent={accent} />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
