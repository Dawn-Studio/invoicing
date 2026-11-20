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
	tint,
} from "./parts";
import type { TemplateProps } from "./types";

/** Playful: accent circles in the corner, rounded shapes, a friendly tone. */
export function GeometricTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="overflow-hidden px-14 py-14">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full"
				style={{ backgroundColor: tint(accent, 0.9) }}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-24 right-36 size-20 rounded-full"
				style={{ backgroundColor: tint(accent, 0.3) }}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute -bottom-16 -left-16 size-40 rounded-full border-[18px]"
				style={{ borderColor: tint(accent, 0.15) }}
			/>
			<header className="relative">
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-12 max-w-[200px]"
				/>
				<h1 className="mt-12 text-[44px] leading-none font-semibold tracking-tight">Invoice</h1>
				<div className="mt-2 font-mono text-[12px] text-neutral-500">
					<InvoiceNumber invoice={invoice} draft={draft} />
				</div>
			</header>
			<section className="relative mt-10 grid grid-cols-[1fr_1fr_auto] gap-8">
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				<div className="flex flex-col gap-3">
					<Fact label="Issued">{date(invoice.issueDate)}</Fact>
					<Fact label="Due">{date(invoice.dueDate)}</Fact>
				</div>
				<div className="rounded-2xl px-5 py-4" style={{ backgroundColor: tint(accent, 0.1) }}>
					<div className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
						Amount due
					</div>
					<div
						className="mt-1 text-[22px] font-semibold tabular-nums"
						style={{ color: accentInk(accent) }}
					>
						{money(invoice.totals.total, invoice.currency)}
					</div>
				</div>
			</section>
			<div className="relative mt-10">
				<ItemsTable
					invoice={invoice}
					draft={draft}
					variant="striped"
					stripeColor={tint(accent, 0.05)}
					headClassName="border-b-2"
					headStyle={{ borderColor: accent }}
				/>
			</div>
			<section className="relative mt-6 flex justify-between gap-8">
				<Party label="From" party={invoice.issuer} />
				<Totals invoice={invoice} accent={accent} filled />
			</section>
			<Closing invoice={invoice} draft={draft} branding={branding} className="relative" />
		</Sheet>
	);
}
