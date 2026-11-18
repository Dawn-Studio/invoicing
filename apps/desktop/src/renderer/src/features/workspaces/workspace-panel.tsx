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
import { useId, useState } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useRenameWorkspace, useWorkspaces } from "../../lib/queries";
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

function WorkspaceForm({
	workspace,
	canDelete,
}: {
	workspace: { id: string; name: string };
	canDelete: boolean;
}) {
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
				<WorkspaceAvatar id={workspace.id} name={trimmed || workspace.name} />
			</PanelHeader>
			<PanelBody className="flex flex-col gap-5">
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
