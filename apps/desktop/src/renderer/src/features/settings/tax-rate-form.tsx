import {
	DomainError,
	formatRate,
	parseRate,
	type TaxRate,
	taxRateInputSchema,
} from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { SwitchField, TextareaField, TextField } from "../../components/form/fields";
import { showSaveError } from "../../lib/forms";
import { useCreateTaxRate, useUpdateTaxRate } from "../../lib/queries";

// The rate is typed as a percentage ("20", "7.5") and stored in basis points.
const formSchema = taxRateInputSchema.omit({ rate: true }).extend({
	percent: z.string().refine(
		(value) => {
			try {
				const rate = parseRate(value);
				return rate >= 0 && rate <= 100_000;
			} catch {
				return false;
			}
		},
		{ message: "Enter a percentage like 20 or 7.5" },
	),
});
type Values = z.input<typeof formSchema>;
type Output = z.output<typeof formSchema>;

interface TaxRateFormProps {
	taxRate?: TaxRate;
	onSaved?: (taxRate: TaxRate) => void;
	secondaryAction?: React.ReactNode;
}

export function TaxRateForm({ taxRate, onSaved, secondaryAction }: TaxRateFormProps) {
	const create = useCreateTaxRate();
	const update = useUpdateTaxRate();
	const form = useForm<Values, unknown, Output>({
		resolver: zodResolver(formSchema),
		defaultValues: taxRate
			? {
					name: taxRate.name,
					percent: formatRate(taxRate.rate),
					note: taxRate.note,
					isDefault: taxRate.isDefault,
				}
			: { name: "", percent: "", note: "", isDefault: false },
	});

	const onSubmit = form.handleSubmit(async ({ percent, ...values }) => {
		try {
			const data = { ...values, rate: parseRate(percent) };
			const saved = taxRate
				? await update.mutateAsync({ id: taxRate.id, data })
				: await create.mutateAsync(data);
			onSaved?.(saved);
		} catch (error) {
			if (error instanceof DomainError) form.setError("percent", { message: error.message });
			else showSaveError(error, form.setError);
		}
	});

	return (
		<FormProvider {...form}>
			<form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
				<div className="grid grid-cols-[1fr_8rem] gap-x-4">
					<TextField<Values> name="name" label="Name" placeholder="VAT" autoFocus />
					<TextField<Values> name="percent" label="Rate, %" inputMode="decimal" placeholder="20" />
				</div>
				<TextareaField<Values>
					name="note"
					label="Note on invoices"
					description="Printed when this rate is used, e.g. a reverse-charge or exemption notice."
					rows={2}
				/>
				<SwitchField<Values>
					name="isDefault"
					label="Default rate"
					description="Pre-selected on new line items."
				/>
				<div className="flex justify-end gap-2">
					{secondaryAction}
					<Button type="submit" disabled={form.formState.isSubmitting}>
						{form.formState.isSubmitting ? <Spinner /> : null}
						Save rate
					</Button>
				</div>
			</form>
		</FormProvider>
	);
}
