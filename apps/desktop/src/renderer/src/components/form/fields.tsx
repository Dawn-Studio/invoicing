import { Field, FieldDescription, FieldError, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Switch } from "@dawnstudio/ui/components/switch";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { cn } from "@dawnstudio/ui/lib/utils";
import { type ComponentProps, type ReactNode, useId } from "react";
import { Controller, type FieldPath, type FieldValues, useFormContext } from "react-hook-form";
import { CurrencySelect } from "../currency-select";

/**
 * Inputs bound to the surrounding react-hook-form `FormProvider` by field name. They render the
 * shadcn Field layout (label, control, description, error) so every form looks the same.
 */

interface BaseProps<T extends FieldValues> {
	name: FieldPath<T>;
	label: ReactNode;
	description?: ReactNode;
	className?: string;
}

function useFieldState<T extends FieldValues>(name: FieldPath<T>) {
	const { register, getFieldState, formState } = useFormContext<T>();
	const { error } = getFieldState(name, formState);
	return { register, error };
}

export function TextField<T extends FieldValues>({
	name,
	label,
	description,
	className,
	inputClassName,
	...input
}: BaseProps<T> & Omit<ComponentProps<"input">, "name"> & { inputClassName?: string }) {
	const id = useId();
	const { register, error } = useFieldState<T>(name);
	return (
		<Field data-invalid={Boolean(error)} className={className}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				aria-invalid={Boolean(error)}
				className={inputClassName}
				{...input}
				{...register(name)}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError errors={[error]} />
		</Field>
	);
}

/** Whole numbers; an empty input becomes `null` when `nullable` is set. */
export function NumberField<T extends FieldValues>({
	name,
	label,
	description,
	className,
	nullable = false,
	...input
}: BaseProps<T> & Omit<ComponentProps<"input">, "name"> & { nullable?: boolean }) {
	const id = useId();
	const { register, error } = useFieldState<T>(name);
	return (
		<Field data-invalid={Boolean(error)} className={className}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Input
				id={id}
				type="number"
				inputMode="numeric"
				aria-invalid={Boolean(error)}
				className="tabular-nums"
				{...input}
				{...register(name, {
					setValueAs: (value: string | number | null) =>
						value === "" || value === null ? (nullable ? null : Number.NaN) : Number(value),
				})}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError errors={[error]} />
		</Field>
	);
}

export function TextareaField<T extends FieldValues>({
	name,
	label,
	description,
	className,
	...input
}: BaseProps<T> & Omit<ComponentProps<"textarea">, "name">) {
	const id = useId();
	const { register, error } = useFieldState<T>(name);
	return (
		<Field data-invalid={Boolean(error)} className={className}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<Textarea id={id} aria-invalid={Boolean(error)} {...input} {...register(name)} />
			{description ? <FieldDescription>{description}</FieldDescription> : null}
			<FieldError errors={[error]} />
		</Field>
	);
}

export function CurrencyField<T extends FieldValues>({
	name,
	label,
	description,
	className,
	emptyLabel,
}: BaseProps<T> & { emptyLabel?: string }) {
	const id = useId();
	const { control } = useFormContext<T>();
	return (
		<Controller
			control={control}
			name={name}
			render={({ field, fieldState }) => (
				<Field data-invalid={fieldState.invalid} className={className}>
					<FieldLabel htmlFor={id}>{label}</FieldLabel>
					<CurrencySelect
						id={id}
						value={field.value ?? null}
						onChange={field.onChange}
						emptyLabel={emptyLabel}
						invalid={fieldState.invalid}
					/>
					{description ? <FieldDescription>{description}</FieldDescription> : null}
					<FieldError errors={[fieldState.error]} />
				</Field>
			)}
		/>
	);
}

export function SwitchField<T extends FieldValues>({
	name,
	label,
	description,
	className,
}: BaseProps<T>) {
	const id = useId();
	const { control } = useFormContext<T>();
	return (
		<Controller
			control={control}
			name={name}
			render={({ field }) => (
				<Field orientation="horizontal" className={cn("items-center", className)}>
					<div className="flex flex-1 flex-col gap-1">
						<FieldLabel htmlFor={id}>{label}</FieldLabel>
						{description ? <FieldDescription>{description}</FieldDescription> : null}
					</div>
					<Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
				</Field>
			)}
		/>
	);
}
