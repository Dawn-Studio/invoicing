import { fromMinor, type Invoice, todayIso, toMinor } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { formatAmount } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { useRecordPayment } from "../../lib/queries";

/** Money received for an issued invoice: the whole balance by default, or part of it. */
export function PaymentDialog({
	invoice,
	open,
	onOpenChange,
}: {
	invoice: Invoice;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				{/* Remount on open so it starts from the current balance. */}
				{open ? <PaymentForm invoice={invoice} onDone={() => onOpenChange(false)} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function PaymentForm({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
	const balance = invoice.total - invoice.amountPaid;
	const today = todayIso();
	const [amount, setAmount] = useState(fromMinor(balance, invoice.currency));
	// ISO dates compare as strings: the later of today and the issue date.
	const [date, setDate] = useState([today, invoice.issueDate].sort().at(-1) ?? today);
	const [method, setMethod] = useState("");
	const [note, setNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const record = useRecordPayment();

	const onSubmit = async () => {
		let minor: number;
		try {
			minor = toMinor(amount, invoice.currency);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Not a number");
			return;
		}
		if (minor <= 0) return setError("Enter an amount");
		if (minor > balance) return setError("That's more than the balance due");
		try {
			const saved = await record.mutateAsync({
				id: invoice.id,
				data: { amount: minor, date, method, note },
			});
			toast.success(
				saved.status === "paid"
					? `${saved.number} is paid`
					: `Recorded ${formatAmount(minor, invoice.currency)} ${invoice.currency}`,
			);
			onDone();
		} catch (failure) {
			showSaveError(failure);
		}
	};

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				void onSubmit();
			}}
		>
			<DialogHeader>
				<DialogTitle>Record a payment</DialogTitle>
				<DialogDescription>
					Balance due on {invoice.number}: {formatAmount(balance, invoice.currency)}{" "}
					{invoice.currency}. A smaller amount leaves the rest open.
				</DialogDescription>
			</DialogHeader>
			<div className="grid grid-cols-2 gap-x-4 gap-y-5">
				<Labeled label={`Amount, ${invoice.currency}`} error={error}>
					{(id) => (
						<Input
							id={id}
							value={amount}
							onChange={(event) => {
								setAmount(event.target.value);
								setError(null);
							}}
							inputMode="decimal"
							aria-invalid={Boolean(error)}
							className="text-right tabular-nums"
							autoFocus
						/>
					)}
				</Labeled>
				<Labeled label="Received on">
					{(id) => (
						<Input
							id={id}
							type="date"
							value={date}
							min={invoice.issueDate}
							onChange={(event) => setDate(event.target.value)}
						/>
					)}
				</Labeled>
				<Labeled label="Method">
					{(id) => (
						<Input
							id={id}
							value={method}
							onChange={(event) => setMethod(event.target.value)}
							placeholder="Bank transfer"
							maxLength={50}
						/>
					)}
				</Labeled>
				<Labeled label="Note">
					{(id) => (
						<Input
							id={id}
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder="Optional"
							maxLength={500}
						/>
					)}
				</Labeled>
			</div>
			<DialogFooter>
				<Button type="button" variant="ghost" onClick={onDone}>
					Cancel
				</Button>
				<Button type="submit" disabled={record.isPending || !date}>
					{record.isPending ? <Spinner /> : null}
					Record payment
				</Button>
			</DialogFooter>
		</form>
	);
}

function Labeled({
	label,
	error,
	children,
}: {
	label: string;
	error?: string | null;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<Field data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children(id)}
			{error ? <FieldError>{error}</FieldError> : null}
		</Field>
	);
}
