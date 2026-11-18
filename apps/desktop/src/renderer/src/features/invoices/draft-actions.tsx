import type { Invoice } from "@dawnstudio/core";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Copy, Ellipsis, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useDeleteDraft, useDuplicateInvoice, useIssueInvoice } from "../../lib/queries";

/** Header actions on a draft: issue it, or duplicate / delete it from the menu. */
export function DraftActions({
	invoice,
	flush,
	problems,
	number,
	summary,
}: {
	invoice: Invoice;
	/** Saves pending edits; issuing and duplicating must see the latest draft. */
	flush: () => Promise<void>;
	/** What stops this draft from being issued; empty when it can be. */
	problems: string[];
	/** The number issuing will assign. */
	number: string | null;
	/** "Acme · 1,200.00 EUR", shown in the confirmation. */
	summary: string;
}) {
	const navigate = useNavigate();
	const issue = useIssueInvoice();
	const remove = useDeleteDraft();
	const duplicate = useDuplicateInvoice();
	const [dialog, setDialog] = useState<"issue" | "delete" | null>(null);

	const saveFirst = async () => {
		try {
			await flush();
			return true;
		} catch (error) {
			showSaveError(error);
			return false;
		}
	};

	const onIssue = async () => {
		try {
			const issued = await issue.mutateAsync({ id: invoice.id });
			toast.success(`Issued ${issued.number}`);
			setDialog(null);
		} catch (error) {
			showSaveError(error);
		}
	};

	const onDuplicate = async () => {
		if (!(await saveFirst())) return;
		try {
			const copy = await duplicate.mutateAsync({ id: invoice.id });
			navigate(`/invoices/${copy.id}`);
			toast.success("Duplicated as a new draft");
		} catch (error) {
			showSaveError(error);
		}
	};

	const onDelete = async () => {
		try {
			navigate("/invoices", { replace: true });
			await remove.mutateAsync({ id: invoice.id });
			toast.success("Draft deleted");
		} catch (error) {
			showSaveError(error);
		}
	};

	const ready = problems.length === 0;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label="More actions">
						<Ellipsis />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={onDuplicate}>
						<Copy />
						Duplicate
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
						<Trash2 />
						Delete draft
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				size="sm"
				onClick={async () => {
					if (await saveFirst()) setDialog("issue");
				}}
			>
				Issue invoice
			</Button>

			<AlertDialog open={dialog === "issue"} onOpenChange={(open) => !open && setDialog(null)}>
				<AlertDialogContent>
					{ready ? (
						<>
							<AlertDialogHeader>
								<AlertDialogTitle>Issue {number ?? "this invoice"}?</AlertDialogTitle>
								<AlertDialogDescription>
									{summary}. Issuing assigns the number and locks the invoice: it can't be edited
									afterwards, only voided or duplicated into a new draft.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Keep editing</AlertDialogCancel>
								<Button onClick={onIssue} disabled={issue.isPending}>
									{issue.isPending ? <Spinner /> : null}
									Issue invoice
								</Button>
							</AlertDialogFooter>
						</>
					) : (
						<>
							<AlertDialogHeader>
								<AlertDialogTitle>Not ready to issue</AlertDialogTitle>
								<AlertDialogDescription asChild>
									<ul className="list-disc pl-5">
										{problems.map((problem) => (
											<li key={problem}>{problem}</li>
										))}
									</ul>
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogAction>OK</AlertDialogAction>
							</AlertDialogFooter>
						</>
					)}
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={dialog === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this draft?</AlertDialogTitle>
						<AlertDialogDescription>
							It hasn't been issued, so no number is used up. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={onDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
