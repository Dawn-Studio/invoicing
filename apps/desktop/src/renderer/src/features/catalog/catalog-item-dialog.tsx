import { type CatalogItem, formatRate, fromMinor, toMinor } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@dawnstudio/ui/components/select";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { CurrencySelect } from "../../components/currency-select";
import { showSaveError } from "../../lib/forms";
import {
	useArchiveCatalogItem,
	useCreateCatalogItem,
	useProfile,
	useTaxRates,
	useUnarchiveCatalogItem,
	useUpdateCatalogItem,
} from "../../lib/queries";

/** `item` null = new item. `initial` prefills a new one (e.g. from an invoice line). */
export type ItemDialogState =
	| { mode: "closed" }
	| {
			mode: "new";
			initial?: Partial<
				Pick<CatalogItem, "description" | "unit" | "unitPrice" | "currency" | "taxRateId">
			>;
	  }
	| { mode: "edit"; item: CatalogItem };

export function CatalogItemDialog({
	state,
	onClose,
}: {
	state: ItemDialogState;
	onClose: () => void;
}) {
	return (
		<Dialog open={state.mode !== "closed"} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-lg">
				{state.mode !== "closed" ? <ItemForm state={state} onDone={onClose} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function ItemForm({
	state,
	onDone,
}: {
	state: Exclude<ItemDialogState, { mode: "closed" }>;
	onDone: () => void;
}) {
	const { data: profile } = useProfile();
	const { data: taxRates = [] } = useTaxRates();
	const create = useCreateCatalogItem();
	const update = useUpdateCatalogItem();
	const archive = useArchiveCatalogItem();
	const unarchive = useUnarchiveCatalogItem();
	const item = state.mode === "edit" ? state.item : null;
	const start = item ?? (state.mode === "new" ? state.initial : undefined);

	const [currency, setCurrency] = useState(start?.currency ?? profile?.defaultCurrency ?? "USD");
	const [description, setDescription] = useState(start?.description ?? "");
	const [unit, setUnit] = useState(start?.unit ?? "");
	const [rate, setRate] = useState(
		start?.unitPrice !== undefined ? fromMinor(start.unitPrice, currency) : "",
	);
	const [taxRateId, setTaxRateId] = useState<string | null>(start?.taxRateId ?? null);
	const [errors, setErrors] = useState<{ description?: string; rate?: string }>({});
	const pending = create.isPending || update.isPending;

	const onSubmit = async () => {
		const next: typeof errors = {};
		if (!description.trim()) next.description = "Description is required";
		let unitPrice = 0;
		try {
			unitPrice = rate.trim() ? toMinor(rate, currency) : 0;
		} catch (error) {
			next.rate = error instanceof Error ? error.message : "Not a number";
		}
		setErrors(next);
		if (Object.keys(next).length > 0) return;
		const data = { description, unit, unitPrice, currency, taxRateId };
		try {
			if (item) {
				await update.mutateAsync({ id: item.id, data });
				toast.success("Item saved");
			} else {
				await create.mutateAsync(data);
				toast.success("Added to your items");
			}
			onDone();
		} catch (error) {
			showSaveError(error);
		}
	};

	const toggleArchived = async () => {
		if (!item) return;
		try {
			if (item.archivedAt) await unarchive.mutateAsync({ id: item.id });
			else await archive.mutateAsync({ id: item.id });
			toast.success(item.archivedAt ? "Item restored" : "Item archived");
			onDone();
		} catch (error) {
			showSaveError(error);
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
				<DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
				<DialogDescription>
					Something you bill often. Pick it in the invoice editor to fill a line in one go.
				</DialogDescription>
			</DialogHeader>
			<Labeled label="Description" error={errors.description}>
				{(id) => (
					<Textarea
						id={id}
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="e.g. Design work"
						aria-invalid={Boolean(errors.description)}
						rows={2}
						autoFocus
					/>
				)}
			</Labeled>
			<div className="grid grid-cols-[6rem_1fr_1fr] gap-x-4 gap-y-5">
				<Labeled label="Unit">
					{(id) => (
						<Input
							id={id}
							value={unit}
							onChange={(event) => setUnit(event.target.value)}
							placeholder="h"
							maxLength={20}
						/>
					)}
				</Labeled>
				<Labeled label={`Rate, ${currency}`} error={errors.rate}>
					{(id) => (
						<Input
							id={id}
							value={rate}
							onChange={(event) => setRate(event.target.value)}
							inputMode="decimal"
							placeholder="0.00"
							aria-invalid={Boolean(errors.rate)}
							className="text-right tabular-nums"
						/>
					)}
				</Labeled>
				<Labeled label="Currency">
					{(id) => (
						<CurrencySelect
							id={id}
							value={currency}
							onChange={(next) => next && setCurrency(next)}
						/>
					)}
				</Labeled>
			</div>
			{taxRates.length > 0 ? (
				<Labeled label="Tax" description="Used when the item is added to an invoice.">
					{(id) => (
						<Select
							value={taxRateId ?? "none"}
							onValueChange={(value) => setTaxRateId(value === "none" ? null : value)}
						>
							<SelectTrigger id={id} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No tax</SelectItem>
								{taxRates.map((taxRate) => (
									<SelectItem key={taxRate.id} value={taxRate.id}>
										{taxRate.name} · {formatRate(taxRate.rate)}%
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</Labeled>
			) : null}
			<DialogFooter>
				{item ? (
					<Button type="button" variant="ghost" className="sm:mr-auto" onClick={toggleArchived}>
						{item.archivedAt ? "Restore" : "Archive"}
					</Button>
				) : null}
				<Button type="button" variant="ghost" onClick={onDone}>
					Cancel
				</Button>
				<Button type="submit" disabled={pending}>
					{pending ? <Spinner /> : null}
					{item ? "Save item" : "Add item"}
				</Button>
			</DialogFooter>
		</form>
	);
}

function Labeled({
	label,
	description,
	error,
	children,
}: {
	label: string;
	description?: string;
	error?: string;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<Field data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children(id)}
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			{error ? <FieldError>{error}</FieldError> : null}
		</Field>
	);
}
