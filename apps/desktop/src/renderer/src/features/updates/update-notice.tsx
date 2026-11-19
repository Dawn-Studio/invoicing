import { Button } from "@dawnstudio/ui/components/button";
import { ArrowDownToLine, RotateCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useRpcQuery } from "../../lib/queries";
import { rpc } from "../../lib/rpc";

export const useUpdateStatus = () => useRpcQuery("updates.status", undefined, { staleTime: 0 });

export const installUpdate = () => void rpc("updates.install").catch(showSaveError);
export const downloadUpdate = () => void rpc("updates.download").catch(showSaveError);

/** One toast per version when an update is ready to install or available to download. */
export function UpdateToasts() {
	const { data: status } = useUpdateStatus();
	const shown = useRef(new Set<string>());

	useEffect(() => {
		if (!status || (status.state !== "ready" && status.state !== "available")) return;
		const key = `${status.state}:${status.version}`;
		if (shown.current.has(key)) return;
		shown.current.add(key);
		if (status.state === "ready") {
			toast(`Invoicing ${status.version} is ready`, {
				description: "Restart to finish updating. Your work is saved.",
				duration: Number.POSITIVE_INFINITY,
				action: { label: "Restart", onClick: installUpdate },
			});
		} else {
			toast(`Invoicing ${status.version} is available`, {
				description: "Download it from the release page and replace the app.",
				duration: 15_000,
				action: { label: "Download", onClick: downloadUpdate },
			});
		}
	}, [status]);

	return null;
}

/** A quiet button above Settings in the sidebar while an update waits. */
export function SidebarUpdateNotice() {
	const { data: status } = useUpdateStatus();
	if (status?.state !== "ready" && status?.state !== "available") return null;
	const ready = status.state === "ready";
	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={ready ? installUpdate : downloadUpdate}
			className="app-no-drag mb-1 h-8 w-full justify-start gap-2.5 px-2 text-[0.9375rem] font-normal text-sidebar-foreground"
		>
			<span className="relative flex size-4 items-center justify-center text-brand-ink">
				{ready ? <RotateCw /> : <ArrowDownToLine />}
				<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary" />
			</span>
			{ready ? "Restart to update" : `Update to ${status.version}`}
		</Button>
	);
}
