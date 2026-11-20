import { date, money } from "./format";
import {
	accentInk,
	Closing,
	InvoiceNumber,
	ItemsTable,
	Logo,
	Party,
	PaymentDetails,
	placeholderFor,
	Sheet,
	Totals,
	tint,
} from "./parts";
import type { TemplateProps } from "./types";

/** Leads with what matters to the client: how much, by when, and where to pay. */
export function StatementTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
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
				<div className="text-right text-neutral-500">
					Invoice{" "}
					<span className="font-medium text-neutral-900">
						<InvoiceNumber invoice={invoice} draft={draft} />
					</span>
					<div>Issued {date(invoice.issueDate)}</div>
				</div>
			</header>
			<section
				className="mt-10 grid grid-cols-[1.3fr_1fr] overflow-hidden rounded-xl border"
				style={{ borderColor: tint(accent, 0.35) }}
			>
				<div className="px-7 py-6" style={{ backgroundColor: tint(accent, 0.08) }}>
					<div className="text-neutral-600">Please pay</div>
					<div
						className="mt-1 text-[40px] leading-none font-semibold tracking-tight tabular-nums"
						style={{ color: accentInk(accent) }}
					>
						{money(invoice.totals.total, invoice.currency)}
					</div>
					<div className="mt-3 text-[15px]">
						by <span className="font-semibold">{date(invoice.dueDate)}</span>
					</div>
				</div>
				<div className="px-7 py-6">
					<div className="mb-2 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
						To
					</div>
					<PaymentDetails invoice={invoice} draft={draft} />
				</div>
			</section>
			<section className="mt-10 grid grid-cols-2 gap-10">
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				<Party label="From" party={invoice.issuer} />
			</section>
			<div className="mt-10">
				<ItemsTable invoice={invoice} draft={draft} />
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} accent={accent} />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} payment={false} />
		</Sheet>
	);
}
