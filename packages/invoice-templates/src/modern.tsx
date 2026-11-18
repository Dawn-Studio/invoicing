import { date, money } from "./format";
import { Closing, ItemsTable, Logo, Party, placeholderFor, Sheet, Totals } from "./parts";
import type { TemplateProps } from "./types";

/** A bold accent bar, the amount due up top in a coloured block, tinted table header. */
export function ModernTemplate({
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
			<div className="h-2.5" style={{ backgroundColor: accent }} />
			<div className="flex flex-1 flex-col px-14 pt-12">
				<header
					className={`flex items-center justify-between gap-10 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
				>
					<Logo
						invoice={invoice}
						logoSrc={logoSrc}
						draft={draft}
						className="max-h-14 max-w-[220px]"
					/>
					<div className={branding.logoPosition === "right" ? "text-left" : "text-right"}>
						<div className="text-[11px] font-medium tracking-[0.2em] text-neutral-500 uppercase">
							Invoice
						</div>
						<div className="mt-1 text-[20px] font-semibold tracking-tight">
							{invoice.number || placeholder("Number on issue")}
							{draft && invoice.number ? (
								<span className="ml-2 text-[12px] font-normal text-neutral-400">draft</span>
							) : null}
						</div>
					</div>
				</header>

				<section
					className="mt-10 grid grid-cols-3 gap-6 rounded-xl px-7 py-6 text-white"
					style={{ backgroundColor: accent }}
				>
					<div>
						<div className="text-[11px] tracking-wider uppercase opacity-75">Amount due</div>
						<div className="mt-1 text-[24px] leading-tight font-semibold tabular-nums">
							{money(invoice.totals.total, invoice.currency)}
						</div>
					</div>
					<div>
						<div className="text-[11px] tracking-wider uppercase opacity-75">Due</div>
						<div className="mt-1 text-[15px] font-medium">{date(invoice.dueDate)}</div>
					</div>
					<div>
						<div className="text-[11px] tracking-wider uppercase opacity-75">Issued</div>
						<div className="mt-1 text-[15px] font-medium">{date(invoice.issueDate)}</div>
					</div>
				</section>

				<section className="mt-10 grid grid-cols-2 gap-10">
					<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
					<Party label="From" party={invoice.issuer} />
				</section>

				<div className="mt-10">
					<ItemsTable
						invoice={invoice}
						draft={draft}
						headClassName=""
						headStyle={{ backgroundColor: `${accent}14`, color: accent }}
					/>
				</div>
				<section className="mt-6 flex justify-end">
					<Totals invoice={invoice} accent={accent} />
				</section>

				<Closing invoice={invoice} draft={draft} branding={branding} />
			</div>
		</Sheet>
	);
}
