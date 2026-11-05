import { Badge } from "@dawnstudio/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@dawnstudio/ui/components/card";
import { slideUp } from "@dawnstudio/ui/motion";
import { motion } from "motion/react";
import type { Page } from "../navigation";

export function PagePlaceholder({ page }: { page: Page }) {
	const Icon = page.icon;
	return (
		<motion.div variants={slideUp} initial="hidden" animate="visible" className="max-w-xl">
			<Card>
				<CardHeader>
					<div className="mb-2 flex size-10 items-center justify-center bg-primary text-primary-foreground">
						<Icon className="size-5" />
					</div>
					<CardTitle className="flex items-center gap-2">
						{page.title}
						<Badge variant="secondary">Soon</Badge>
					</CardTitle>
					<CardDescription>{page.description}</CardDescription>
				</CardHeader>
				<CardContent />
			</Card>
		</motion.div>
	);
}
