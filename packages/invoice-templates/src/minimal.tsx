import { Closing, Dates, ItemsTable, Logo, Party, placeholderFor, Sheet, Totals } from "./parts";
import type { TemplateProps } from "./types";

/** Quiet and typographic: one thin accent rule, everything aligned to a left column. */
export function MinimalTemplate({
	invoice,
	logoSrc,
	draft = false,
	stamp,
	branding,
}: TemplateProps) {
	const accent = branding.accentColor;
	const placeholder = placeholderFor(draft);
	return (
		<Sheet branding={branding} stamp={stamp} className="px-16 py-16">
			<header
				className={`flex items-start justify-between gap-10 ${branding.logoPosition === "right" ? "flex-row-reverse" : ""}`}
			>
				<Logo
					invoice={invoice}
					logoSrc={logoSrc}
					draft={draft}
					className="max-h-12 max-w-[200px]"
				/>
				<Dates invoice={invoice} />
			</header>

			<div className="mt-14 h-px w-16" style={{ backgroundColor: accent }} />
			<h1 className="mt-6 text-[32px] leading-none font-light tracking-tight">
				Invoice{" "}
				<span className="text-neutral-400">
					{invoice.number || placeholder("number assigned on issue")}
				</span>
			</h1>

			<section className="mt-12 grid grid-cols-2 gap-10">
				<Party label="Billed to" party={invoice.client} empty={placeholder("Choose a client")} />
				<Party label="From" party={invoice.issuer} />
			</section>

			<div className="mt-12">
				<ItemsTable invoice={invoice} draft={draft} headClassName="border-b border-neutral-900" />
			</div>
			<section className="mt-6 flex justify-end">
				<Totals invoice={invoice} />
			</section>

			<Closing invoice={invoice} draft={draft} branding={branding} />
		</Sheet>
	);
}
