import { Button } from "@dawnstudio/ui/components/button";
import { Panel, PanelBody, PanelFooter } from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, CircleAlert, CircleCheck, RefreshCw, RotateCw } from "lucide-react";
import { useState } from "react";
import icon from "../../../../../build/icon.png";
import type { UpdateStatus } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import { useAppInfo } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { downloadUpdate, installUpdate, useUpdateStatus } from "./update-notice";

const since = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const checkedText = (at: number | null) => {
	if (!at) return "Checks automatically every few hours.";
	const minutes = Math.round((at - Date.now()) / 60_000);
	return `Last checked ${Math.abs(minutes) < 1 ? "just now" : since.format(minutes, "minute")}.`;
};

/** The app, its version, and updates. */
export function AboutPanel() {
	const { data: info } = useAppInfo();
	const { data: status } = useUpdateStatus();
	const queryClient = useQueryClient();
	const [checking, setChecking] = useState(false);

	const check = async () => {
		setChecking(true);
		try {
			queryClient.setQueryData(["updates", "status", null], await rpc("updates.check"));
		} catch (error) {
			showSaveError(error);
		} finally {
			setChecking(false);
		}
	};

	return (
		<Panel>
			<PanelBody className="flex items-center gap-5 py-6">
				<img src={icon} alt="" className="size-20 shrink-0 drop-shadow-sm" draggable={false} />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<h3 className="text-xl font-semibold tracking-tight">Invoicing</h3>
					<p className="text-sm text-muted-foreground">
						Version <span className="font-mono">{info?.version ?? "…"}</span> · by Dawn Studio
					</p>
				</div>
			</PanelBody>
			<PanelBody className="flex items-center gap-4 border-t">
				<UpdateLine status={status} />
				<UpdateAction status={status} checking={checking} onCheck={() => void check()} />
			</PanelBody>
			<PanelFooter>
				{window.api.platform === "darwin"
					? "Until the app is signed by Apple, updates are downloaded from the release page and dragged into Applications, replacing the old copy. Your data stays where it is."
					: "Updates download in the background and install when you restart. Your data stays where it is."}
			</PanelFooter>
		</Panel>
	);
}

function UpdateLine({ status }: { status: UpdateStatus | undefined }) {
	const line = (icon: React.ReactNode, title: string, detail?: string) => (
		<div className="flex min-w-0 flex-1 items-start gap-3">
			<span className="mt-0.5 [&_svg]:size-4">{icon}</span>
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-[0.9375rem]">{title}</span>
				{detail ? <span className="text-sm text-muted-foreground">{detail}</span> : null}
			</div>
		</div>
	);
	switch (status?.state) {
		case undefined:
		case "unsupported":
			return line(
				<CircleCheck className="text-muted-foreground" />,
				"Updates are off in development builds",
				"Installed copies check GitHub Releases for new versions.",
			);
		case "idle":
			return line(
				<CircleCheck className="text-success" />,
				"You're up to date",
				checkedText(status.checkedAt),
			);
		case "checking":
			return line(<Spinner />, "Checking for updates…");
		case "available":
			return line(
				<ArrowDownToLine className="text-brand-ink" />,
				`Version ${status.version} is available`,
				"Download it from the release page.",
			);
		case "downloading":
			return line(
				<Spinner />,
				`Downloading ${status.version}…`,
				`${status.percent}% · installs when you restart`,
			);
		case "ready":
			return line(
				<RotateCw className="text-brand-ink" />,
				`Version ${status.version} is ready`,
				"Restart to finish updating.",
			);
		case "error":
			return line(
				<CircleAlert className="text-destructive" />,
				"Couldn't check for updates",
				status.message,
			);
	}
}

function UpdateAction({
	status,
	checking,
	onCheck,
}: {
	status: UpdateStatus | undefined;
	checking: boolean;
	onCheck: () => void;
}) {
	if (status?.state === "ready") {
		return (
			<Button size="sm" onClick={installUpdate}>
				<RotateCw />
				Restart now
			</Button>
		);
	}
	if (status?.state === "available") {
		return (
			<Button size="sm" onClick={downloadUpdate}>
				<ArrowDownToLine />
				Download
			</Button>
		);
	}
	const busy = checking || status?.state === "checking" || status?.state === "downloading";
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={busy || !status || status.state === "unsupported"}
			onClick={onCheck}
		>
			{busy ? <Spinner /> : <RefreshCw />}
			Check for updates
		</Button>
	);
}
