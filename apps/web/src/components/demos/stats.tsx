import { useRef } from "react";
import { useCountUp, useVisible } from "./shared";

const STATS = [
	{ value: 60, suffix: " s", label: "From a blank page to a sent invoice" },
	{ value: 0, suffix: "", label: "Accounts to create. It's your computer" },
	{ value: 10, suffix: "", label: "Colour palettes, light and dark" },
	{ value: 3, suffix: "", label: "Platforms: macOS, Windows, Linux" },
];

/** Numbers that count up as they scroll in, in tiles like the app's dashboard. */
export function Stats() {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref, true);
	return (
		<div ref={ref} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{STATS.map((stat, index) => (
				<Stat key={stat.label} {...stat} visible={visible} delay={index * 0.12} />
			))}
		</div>
	);
}

function Stat({
	value,
	suffix,
	label,
	visible,
	delay,
}: {
	value: number;
	suffix: string;
	label: string;
	visible: boolean;
	delay: number;
}) {
	const current = useCountUp(value, visible, 1.4 + delay);
	return (
		<div className="rounded-xl border bg-card p-5">
			<p className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
				{Math.round(current)}
				<span className="text-brand-ink">{suffix}</span>
			</p>
			<p className="mt-2 text-sm text-muted-foreground">{label}</p>
		</div>
	);
}
