import { date, money } from "./format";
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

/** A narrow centred column with dashed rules, like a well-made receipt. */
export function ReceiptTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	const dashed = "border-t border-dashed border-neutral-400";
	return (
		<Sheet branding={branding} stamp={stamp} className="items-center px-14 py-12">
			<div className="flex w-full max-w-[520px] flex-1 flex-col">
				<header className="flex flex-col items-center gap-3 text-center">
					<Logo
						invoice={invoice}
						logoSrc={logoSrc}
						draft={draft}
						className="max-h-14 max-w-[200px]"
					/>
					<div className="text-[11px] tracking-[0.3em] text-neutral-500 uppercase">Invoice</div>
					<div className="font-mono text-[13px]">
						<InvoiceNumber invoice={invoice} draft={draft} />
					</div>
				</header>
				<div className={`mt-6 ${dashed}`} />
				<section className="mt-5 grid grid-cols-2 gap-6">
					<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
					<dl className="grid grid-cols-[auto_auto] content-start justify-end gap-x-4 gap-y-1 text-right">
						<dt className="text-neutral-500">Issued</dt>
						<dd>{date(invoice.issueDate)}</dd>
						<dt className="text-neutral-500">Due</dt>
						<dd>{date(invoice.dueDate)}</dd>
					</dl>
				</section>
				<div className={`mt-5 ${dashed}`} />
				<div className="mt-2">
					<ItemsTable
						invoice={invoice}
						draft={draft}
						dense
						headClassName="border-b border-dashed border-neutral-400"
					/>
				</div>
				<section className="mt-5 flex justify-end">
					<Totals invoice={invoice} accent={accent} className="w-full" />
				</section>
				<div className={`mt-6 ${dashed}`} />
				<div className="mt-4 text-center">
					<div className="text-[11px] tracking-[0.2em] text-neutral-500 uppercase">Amount due</div>
					<div
						className="mt-1 text-[26px] font-semibold tabular-nums"
						style={{ color: accentInk(accent) }}
					>
						{money(invoice.totals.total, invoice.currency)}
					</div>
					<div className="text-neutral-500">by {date(invoice.dueDate)}</div>
				</div>
				<Closing invoice={invoice} draft={draft} branding={branding} />
			</div>
		</Sheet>
	);
}
