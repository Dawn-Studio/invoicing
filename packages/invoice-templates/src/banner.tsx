import { date, money } from "./format";
import {
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

/** A dark full-width banner with the essentials in white; the accent marks the total. */
export function BannerTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="pb-14">
			<header className="bg-neutral-900 px-14 pt-12 pb-10 text-white">
				<div
					className={`flex items-start justify-between gap-8 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
				>
					<div className="rounded-md bg-white px-3 py-2 text-neutral-900">
						<Logo
							invoice={invoice}
							logoSrc={logoSrc}
							draft={draft}
							className="max-h-10 max-w-[180px]"
						/>
					</div>
					<div className={branding.logoPosition === "right" ? "text-left" : "text-right"}>
						<div className="text-[30px] leading-none font-semibold tracking-tight">Invoice</div>
						<div className="mt-2 font-mono text-[12px] text-white/60">
							<InvoiceNumber invoice={invoice} draft={draft} />
						</div>
					</div>
				</div>
				<div className="mt-10 grid grid-cols-3 gap-6">
					<Fact label="Issued" labelColor="rgba(255,255,255,0.55)">
						{date(invoice.issueDate)}
					</Fact>
					<Fact label="Due" labelColor="rgba(255,255,255,0.55)">
						{date(invoice.dueDate)}
					</Fact>
					<Fact label="Amount due" labelColor="rgba(255,255,255,0.55)">
						<span className="text-[18px] font-semibold tabular-nums">
							{money(invoice.totals.total, invoice.currency)}
						</span>
					</Fact>
				</div>
			</header>
			<div className="h-1.5" style={{ backgroundColor: accent }} />
			<div className="flex flex-1 flex-col px-14 pt-10">
				<section className="grid grid-cols-2 gap-10">
					<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
					<Party label="From" party={invoice.issuer} />
				</section>
				<div className="mt-10">
					<ItemsTable invoice={invoice} draft={draft} headClassName="border-b border-neutral-900" />
				</div>
				<section className="mt-6 flex justify-end">
					<Totals invoice={invoice} accent={accent} />
				</section>
				<Closing invoice={invoice} draft={draft} branding={branding} />
			</div>
		</Sheet>
	);
}
