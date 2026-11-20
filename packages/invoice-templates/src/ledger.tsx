import { date } from "./format";
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

/** An accountant's sheet: boxed details, a fully ruled table, figures that line up. */
export function LedgerTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	const cell = "border border-neutral-300 px-3 py-2";
	return (
		<Sheet branding={branding} stamp={stamp} className="px-14 py-12">
			<header
				className={`flex items-end justify-between gap-8 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-14 max-w-[220px]"
				/>
				<div
					className="text-[22px] font-semibold tracking-tight uppercase"
					style={{ color: accentInk(accent) }}
				>
					Invoice
				</div>
			</header>
			<table className="mt-8 w-full border-collapse text-[12px]">
				<tbody>
					<tr>
						<th className={`${cell} w-[18%] bg-neutral-100 text-left font-medium text-neutral-600`}>
							Invoice no.
						</th>
						<td className={`${cell} font-mono`}>
							<InvoiceNumber invoice={invoice} draft={draft} />
						</td>
						<th className={`${cell} w-[18%] bg-neutral-100 text-left font-medium text-neutral-600`}>
							Issued
						</th>
						<td className={cell}>{date(invoice.issueDate)}</td>
					</tr>
					<tr>
						<th className={`${cell} bg-neutral-100 text-left font-medium text-neutral-600`}>
							Currency
						</th>
						<td className={`${cell} font-mono`}>{invoice.currency}</td>
						<th className={`${cell} bg-neutral-100 text-left font-medium text-neutral-600`}>Due</th>
						<td className={cell}>{date(invoice.dueDate)}</td>
					</tr>
				</tbody>
			</table>
			<section className="mt-8 grid grid-cols-2 gap-0">
				<div className="border border-neutral-300 p-4">
					<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				</div>
				<div className="border border-l-0 border-neutral-300 p-4">
					<Party label="From" party={invoice.issuer} />
				</div>
			</section>
			<div className="mt-8">
				<ItemsTable
					invoice={invoice}
					draft={draft}
					variant="grid"
					headClassName="bg-neutral-100 text-neutral-600"
				/>
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} accent={accent} />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
