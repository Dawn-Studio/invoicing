import { Badge } from "@dawnstudio/ui/components/badge";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import {
	DetailList,
	DetailRow,
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
	ArchiveRestore,
	DatabaseBackup,
	Ellipsis,
	FolderOpen,
	HardDriveDownload,
	History,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { BackupPreview, BackupReason } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import { useAppInfo, useRpcQuery, useWorkspaces } from "../../lib/queries";
import { rpc } from "../../lib/rpc";

const revealLabel = window.api.platform === "darwin" ? "Show in Finder" : "Show in folder";

const REASONS: Record<BackupReason, string> = {
	daily: "Daily",
	quit: "On close",
	"pre-migration": "Before update",
	"pre-restore": "Before restore",
	manual: "Manual",
};

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const fileSize = (bytes: number) =>
	bytes < 1024 * 1024
		? `${Math.max(1, Math.round(bytes / 1024))} KB`
		: `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const plural = (count: number, one: string, many = `${one}s`) =>
	`${count} ${count === 1 ? one : many}`;

const SHOWN = 5;

/** Where the data lives, automatic backups of the open workspace, and backup files. */
export function DataPanel() {
	const { data: info } = useAppInfo();
	const { data: backups = [] } = useRpcQuery("backups.list", undefined, { staleTime: 0 });
	const queryClient = useQueryClient();
	const [showAll, setShowAll] = useState(false);
	const [busy, setBusy] = useState<"backup" | "export" | "inspect" | null>(null);
	const [preview, setPreview] = useState<BackupPreview | null>(null);

	const run = async (kind: NonNullable<typeof busy>, action: () => Promise<void>) => {
		setBusy(kind);
		try {
			await action();
		} catch (error) {
			showSaveError(error);
		} finally {
			setBusy(null);
		}
	};

	const backUpNow = () =>
		run("backup", async () => {
			queryClient.setQueryData(["backups", "list", null], await rpc("backups.create"));
			toast.success("Backed up");
		});
	const exportBackup = () =>
		run("export", async () => {
			const result = await rpc("backups.export");
			if (!result) return;
			const { path } = result;
			toast.success("Backup saved", {
				description: path.split(/[\\/]/).pop(),
				action: {
					label: revealLabel,
					onClick: () => void rpc("files.reveal", { path }).catch(showSaveError),
				},
			});
		});
	const inspect = (name?: string) =>
		run("inspect", async () => {
			const result = await rpc("backups.inspect", { name });
			if (result) setPreview(result);
		});

	const visible = showAll ? backups : backups.slice(0, SHOWN);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Data & backups</PanelTitle>
				<div className="flex items-center gap-1">
					<Button variant="outline" size="sm" disabled={busy !== null} onClick={backUpNow}>
						{busy === "backup" ? <Spinner /> : <DatabaseBackup />}
						Back up now
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" aria-label="More backup actions">
								<Ellipsis />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem disabled={busy !== null} onSelect={exportBackup}>
								<HardDriveDownload />
								Save backup as…
							</DropdownMenuItem>
							<DropdownMenuItem disabled={busy !== null} onSelect={() => inspect()}>
								<ArchiveRestore />
								Restore from file…
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</PanelHeader>
			<PanelBody className="flex flex-col gap-4">
				<DetailList>
					<DetailRow label="Stored at">
						<span className="font-mono text-sm break-all">{info?.dataPath ?? "…"}</span>
					</DetailRow>
					<DetailRow label="Version">{info?.version ?? "…"}</DetailRow>
				</DetailList>
				<div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void rpc("app.showDataFolder").catch(showSaveError)}
					>
						<FolderOpen />
						{window.api.platform === "darwin" ? "Open in Finder" : "Open data folder"}
					</Button>
				</div>
			</PanelBody>

			<PanelBody className="px-2 py-2">
				{backups.length === 0 ? (
					<p className="px-3 py-2 text-sm text-muted-foreground">
						No backups of this workspace yet. The first one is made within a minute of opening the
						app.
					</p>
				) : (
					<RowList className="my-0 [&>li]:py-0">
						{visible.map((backup) => (
							<li key={backup.name} className="flex items-center gap-3 px-3 py-2">
								<History className="size-4 shrink-0 text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate text-[0.9375rem]">
									{dateTime.format(backup.createdAt)}
								</span>
								<Badge
									variant="secondary"
									className={cn(backup.reason === "manual" && "text-brand-ink")}
								>
									{REASONS[backup.reason]}
								</Badge>
								<span className="w-16 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
									{fileSize(backup.size)}
								</span>
								<Button
									variant="ghost"
									size="sm"
									disabled={busy !== null}
									onClick={() => inspect(backup.name)}
								>
									Restore…
								</Button>
							</li>
						))}
					</RowList>
				)}
				{backups.length > SHOWN ? (
					<Button
						variant="ghost"
						size="sm"
						className="mx-1 mt-1 text-muted-foreground"
						onClick={() => setShowAll(!showAll)}
					>
						{showAll ? "Show fewer" : `Show all ${backups.length}`}
					</Button>
				) : null}
			</PanelBody>
			<PanelFooter>
				Each workspace is backed up daily and whenever you close it after a change, keeping the last
				14. A backup is also made before app updates change your data and before a restore.
			</PanelFooter>

			<RestoreDialog preview={preview} onClose={() => setPreview(null)} />
		</Panel>
	);
}

/** Shows what's in a backup and how to restore it; nothing changes until the user confirms. */
function RestoreDialog({
	preview,
	onClose,
}: {
	preview: BackupPreview | null;
	onClose: () => void;
}) {
	const navigate = useNavigate();
	const { data: workspaces } = useWorkspaces();
	const current = workspaces?.workspaces.find((w) => w.id === workspaces.activeId)?.name;
	const [mode, setMode] = useState<"new" | "replace">("new");
	const [pending, setPending] = useState(false);

	const close = () => {
		if (pending) return;
		if (preview) void rpc("backups.discard", { token: preview.token });
		setMode("new");
		onClose();
	};

	const restore = async () => {
		if (!preview) return;
		setPending(true);
		try {
			// Leave the current screen first, so an open editor saves into the right workspace.
			navigate("/");
			await new Promise((resolve) => setTimeout(resolve, 150));
			await rpc("backups.restore", { token: preview.token, mode });
			window.location.reload();
		} catch (error) {
			showSaveError(error);
			setPending(false);
		}
	};

	return (
		<Dialog open={preview !== null} onOpenChange={(open) => (open ? null : close())}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Restore backup</DialogTitle>
					<DialogDescription>
						{preview
							? `${preview.workspaceName}, backed up ${dateTime.format(preview.createdAt)}`
							: null}
					</DialogDescription>
				</DialogHeader>
				{preview ? (
					<>
						<DetailList className="rounded-lg border px-4 py-2">
							<DetailRow label="Business">{preview.businessName ?? "Not set up"}</DetailRow>
							<DetailRow label="Contains">
								{[
									plural(preview.clients, "client"),
									plural(preview.invoices, "invoice"),
									preview.drafts > 0 ? plural(preview.drafts, "draft") : null,
								]
									.filter(Boolean)
									.join(", ")}
							</DetailRow>
							<DetailRow label="Kind">{REASONS[preview.reason]}</DetailRow>
						</DetailList>
						<fieldset className="flex flex-col gap-2">
							<legend className="sr-only">How to restore</legend>
							<ModeOption
								selected={mode === "new"}
								onSelect={() => setMode("new")}
								title="As a new workspace"
								description={`"${preview.workspaceName} (restored)" appears next to your other workspaces. Nothing is overwritten.`}
							/>
							<ModeOption
								selected={mode === "replace"}
								onSelect={() => setMode("replace")}
								title={`Replace ${current ? `"${current}"` : "this workspace"}`}
								description="Its current data is swapped for the backup. A backup of it is made first, so you can undo this."
							/>
						</fieldset>
					</>
				) : null}
				<DialogFooter>
					<Button variant="ghost" onClick={close} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant={mode === "replace" ? "destructive" : "default"}
						onClick={() => void restore()}
						disabled={pending}
					>
						{pending ? <Spinner /> : null}
						{mode === "replace" ? "Replace and restore" : "Restore"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ModeOption({
	selected,
	onSelect,
	title,
	description,
}: {
	selected: boolean;
	onSelect: () => void;
	title: string;
	description: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onSelect}
			className={cn(
				"flex gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/50",
				selected && "border-brand-ink/60 bg-primary/5",
			)}
		>
			<span
				className={cn(
					"mt-1 size-3.5 shrink-0 rounded-full border",
					selected && "border-4 border-brand-ink",
				)}
			/>
			<span className="flex flex-col gap-0.5">
				<span className="text-[0.9375rem] font-medium">{title}</span>
				<span className="text-sm text-muted-foreground">{description}</span>
			</span>
		</button>
	);
}
