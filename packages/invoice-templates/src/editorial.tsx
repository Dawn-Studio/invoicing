import type { ReactNode } from "react";
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

function Row({ label, accent, children }: { label: string; accent: string; children: ReactNode }) {
	return (
		<section className="grid grid-cols-[130px_1fr] gap-6 border-t border-neutral-200 pt-5">
			<div
				className="text-[11px] font-medium tracking-[0.18em] uppercase"
				style={{ color: accentInk(accent) }}
			>
				{label}
			</div>
			<div className="min-w-0">{children}</div>
		</section>
	);
}

/** Magazine-like: a large light number, and every section labelled in a left margin. */
export function EditorialTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="gap-8 px-14 py-14">
			<header
				className={`flex items-start justify-between gap-8 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-12 max-w-[200px]"
				/>
				<div className="text-right text-neutral-500">
					<div>{date(invoice.issueDate)}</div>
					<div>Due {date(invoice.dueDate)}</div>
				</div>
			</header>
			<h1 className="text-[56px] leading-none font-extralight tracking-[-0.04em]">
				<span className="text-neutral-300">No.</span>{" "}
				<InvoiceNumber invoice={invoice} draft={draft} />
			</h1>
			<Row label="Parties" accent={accent}>
				<div className="grid grid-cols-2 gap-8">
					<Party label="Billed to" party={invoice.client} empty={placeholder("Choose a client")} />
					<Party label="From" party={invoice.issuer} />
				</div>
			</Row>
			<Row label="Work" accent={accent}>
				<ItemsTable invoice={invoice} draft={draft} headClassName="border-b border-neutral-200" />
				<div className="mt-5 flex justify-end">
					<Totals invoice={invoice} accent={accent} />
				</div>
			</Row>
			<Closing invoice={invoice} draft={draft} branding={branding} className="pt-0" />
		</Sheet>
	);
}
