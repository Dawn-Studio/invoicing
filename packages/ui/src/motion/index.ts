import type { Transition, Variants } from "motion/react";

/** Shared motion tokens so the app and the landing page animate the same way. */
export const transitions = {
	snappy: { type: "spring", stiffness: 500, damping: 40, mass: 1 },
	smooth: { type: "spring", stiffness: 260, damping: 32, mass: 1 },
	fade: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] },
} satisfies Record<string, Transition>;

export const fadeIn: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: transitions.fade },
};

export const slideUp: Variants = {
	hidden: { opacity: 0, y: 8 },
	visible: { opacity: 1, y: 0, transition: transitions.smooth },
};

export const stagger = (staggerChildren = 0.04): Variants => ({
	hidden: {},
	visible: { transition: { staggerChildren } },
});
