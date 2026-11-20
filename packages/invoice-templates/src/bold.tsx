import { date, money } from "./format";
import {
	accentInk,
	Closing,
	Fact,
	InvoiceNumber,
	ItemsTable,
	Logo,
	Party,
	placeholderFor,
	Sheet,
	Totals,
} from "./parts";
import type { TemplateProps } from "./types";

/** A huge "Invoice" and an oversized total: loud, confident, unmistakable. */
export function BoldTemplate({ invoice, logoSrc, draft = false, stamp, branding }: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="px-14 py-12">
			<header
				className={`flex items-center justify-between gap-8 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-12 max-w-[200px]"
				/>
				<div className="font-mono text-[12px] text-neutral-500">
					<InvoiceNumber invoice={invoice} draft={draft} />
				</div>
			</header>
			<h1 className="mt-10 text-[96px] leading-[0.85] font-black tracking-[-0.06em] uppercase">
				Invoice
			</h1>
			<div className="mt-4 h-2 w-full" style={{ backgroundColor: accent }} />
			<section className="mt-8 grid grid-cols-[1fr_1fr_auto] gap-8">
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				<div className="flex flex-col gap-4">
					<Fact label="Issued">{date(invoice.issueDate)}</Fact>
					<Fact label="Due">{date(invoice.dueDate)}</Fact>
				</div>
				<div className="text-right">
					<div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
						Total due
					</div>
					<div
						className="mt-1 text-[36px] leading-none font-black tracking-tight tabular-nums"
						style={{ color: accentInk(accent) }}
					>
						{money(invoice.totals.total, invoice.currency)}
					</div>
				</div>
			</section>
			<div className="mt-10">
				<ItemsTable
					invoice={invoice}
					draft={draft}
					headClassName="border-b-2 border-neutral-900 text-neutral-900"
				/>
			</div>
			<section className="mt-6 flex justify-between gap-8">
				<Party label="From" party={invoice.issuer} />
				<Totals invoice={invoice} accent={accent} />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
