import { cn } from "@dawnstudio/ui/lib/utils";
import { Check } from "lucide-react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";

export const money = (value: number, currency = "EUR", fraction = 2) =>
	new Intl.NumberFormat("en", {
		style: "currency",
		currency,
		minimumFractionDigits: fraction,
		maximumFractionDigits: fraction,
	}).format(value);

/** An app-like window: dark frame, traffic lights and a title. */
export function Window({
	title,
	right,
	children,
	className,
	bodyClassName,
}: {
	title?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
}) {
	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border bg-card shadow-[0_40px_100px_-30px_rgb(0_0_0/0.9)]",
				className,
			)}
		>
			<div className="flex h-9 items-center gap-3 border-b px-3">
				<span className="flex gap-1.5" aria-hidden="true">
					<span className="size-2.5 rounded-full bg-white/15" />
					<span className="size-2.5 rounded-full bg-white/15" />
					<span className="size-2.5 rounded-full bg-white/15" />
				</span>
				<span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{title}</span>
				{right}
			</div>
			<div className={bodyClassName}>{children}</div>
		</div>
	);
}

/** A lime check in a circle, like the app's checklists. */
export function CheckItem({ children }: { children: ReactNode }) {
	return (
		<li className="flex items-start gap-2.5 text-[0.9375rem] text-muted-foreground">
			<span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-brand-ink/50 text-brand-ink">
				<Check className="size-3" strokeWidth={3} />
			</span>
			<span>{children}</span>
		</li>
	);
}

/** True while the element is on screen (demos pause when scrolled away). */
export function useVisible<T extends Element>(ref: RefObject<T | null>, once = false) {
	return useInView(ref, { once, margin: "-15% 0px -15% 0px" });
}

/** Animates a number up to `target` the first time it's visible. */
export function useCountUp(target: number, visible: boolean, duration = 1.4) {
	const reduced = useReducedMotion();
	const [value, setValue] = useState(reduced ? target : 0);
	const from = useRef(0);
	useEffect(() => {
		if (!visible) return;
		if (reduced) {
			setValue(target);
			return;
		}
		const controls = animate(from.current, target, {
			duration,
			ease: [0.16, 1, 0.3, 1],
			onUpdate: (latest) => {
				from.current = latest;
				setValue(latest);
			},
		});
		return () => controls.stop();
	}, [target, visible, duration, reduced]);
	return value;
}

/**
 * Runs `steps` in order, each after its delay, and loops while `running`. Returns the index of
 * the current step. With reduced motion it jumps straight to the last step and stays.
 */
export function useTimeline(delays: number[], running: boolean) {
	const reduced = useReducedMotion();
	const [step, setStep] = useState(reduced ? delays.length - 1 : 0);
	useEffect(() => {
		if (reduced || !running) return;
		const timer = setTimeout(() => setStep((s) => (s + 1) % delays.length), delays[step]);
		return () => clearTimeout(timer);
	}, [step, running, reduced, delays]);
	return step;
}
