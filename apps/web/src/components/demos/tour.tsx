import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useVisible } from "./shared";

export interface TourShot {
	id: string;
	label: string;
	caption: string;
	src: string;
	srcSet: string;
	width: number;
	height: number;
	alt: string;
}

const ADVANCE_MS = 5500;

/** Real screenshots of the app, one tab each, advancing on their own until you pick one. */
export function Tour({ shots }: { shots: TourShot[] }) {
	const ref = useRef<HTMLDivElement>(null);
	const visible = useVisible(ref);
	const reduced = useReducedMotion();
	const [index, setIndex] = useState(0);
	const [auto, setAuto] = useState(!reduced);
	const shot = shots[index] ?? shots[0];

	// biome-ignore lint/correctness/useExhaustiveDependencies: restart the timer on every tab change
	useEffect(() => {
		if (!auto || !visible) return;
		const timer = setTimeout(() => setIndex((i) => (i + 1) % shots.length), ADVANCE_MS);
		return () => clearTimeout(timer);
	}, [auto, visible, index, shots.length]);

	if (!shot) return null;

	return (
		<div ref={ref} className="flex flex-col gap-6">
			<div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1" role="tablist">
				{shots.map((item, i) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={i === index}
						onClick={() => {
							setIndex(i);
							setAuto(false);
						}}
						className={cn(
							"relative min-w-28 flex-1 overflow-hidden rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
							i === index ? "text-foreground" : "text-muted-foreground hover:text-foreground",
						)}
					>
						{i === index ? (
							<motion.span
								layoutId="tour-tab"
								transition={transitions.snappy}
								className="absolute inset-0 rounded-lg bg-accent"
							/>
						) : null}
						<span className="relative">{item.label}</span>
						{i === index && auto && visible ? (
							<motion.span
								key={`${item.id}-progress`}
								className="absolute inset-x-3 bottom-0 h-0.5 origin-left rounded-full bg-primary"
								initial={{ scaleX: 0 }}
								animate={{ scaleX: 1 }}
								transition={{ duration: ADVANCE_MS / 1000, ease: "linear" }}
							/>
						) : null}
					</button>
				))}
			</div>
			<div className="relative overflow-hidden rounded-xl border bg-card shadow-[0_50px_120px_-40px_rgb(0_0_0/0.95)]">
				<div className="relative" style={{ aspectRatio: `${shot.width} / ${shot.height}` }}>
					<AnimatePresence initial={false} mode="popLayout">
						<motion.img
							key={shot.id}
							src={shot.src}
							srcSet={shot.srcSet}
							sizes="(min-width: 1200px) 1150px, 100vw"
							alt={shot.alt}
							width={shot.width}
							height={shot.height}
							loading="lazy"
							decoding="async"
							initial={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
							animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
							exit={{ opacity: 0 }}
							transition={transitions.smooth}
							className="absolute inset-0 size-full object-cover object-top"
						/>
					</AnimatePresence>
					{/* macOS traffic lights where the window draws them. */}
					{["1.26%", "2.83%", "4.40%"].map((left, i) => (
						<span
							key={left}
							aria-hidden="true"
							className="absolute top-[2.01%] aspect-square w-[0.94%] rounded-full"
							style={{ left, backgroundColor: ["#ff5f57", "#febc2e", "#28c840"][i] }}
						/>
					))}
				</div>
			</div>
			<AnimatePresence mode="wait">
				<motion.p
					key={shot.id}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -6 }}
					transition={transitions.snappy}
					className="text-center text-sm text-muted-foreground"
				>
					{shot.caption}
				</motion.p>
			</AnimatePresence>
		</div>
	);
}
