import { transitions } from "@dawnstudio/ui/motion";
import { ArrowRight, Download } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { InvoiceDemo } from "./demos/invoice-demo";

const rise = {
	hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
	visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: transitions.smooth },
};

/** The headline and calls to action on the left, an invoice writing itself on the right. */
export function Hero({ version }: { version?: string }) {
	const reduced = useReducedMotion();
	return (
		<section className="relative overflow-hidden border-b">
			{/* Grid and glow behind everything. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]"
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute top-1/4 right-[-10%] -z-10 size-[640px] rounded-full bg-primary/20 blur-[140px]"
			/>
			<div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-16 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-24 lg:pb-28">
				<motion.div
					initial={reduced ? false : "hidden"}
					animate="visible"
					transition={{ staggerChildren: 0.08 }}
					className="flex flex-col items-start gap-7"
				>
					<motion.a
						variants={rise}
						href="/changelog"
						className="group inline-flex items-center gap-2 rounded-full border bg-card/60 py-1 pr-3 pl-1 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
					>
						<span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
							{version ? `v${version}` : "New"}
						</span>
						Now on macOS, Windows and Linux
						<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
					</motion.a>
					<motion.h1
						variants={rise}
						className="text-[2.9rem] leading-[1.02] font-semibold tracking-[-0.045em] text-balance sm:text-[4.25rem]"
					>
						Invoices that look like{" "}
						<span className="relative whitespace-nowrap text-brand-ink">
							your brand
							<motion.svg
								aria-hidden="true"
								viewBox="0 0 300 20"
								className="absolute -bottom-2 left-0 h-3 w-full text-primary"
								preserveAspectRatio="none"
							>
								<motion.path
									d="M4 14 C 80 4, 200 4, 296 12"
									fill="none"
									stroke="currentColor"
									strokeWidth="5"
									strokeLinecap="round"
									initial={reduced ? false : { pathLength: 0 }}
									animate={{ pathLength: 1 }}
									transition={{ duration: 0.9, delay: 0.7, ease: [0.65, 0, 0.35, 1] }}
								/>
							</motion.svg>
						</span>
					</motion.h1>
					<motion.p variants={rise} className="max-w-md text-lg text-pretty text-muted-foreground">
						A calm desktop app for freelancers and small studios. Write an invoice in a minute, send
						a PDF that looks designed, and see who's paid. Everything stays on your computer.
					</motion.p>
					<motion.div variants={rise} className="flex flex-wrap gap-3">
						<a
							href="/download"
							className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground shadow-[0_10px_30px_-10px] shadow-primary/70 transition-[filter,transform] hover:brightness-110 active:scale-[0.98] [&_svg]:size-4"
						>
							<Download className="transition-transform group-hover:translate-y-0.5" />
							Download Invoicing
						</a>
						<button
							type="button"
							data-open-command
							className="inline-flex h-11 items-center gap-2.5 rounded-lg border bg-card/60 px-4 font-medium backdrop-blur transition-colors hover:bg-accent"
						>
							Press
							<kbd className="rounded border bg-background px-1.5 py-0.5 font-sans text-xs text-muted-foreground">
								⌘K
							</kbd>
						</button>
					</motion.div>
					<motion.ul variants={rise} className="flex flex-wrap gap-1.5" aria-label="Highlights">
						{["Local-first", "No account", "Any currency", "Works offline"].map((tag) => (
							<li
								key={tag}
								className="rounded-md border bg-card/60 px-2 py-1 text-xs text-muted-foreground"
							>
								{tag}
							</li>
						))}
					</motion.ul>
				</motion.div>
				<motion.div
					initial={reduced ? false : { opacity: 0, y: 40, rotateX: 12 }}
					animate={{ opacity: 1, y: 0, rotateX: 0 }}
					transition={{ ...transitions.smooth, delay: 0.25 }}
					className="[perspective:1600px]"
				>
					<InvoiceDemo />
				</motion.div>
			</div>
		</section>
	);
}
