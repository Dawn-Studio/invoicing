import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { useId, useState } from "react";
import { useWorkspaceActions } from "./use-workspace-actions";

export function CreateWorkspaceDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const id = useId();
	const [name, setName] = useState("");
	const actions = useWorkspaceActions();
	const trimmed = name.trim();

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next);
				if (!next) setName("");
			}}
		>
			<DialogContent className="sm:max-w-md">
				<form
					onSubmit={(event) => {
						event.preventDefault();
						if (trimmed) void actions.create(trimmed);
					}}
					className="flex flex-col gap-5"
				>
					<DialogHeader>
						<DialogTitle>Create a workspace</DialogTitle>
						<DialogDescription>
							A separate business with its own details, clients, invoices and numbering, such as
							your personal freelancing and your company.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={id}>Workspace name</FieldLabel>
						<Input
							id={id}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. Personal, Dawn Studio"
							maxLength={60}
							autoFocus
						/>
						<FieldDescription>
							Only shown in the app. The business name on invoices is set up next.
						</FieldDescription>
					</Field>
					<DialogFooter>
						<Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" disabled={!trimmed || actions.pending}>
							{actions.pending ? <Spinner /> : null}
							Create workspace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
