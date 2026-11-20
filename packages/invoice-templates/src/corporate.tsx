import { addressLines, date } from "./format";
import {
	Closing,
	InvoiceNumber,
	ItemsTable,
	Logo,
	onAccent,
	Party,
	placeholderFor,
	Sheet,
	Totals,
} from "./parts";
import type { TemplateProps } from "./types";

/** Structured and formal: company details up top, a details table, accent table header. */
export function CorporateTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const ink = onAccent(accent);
	const placeholder = placeholderFor(draft);
	const { issuer } = invoice;
	const cell = "border border-neutral-300 px-3 py-1.5";
	return (
		<Sheet branding={branding} stamp={stamp} className="px-14 py-12">
			<header
				className={`flex items-start justify-between gap-8 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-14 max-w-[220px]"
				/>
				<div
					className={`flex flex-col text-[12px] text-neutral-600 ${branding.logoPosition === "right" ? "text-left" : "text-right"}`}
				>
					<span className="font-semibold text-neutral-900">{issuer.legalName || issuer.name}</span>
					{addressLines(issuer.address).map((line) => (
						<span key={line}>{line}</span>
					))}
					{issuer.taxId ? <span>Tax ID {issuer.taxId}</span> : null}
				</div>
			</header>
			<div
				className="mt-8 flex items-end justify-between gap-8 border-b-2 pb-3"
				style={{ borderColor: accent }}
			>
				<h1 className="text-[26px] font-semibold tracking-tight">Invoice</h1>
				<table className="border-collapse text-[12px]">
					<tbody>
						<tr>
							<th className={`${cell} bg-neutral-100 text-left font-medium`}>Number</th>
							<th className={`${cell} bg-neutral-100 text-left font-medium`}>Date</th>
							<th className={`${cell} bg-neutral-100 text-left font-medium`}>Due</th>
						</tr>
						<tr>
							<td className={`${cell} font-mono`}>
								<InvoiceNumber invoice={invoice} draft={draft} />
							</td>
							<td className={cell}>{date(invoice.issueDate)}</td>
							<td className={cell}>{date(invoice.dueDate)}</td>
						</tr>
					</tbody>
				</table>
			</div>
			<section className="mt-8">
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
			</section>
			<div className="mt-8">
				<ItemsTable
					invoice={invoice}
					draft={draft}
					variant="striped"
					headClassName="[&>th]:px-2"
					headStyle={{ backgroundColor: accent, color: ink }}
				/>
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} accent={accent} filled />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
