import type { Invoice } from "@dawnstudio/core";
import {
	AlertDialog,
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { Ban, CircleCheck, Copy, Ellipsis, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useDuplicateInvoice, useMarkPaid, useVoidInvoice } from "../../lib/queries";
import { PaymentDialog } from "./payment-dialog";

/** Header actions on an issued invoice: record payments, duplicate, void. */
export function IssuedActions({ invoice }: { invoice: Invoice }) {
	const navigate = useNavigate();
	const duplicate = useDuplicateInvoice();
	const markPaid = useMarkPaid();
	const voidInvoice = useVoidInvoice();
	const [dialog, setDialog] = useState<"payment" | "void" | null>(null);
	const [reason, setReason] = useState("");
	const open = invoice.status === "issued";

	const onDuplicate = async () => {
		try {
			const copy = await duplicate.mutateAsync({ id: invoice.id });
			navigate(`/invoices/${copy.id}`);
			toast.success("Duplicated as a new draft");
		} catch (error) {
			showSaveError(error);
		}
	};

	const onMarkPaid = async () => {
		try {
			await markPaid.mutateAsync({ id: invoice.id });
			toast.success(`${invoice.number} is paid`);
		} catch (error) {
			showSaveError(error);
		}
	};

	const onVoid = async () => {
		try {
			await voidInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() || undefined });
			toast.success(`${invoice.number} is void`);
			setDialog(null);
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon-sm" aria-label="More actions">
						<Ellipsis />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{open ? (
						<DropdownMenuItem onSelect={onMarkPaid}>
							<CircleCheck />
							Mark as paid today
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem onSelect={onDuplicate}>
						<Copy />
						Duplicate
					</DropdownMenuItem>
					{open ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								variant="destructive"
								disabled={invoice.amountPaid > 0}
								onSelect={() => setDialog("void")}
							>
								<Ban />
								{invoice.amountPaid > 0 ? "Void (remove payments first)" : "Void invoice…"}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
			{open ? (
				<Button size="sm" onClick={() => setDialog("payment")}>
					<Plus />
					Record payment
				</Button>
			) : (
				<Button size="sm" variant="outline" onClick={onDuplicate} disabled={duplicate.isPending}>
					{duplicate.isPending ? <Spinner /> : <Copy />}
					Duplicate
				</Button>
			)}

			<PaymentDialog
				invoice={invoice}
				open={dialog === "payment"}
				onOpenChange={(next) => setDialog(next ? "payment" : null)}
			/>

			<AlertDialog
				open={dialog === "void"}
				onOpenChange={(next) => {
					if (!next) setDialog(null);
					setReason("");
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Void {invoice.number}?</AlertDialogTitle>
						<AlertDialogDescription>
							The invoice stays on record, marked void, and its number is never reused. To bill
							again, duplicate it into a new draft.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<Textarea
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						placeholder="Reason (optional), e.g. Billed to the wrong client"
						maxLength={500}
						rows={2}
						aria-label="Reason"
					/>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<Button variant="destructive" onClick={onVoid} disabled={voidInvoice.isPending}>
							{voidInvoice.isPending ? <Spinner /> : null}
							Void invoice
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
