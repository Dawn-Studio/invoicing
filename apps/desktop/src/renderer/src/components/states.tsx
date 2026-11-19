import { Button } from "@dawnstudio/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@dawnstudio/ui/components/empty";
import { cn } from "@dawnstudio/ui/lib/utils";
import { ArrowLeft, RotateCw, SearchX, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/** A panel-shaped "nothing here yet / couldn't load" message with optional actions. */
export function EmptyState({
	icon,
	title,
	description,
	children,
	className,
}: {
	icon: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	/** Actions, e.g. a button that creates the first record. */
	children?: ReactNode;
	className?: string;
}) {
	return (
		<Empty className={cn("rounded-xl border bg-panel py-16", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon">{icon}</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description ? <EmptyDescription>{description}</EmptyDescription> : null}
			</EmptyHeader>
			{children ? <EmptyContent>{children}</EmptyContent> : null}
		</Empty>
	);
}

/** A record that's gone (deleted, or a stale link): say so and offer the way back. */
export function NotFound({
	title,
	description,
	back,
}: {
	title: string;
	description: string;
	back: { to: string; label: string };
}) {
	return (
		<EmptyState icon={<SearchX />} title={title} description={description}>
			<Button asChild variant="outline">
				<Link to={back.to}>
					<ArrowLeft />
					{back.label}
				</Link>
			</Button>
		</EmptyState>
	);
}

/** Something failed to load. `retry` runs the query again. */
export function LoadError({
	error,
	retry,
	className,
}: {
	error: unknown;
	retry?: () => void;
	className?: string;
}) {
	return (
		<EmptyState
			className={className}
			icon={<TriangleAlert className="text-destructive" />}
			title="Couldn't load this"
			description={
				error instanceof Error && error.message
					? error.message
					: "Something went wrong reading your data."
			}
		>
			{retry ? (
				<Button variant="outline" onClick={retry}>
					<RotateCw />
					Try again
				</Button>
			) : null}
		</EmptyState>
	);
}
