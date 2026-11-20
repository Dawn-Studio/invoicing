import { date, money } from "./format";
import {
	Closing,
	Fact,
	Heading,
	InvoiceNumber,
	ItemsTable,
	Logo,
	onAccent,
	Party,
	PaymentDetails,
	placeholderFor,
	Sheet,
	Totals,
} from "./parts";
import type { TemplateProps } from "./types";

/** A full-height accent column on the left with your details, the dates and how to pay. */
export function SidebarTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const ink = onAccent(accent);
	const soft = ink === "#ffffff" ? "rgba(255,255,255,0.65)" : "rgba(23,23,23,0.6)";
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp}>
			<div className="flex flex-1">
				<aside
					className="flex w-[250px] shrink-0 flex-col gap-7 px-7 py-12"
					style={{ backgroundColor: accent, color: ink }}
				>
					<div className="rounded-md bg-white p-3 text-neutral-900">
						<Logo
							invoice={invoice}
							logoSrc={logoSrc}
							draft={draft}
							className="max-h-12 max-w-full"
						/>
					</div>
					<div>
						<div className="text-[11px] tracking-[0.2em] uppercase" style={{ color: soft }}>
							Invoice
						</div>
						<div className="mt-1 text-[18px] font-semibold">
							<InvoiceNumber invoice={invoice} draft={draft} />
						</div>
					</div>
					<Fact label="Issued" labelColor={soft}>
						{date(invoice.issueDate)}
					</Fact>
					<Fact label="Due" labelColor={soft}>
						{date(invoice.dueDate)}
					</Fact>
					<Fact label="Amount due" labelColor={soft}>
						<span className="text-[20px] font-semibold tabular-nums">
							{money(invoice.totals.total, invoice.currency)}
						</span>
					</Fact>
					<div className="mt-auto">
						<Heading color={soft}>Pay to</Heading>
						<PaymentDetails invoice={invoice} draft={draft} labelColor={soft} />
					</div>
				</aside>
				<div className="flex min-w-0 flex-1 flex-col px-10 py-12">
					<section className="grid grid-cols-2 gap-8">
						<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
						<Party label="From" party={invoice.issuer} />
					</section>
					<div className="mt-10">
						<ItemsTable
							invoice={invoice}
							draft={draft}
							headClassName="border-b-2"
							headStyle={{ borderColor: accent }}
						/>
					</div>
					<section className="mt-6 flex justify-end">
						<Totals invoice={invoice} accent={accent} className="w-[260px]" />
					</section>
					<Closing invoice={invoice} draft={draft} branding={branding} payment={false} />
				</div>
			</div>
		</Sheet>
	);
}
