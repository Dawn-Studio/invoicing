import { transitions } from "@dawnstudio/ui/motion";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({
	children,
	delay = 0,
	y = 24,
	className,
}: {
	children?: ReactNode;
	delay?: number;
	/** How far it rises, in px. */
	y?: number;
	className?: string;
}) {
	const reduced = useReducedMotion();
	return (
		<motion.div
			className={className}
			initial={reduced ? false : { opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "0px 0px -10% 0px" }}
			transition={{ ...transitions.smooth, delay }}
		>
			{children}
		</motion.div>
	);
}
