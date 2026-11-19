import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { LayoutGroup, motion } from "motion/react";
import { useState } from "react";
import { money, Window } from "./shared";

const TEMPLATES = ["Classic", "Modern", "Minimal"] as const;
const ACCENTS = ["#1f7a4d", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#141710"];
const FONTS = [
	{ label: "Sans", family: '"Be Vietnam Pro", ui-sans-serif, sans-serif' },
	{ label: "Serif", family: '"Source Serif 4 Variable", Georgia, serif' },
	{ label: "Mono", family: '"Geist Mono Variable", ui-monospace, monospace' },
];

type Template = (typeof TEMPLATES)[number];

/** Pick a template, colour and font; the invoice re-lays itself out like the app's preview. */
export function DesignPlayground() {
	const [template, setTemplate] = useState<Template>("Classic");
	const [accent, setAccent] = useState(ACCENTS[0] as string);
	const [font, setFont] = useState(FONTS[0] as (typeof FONTS)[number]);

	return (
		<Window
			title="Settings · Invoice design"
			bodyClassName="grid md:grid-cols-[15rem_minmax(0,1fr)]"
		>
			<div className="flex flex-col gap-6 border-b p-5 md:border-r md:border-b-0">
				<Control label="Template">
					<Segmented options={TEMPLATES} value={template} onChange={setTemplate} id="template" />
				</Control>
				<Control label="Accent">
					<div className="flex flex-wrap gap-2">
						{ACCENTS.map((color) => (
							<button
								key={color}
								type="button"
								aria-label={`Accent ${color}`}
								aria-pressed={accent === color}
								onClick={() => setAccent(color)}
								className="relative size-7 rounded-full transition-transform hover:scale-110"
								style={{ backgroundColor: color }}
							>
								{accent === color ? (
									<motion.span
										layoutId="accent-ring"
										transition={transitions.snappy}
										className="absolute -inset-1 rounded-full border-2 border-foreground/80"
									/>
								) : null}
							</button>
						))}
					</div>
				</Control>
				<Control label="Font">
					<Segmented
						options={FONTS.map((f) => f.label)}
						value={font.label}
						onChange={(label) => setFont(FONTS.find((f) => f.label === label) ?? font)}
						id="font"
					/>
				</Control>
				<p className="mt-auto text-xs text-muted-foreground">
					Your logo goes on top. Every invoice you send keeps the look it had when you issued it.
				</p>
			</div>
			<div className="bg-background/40 p-4 sm:p-6">
				<LayoutGroup>
					<motion.div
						layout
						transition={transitions.smooth}
						className="overflow-hidden rounded-lg bg-white text-[#141710] shadow-xl"
						style={{ fontFamily: font.family }}
					>
						<Paper template={template} accent={accent} />
					</motion.div>
				</LayoutGroup>
			</div>
		</Window>
	);
}

function Paper({ template, accent }: { template: Template; accent: string }) {
	const bold = template === "Modern";
	const minimal = template === "Minimal";
	return (
		<>
			<motion.div
				layout
				transition={transitions.smooth}
				className={cn("flex items-start justify-between gap-4 p-6", bold && "text-white")}
				animate={{ backgroundColor: bold ? accent : "#ffffff" }}
			>
				<motion.div layout className="flex items-center gap-2">
					<motion.span
						layout
						animate={{
							backgroundColor: bold ? "#ffffff" : accent,
							color: bold ? accent : "#ffffff",
						}}
						className="flex size-7 items-center justify-center rounded-md text-xs font-bold"
					>
						D
					</motion.span>
					<span className="text-sm font-semibold">Dawn Studio</span>
				</motion.div>
				<motion.div layout className="text-right">
					<p
						className={cn(
							"text-[0.625rem] tracking-[0.18em] uppercase",
							bold ? "text-white/70" : "text-[#696d63]",
						)}
					>
						Invoice
					</p>
					<motion.p
						layout
						animate={{ color: bold ? "#ffffff" : minimal ? accent : "#141710" }}
						className="text-sm font-semibold"
					>
						INV-2026-0058
					</motion.p>
				</motion.div>
			</motion.div>
			{/* Classic's coloured strip under the header. */}
			<motion.div
				layout
				animate={{ height: template === "Classic" ? 4 : 0, backgroundColor: accent }}
				transition={transitions.smooth}
			/>
			<div className="flex flex-col gap-5 p-6 pt-5">
				<motion.div
					layout
					transition={transitions.smooth}
					className={cn("grid grid-cols-2 gap-4 rounded-md", !minimal && "p-3.5")}
					animate={{
						backgroundColor: template === "Classic" ? `${accent}14` : bold ? "#f4f5f1" : "#ffffff",
					}}
				>
					<div>
						<p className="text-[0.625rem] tracking-wider text-[#696d63] uppercase">Bill to</p>
						<p className="mt-1 text-sm font-medium">Nordlys AS</p>
						<p className="text-xs text-[#696d63]">Oslo, Norway</p>
					</div>
					<div className="text-right">
						<p className="text-[0.625rem] tracking-wider text-[#696d63] uppercase">Amount due</p>
						<motion.p
							layout
							animate={{ color: minimal ? "#141710" : accent }}
							className="mt-1 text-lg font-semibold"
						>
							{money(12140)}
						</motion.p>
					</div>
				</motion.div>
				<div className="text-sm">
					<motion.div
						layout
						animate={{
							color: minimal ? "#696d63" : accent,
							borderColor: minimal ? "#e5e7e0" : accent,
						}}
						className="grid grid-cols-[1fr_auto] border-b pb-1.5 text-[0.625rem] font-semibold tracking-wider uppercase"
					>
						<span>Description</span>
						<span>Amount</span>
					</motion.div>
					{[
						["Brand identity", 4200],
						["Marketing website", 6800],
						["Design support · 12 h", 1140],
					].map(([description, amount]) => (
						<div
							key={description}
							className="grid grid-cols-[1fr_auto] border-b border-[#eef0ea] py-2"
						>
							<span>{description}</span>
							<span className="tabular-nums">{money(amount as number, "EUR", 0)}</span>
						</div>
					))}
				</div>
				<div className="flex items-baseline justify-between">
					<span className="text-xs text-[#696d63]">Total due</span>
					<motion.span
						layout
						animate={{ color: accent }}
						className="text-xl font-semibold tabular-nums"
					>
						{money(12140)}
					</motion.span>
				</div>
			</div>
		</>
	);
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}

function Segmented<T extends string>({
	options,
	value,
	onChange,
	id,
}: {
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
	id: string;
}) {
	return (
		<div className="grid grid-flow-col gap-1 rounded-lg bg-muted p-1">
			{options.map((option) => (
				<button
					key={option}
					type="button"
					aria-pressed={value === option}
					onClick={() => onChange(option)}
					className={cn(
						"relative rounded-md px-2 py-1 text-xs font-medium transition-colors",
						value === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
					)}
				>
					{value === option ? (
						<motion.span
							layoutId={`segment-${id}`}
							transition={transitions.snappy}
							className="absolute inset-0 rounded-md bg-background shadow-sm"
						/>
					) : null}
					<span className="relative">{option}</span>
				</button>
			))}
		</div>
	);
}
