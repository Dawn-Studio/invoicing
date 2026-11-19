import { Button } from "@dawnstudio/ui/components/button";
import { LayoutDashboard, RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Link, useRouteError } from "react-router";
import { EmptyState } from "./states";

/**
 * Shown in place of a screen that crashed while rendering. Inside the app it keeps the
 * sidebar, so the rest of the app stays one click away; reloading starts the window afresh.
 */
export function RouteError() {
	const error = useRouteError();
	useEffect(() => console.error(error), [error]);
	const message =
		error instanceof Error && error.message ? error.message : "An unexpected error occurred.";

	return (
		<div className="app-drag flex h-full min-h-0 items-center justify-center p-6">
			<EmptyState
				className="app-no-drag max-w-lg flex-none border-none bg-transparent"
				icon={<TriangleAlert className="text-destructive" />}
				title="This screen ran into a problem"
				description={
					<>
						Your data is safe; nothing was changed.{" "}
						<span className="block pt-2 font-mono text-xs break-all">{message}</span>
					</>
				}
			>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => window.location.reload()}>
						<RotateCw />
						Reload
					</Button>
					<Button asChild variant="ghost">
						<Link to="/" reloadDocument>
							<LayoutDashboard />
							Dashboard
						</Link>
					</Button>
				</div>
			</EmptyState>
		</div>
	);
}
