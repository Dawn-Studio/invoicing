import type { ReactNode } from "react";
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
	tint,
} from "./parts";
import type { TemplateProps } from "./types";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<div className={`rounded-xl border border-neutral-200 bg-neutral-50/70 p-5 ${className}`}>
			{children}
		</div>
	);
}

/** Soft cards for each part of the invoice, like an app screen printed out. */
export function BoxedTemplate({ invoice, logoSrc, draft = false, stamp, branding }: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="gap-4 px-12 py-12">
			<Card className="flex items-center justify-between gap-6">
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-12 max-w-[200px]"
				/>
				<div className="text-right">
					<span
						className="rounded-md px-2 py-1 text-[11px] font-semibold tracking-wider uppercase"
						style={{ backgroundColor: tint(accent, 0.12), color: accentInk(accent) }}
					>
						Invoice
					</span>
					<div className="mt-2 text-[16px] font-semibold">
						<InvoiceNumber invoice={invoice} draft={draft} />
					</div>
				</div>
			</Card>
			<div className="grid grid-cols-[1fr_1fr_auto] gap-4">
				<Card>
					<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				</Card>
				<Card>
					<Party label="From" party={invoice.issuer} />
				</Card>
				<Card className="flex flex-col gap-3">
					<Fact label="Issued">{date(invoice.issueDate)}</Fact>
					<Fact label="Due">{date(invoice.dueDate)}</Fact>
				</Card>
			</div>
			<Card className="bg-white">
				<ItemsTable invoice={invoice} draft={draft} />
				<div className="mt-5 flex justify-end">
					<Totals invoice={invoice} accent={accent} filled />
				</div>
			</Card>
			<Closing invoice={invoice} draft={draft} branding={branding} className="pt-4" />
		</Sheet>
	);
}
