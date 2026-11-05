import { Badge } from "@dawnstudio/ui/components/badge";
import { Button } from "@dawnstudio/ui/components/button";
import { slideUp, stagger } from "@dawnstudio/ui/motion";
import { Download } from "lucide-react";
import { motion } from "motion/react";

export function Hero() {
	return (
		<motion.section
			variants={stagger(0.08)}
			initial="hidden"
			animate="visible"
			className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center sm:py-32"
		>
			<motion.div variants={slideUp}>
				<Badge variant="secondary">macOS · Windows · Linux</Badge>
			</motion.div>
			<motion.h1
				variants={slideUp}
				className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
			>
				Invoices that look like your brand
			</motion.h1>
			<motion.p variants={slideUp} className="max-w-xl text-lg text-pretty text-muted-foreground">
				Save your details and your clients once, issue branded PDF invoices in seconds, and keep
				every invoice on your own machine.
			</motion.p>
			<motion.div variants={slideUp} className="flex flex-wrap justify-center gap-3">
				<Button size="lg" disabled>
					<Download />
					Download for macOS
				</Button>
				<Button size="lg" variant="outline" disabled>
					Coming soon
				</Button>
			</motion.div>
		</motion.section>
	);
}
