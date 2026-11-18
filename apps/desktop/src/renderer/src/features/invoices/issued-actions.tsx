import { type Invoice, invoiceSummary, todayIso } from "@dawnstudio/core";
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
import { useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	CircleCheck,
	ClipboardCopy,
	Copy,
	Ellipsis,
	FileDown,
	Plus,
	Printer,
	Send,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useDuplicateInvoice, useMarkPaid, useVoidInvoice } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { PaymentDialog } from "./payment-dialog";
import { SendDialog } from "./send-dialog";

const revealLabel = window.api.platform === "darwin" ? "Show in Finder" : "Show in folder";

/** Header actions on an issued invoice: record payments, duplicate, void. */
export function IssuedActions({ invoice }: { invoice: Invoice }) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const duplicate = useDuplicateInvoice();
	const markPaid = useMarkPaid();
	const voidInvoice = useVoidInvoice();
	const [dialog, setDialog] = useState<"payment" | "void" | "send" | null>(null);

	const onCopySummary = async () => {
		if (!invoice.snapshot) return;
		try {
			await navigator.clipboard.writeText(invoiceSummary(invoice.snapshot, invoice.amountPaid));
			toast.success("Summary copied");
		} catch (error) {
			showSaveError(error);
		}
	};
	const [reason, setReason] = useState("");
	const open = invoice.status === "issued";
	const overdue = open && invoice.dueDate < todayIso();

	const onDuplicate = async () => {
		try {
			const copy = await duplicate.mutateAsync({ id: invoice.id });
			navigate(`/invoices/${copy.id}`);
			toast.success("Duplicated as a new draft");
		} catch (error) {
			showSaveError(error);
		}
	};

	const [exporting, setExporting] = useState(false);
	const onExport = async () => {
		setExporting(true);
		try {
			const saved = await rpc("invoices.exportPdf", { id: invoice.id });
			if (saved) {
				void queryClient.invalidateQueries({ queryKey: ["invoices", "events"] });
				toast.success(`Saved ${saved.fileName}`, {
					action: {
						label: revealLabel,
						onClick: () => void rpc("files.reveal", { path: saved.path }).catch(showSaveError),
					},
				});
			}
		} catch (error) {
			showSaveError(error);
		} finally {
			setExporting(false);
		}
	};

	const onPrint = () => void rpc("invoices.print", { id: invoice.id }).catch(showSaveError);

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
					<DropdownMenuItem onSelect={onCopySummary}>
						<ClipboardCopy />
						Copy summary
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onPrint}>
						<Printer />
						Print…
					</DropdownMenuItem>
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
			<Button size="sm" variant="outline" onClick={onExport} disabled={exporting}>
				{exporting ? <Spinner /> : <FileDown />}
				Export PDF
			</Button>
			{invoice.status !== "void" ? (
				<Button size="sm" variant="outline" onClick={() => setDialog("send")}>
					<Send />
					{overdue ? "Send reminder" : "Send"}
				</Button>
			) : null}
			{open ? (
				<Button size="sm" onClick={() => setDialog("payment")}>
					<Plus />
					Record payment
				</Button>
			) : null}

			<SendDialog
				invoice={invoice}
				reminder={overdue}
				open={dialog === "send"}
				onOpenChange={(next) => setDialog(next ? "send" : null)}
			/>
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
