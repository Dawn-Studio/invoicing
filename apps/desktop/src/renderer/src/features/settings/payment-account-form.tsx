import { type PaymentAccount, paymentAccountInputSchema } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import { FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { CurrencyField, SwitchField, TextField } from "../../components/form/fields";
import { showSaveError } from "../../lib/forms";
import { useCreatePaymentAccount, useUpdatePaymentAccount } from "../../lib/queries";

// Detail rows may be left blank in the form; blank rows are dropped before saving.
const formSchema = paymentAccountInputSchema.extend({
	details: z.array(z.object({ label: z.string(), value: z.string() })),
});
type Values = z.input<typeof formSchema>;
type Output = z.output<typeof formSchema>;

const SUGGESTED_DETAILS = ["Account holder", "IBAN", "BIC / SWIFT"];

interface PaymentAccountFormProps {
	account?: PaymentAccount;
	defaultCurrency?: string;
	submitLabel?: string;
	onSaved?: (account: PaymentAccount) => void;
	/** Extra buttons next to submit, e.g. Cancel or Skip. */
	secondaryAction?: React.ReactNode;
}

/** The bank details clients pay into. Used in Settings dialogs and first-run setup. */
export function PaymentAccountForm({
	account,
	defaultCurrency = "EUR",
	submitLabel = "Save account",
	onSaved,
	secondaryAction,
}: PaymentAccountFormProps) {
	const create = useCreatePaymentAccount();
	const update = useUpdatePaymentAccount();
	const form = useForm<Values, unknown, Output>({
		resolver: zodResolver(formSchema),
		defaultValues: account
			? {
					label: account.label,
					currency: account.currency,
					details: account.details,
					isDefault: account.isDefault,
				}
			: {
					label: "",
					currency: defaultCurrency,
					details: SUGGESTED_DETAILS.map((label) => ({ label, value: "" })),
					isDefault: false,
				},
	});
	const details = useFieldArray({ control: form.control, name: "details" });

	const onSubmit = form.handleSubmit(async (values) => {
		const data = {
			...values,
			details: values.details.filter((row) => row.label.trim() !== "" && row.value.trim() !== ""),
		};
		try {
			const saved = account
				? await update.mutateAsync({ id: account.id, data })
				: await create.mutateAsync(data);
			onSaved?.(saved);
		} catch (error) {
			showSaveError(error, form.setError);
		}
	});

	return (
		<FormProvider {...form}>
			<form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
				<div className="grid grid-cols-2 gap-x-4 gap-y-5">
					<TextField<Values> name="label" label="Name" placeholder="Wise EUR" autoFocus />
					<CurrencyField<Values> name="currency" label="Currency" />
				</div>

				<div className="flex flex-col gap-2">
					<FieldLabel>Details printed on invoices</FieldLabel>
					{details.fields.map((row, index) => (
						<div key={row.id} className="grid grid-cols-[10rem_1fr_auto] gap-2">
							<Input
								aria-label="Label"
								placeholder="Label"
								{...form.register(`details.${index}.label`)}
							/>
							<Input
								aria-label="Value"
								placeholder="Value"
								className="font-mono"
								{...form.register(`details.${index}.value`)}
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label="Remove row"
								onClick={() => details.remove(index)}
							>
								<X />
							</Button>
						</div>
					))}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="self-start text-muted-foreground"
						onClick={() => details.append({ label: "", value: "" })}
					>
						<Plus />
						Add a row
					</Button>
				</div>

				<SwitchField<Values>
					name="isDefault"
					label="Default account"
					description="Pre-selected on new invoices in this currency."
				/>

				<div className="flex justify-end gap-2">
					{secondaryAction}
					<Button type="submit" disabled={form.formState.isSubmitting}>
						{form.formState.isSubmitting ? <Spinner /> : null}
						{submitLabel}
					</Button>
				</div>
			</form>
		</FormProvider>
	);
}
