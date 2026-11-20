import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@dawnstudio/ui/components/alert-dialog";
import { Button } from "@dawnstudio/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { useId, useState } from "react";
import { toast } from "sonner";
import type { Workspace } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import {
	useChooseWorkspaceAvatar,
	useRemoveWorkspaceAvatar,
	useRenameWorkspace,
	useWorkspaces,
} from "../../lib/queries";
import { useWorkspaceActions } from "./use-workspace-actions";
import { WorkspaceAvatar } from "./workspace-avatar";

/** Settings: rename the open workspace, or delete it. */
export function WorkspacePanel() {
	const { data } = useWorkspaces();
	const active = data?.workspaces.find((w) => w.id === data.activeId);
	if (!data || !active) return null;
	// Remount when the name changes elsewhere so the input starts from it.
	return (
		<WorkspaceForm
			key={`${active.id}-${active.name}`}
			workspace={active}
			canDelete={data.workspaces.length > 1}
		/>
	);
}

function WorkspaceForm({ workspace, canDelete }: { workspace: Workspace; canDelete: boolean }) {
	const id = useId();
	const [name, setName] = useState(workspace.name);
	const [confirming, setConfirming] = useState(false);
	const rename = useRenameWorkspace();
	const actions = useWorkspaceActions();
	const trimmed = name.trim();

	const onRename = async () => {
		try {
			await rename.mutateAsync({ id: workspace.id, name: trimmed });
			toast.success("Workspace renamed");
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Workspace</PanelTitle>
			</PanelHeader>
			<PanelBody className="flex flex-col gap-5">
				<AvatarPicker workspace={workspace} name={trimmed || workspace.name} />
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (trimmed && trimmed !== workspace.name) void onRename();
					}}
				>
					<Field className="flex-1">
						<FieldLabel htmlFor={id}>Workspace name</FieldLabel>
						<Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
					</Field>
					<Button
						type="submit"
						variant="outline"
						disabled={!trimmed || trimmed === workspace.name || rename.isPending}
					>
						Rename
					</Button>
				</form>
				<FieldDescription>
					Each workspace keeps its own business details, clients, invoices and numbering. Switch or
					add workspaces from the menu at the top of the sidebar.
				</FieldDescription>
				{canDelete ? (
					<div className="flex items-center justify-between gap-4 border-t pt-5">
						<p className="text-sm text-muted-foreground">
							Deleting moves this workspace's data file to the Trash.
						</p>
						<Button
							type="button"
							variant="ghost"
							className="text-destructive hover:text-destructive"
							onClick={() => setConfirming(true)}
						>
							Delete workspace
						</Button>
					</div>
				) : null}
			</PanelBody>
			<AlertDialog open={confirming} onOpenChange={setConfirming}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {workspace.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Its clients, invoices and settings are removed from the app. The data file goes to the
							Trash, so it can still be recovered from there.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={actions.pending}
							onClick={() => actions.remove(workspace.id)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Panel>
	);
}

/** The square icon in the sidebar, switcher and command palette; the invoice logo is separate. */
function AvatarPicker({ workspace, name }: { workspace: Workspace; name: string }) {
	const choose = useChooseWorkspaceAvatar();
	const remove = useRemoveWorkspaceAvatar();
	const busy = choose.isPending || remove.isPending;

	const onChoose = () =>
		choose
			.mutateAsync({ id: workspace.id })
			.then((saved) => saved && toast.success("Avatar updated"))
			.catch((error) => showSaveError(error));
	const onRemove = () =>
		remove.mutateAsync({ id: workspace.id }).catch((error) => showSaveError(error));

	return (
		<div className="flex items-center gap-4">
			<WorkspaceAvatar
				id={workspace.id}
				name={name}
				avatarFile={workspace.avatarFile}
				className="size-14 rounded-xl text-lg"
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<p className="text-sm text-muted-foreground">
					A square image shown next to the workspace name. PNG, JPG, WebP or SVG up to 2 MB.
				</p>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={onChoose} disabled={busy}>
						{choose.isPending ? <Spinner /> : null}
						{workspace.avatarFile ? "Replace…" : "Upload avatar…"}
					</Button>
					{workspace.avatarFile ? (
						<Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
							Remove
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}
