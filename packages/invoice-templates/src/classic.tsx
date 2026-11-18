import { Closing, Dates, ItemsTable, Logo, Party, placeholderFor, Sheet, Totals } from "./parts";
import type { TemplateProps } from "./types";

/**
 * The default: logo and title across the top, both parties side by side, the line items,
 * totals on the right and payment details at the bottom.
 */
export function ClassicTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="px-14 py-14">
			<header
				className={`flex items-start justify-between gap-10 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<div className="flex min-h-14 max-w-[300px] items-center">
					<Logo invoice={invoice} logoSrc={logoSrc} draft={draft} />
				</div>
				<div className={branding.logoPosition === "right" ? "text-left" : "text-right"}>
					<div
						className="text-[28px] leading-none font-semibold tracking-tight"
						style={{ color: accent }}
					>
						Invoice
					</div>
					<div className="mt-2 font-mono text-[12px] text-neutral-500">
						{invoice.number || placeholder("Number assigned on issue")}
						{draft && invoice.number ? " · draft" : null}
					</div>
				</div>
			</header>

			<section className="mt-12 grid grid-cols-[1fr_1fr_auto] gap-10">
				<Party label="From" party={invoice.issuer} />
				<Party label="Bill to" party={invoice.client} empty={placeholder("Choose a client")} />
				<Dates invoice={invoice} />
			</section>

			<div className="mt-12">
				<ItemsTable invoice={invoice} draft={draft} />
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} accent={accent} />
			</section>

			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
