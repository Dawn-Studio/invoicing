import { date } from "./format";
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

/** Small type and tight rows, so long invoices (timesheets, many items) fit on one page. */
export function CompactTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="px-12 py-10 text-[12px] leading-[1.45]">
			<header
				className={`flex items-center justify-between gap-6 border-b pb-4 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
				style={{ borderColor: accent }}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-10 max-w-[180px]"
				/>
				<div className="flex items-baseline gap-3">
					<span className="text-[16px] font-semibold" style={{ color: accentInk(accent) }}>
						Invoice
					</span>
					<span className="font-mono text-neutral-500">
						<InvoiceNumber invoice={invoice} draft={draft} />
					</span>
				</div>
			</header>
			<section className="mt-5 grid grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr] gap-5">
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				<Party label="From" party={invoice.issuer} />
				<Fact label="Issued">{date(invoice.issueDate)}</Fact>
				<Fact label="Due">{date(invoice.dueDate)}</Fact>
			</section>
			<div className="mt-6">
				<ItemsTable
					invoice={invoice}
					draft={draft}
					dense
					variant="striped"
					headClassName="border-b border-neutral-300"
				/>
			</div>
			<section className="mt-4 flex justify-end">
				<Totals invoice={invoice} accent={accent} className="w-[260px]" />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} className="gap-5 pt-6" />
		</Sheet>
	);
}
