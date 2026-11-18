import { formatRate, type TaxRate } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import { Input } from "@dawnstudio/ui/components/input";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@dawnstudio/ui/components/select";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dawnstudio/ui/components/tooltip";
import { cn } from "@dawnstudio/ui/lib/utils";
import { BookmarkPlus, GripVertical, Plus, X } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { type ReactNode, useId } from "react";
import { formatAmount } from "../../lib/format";
import type { DraftErrors, LineState } from "./draft-state";

interface LineItemsPanelProps {
	items: LineState[];
	currency: string;
	/** Line amounts in minor units, in the same order as `items`. */
	amounts: number[];
	taxRates: TaxRate[];
	errors: DraftErrors;
	onChange: (items: LineState[]) => void;
	onAdd: () => void;
	/** Picking a saved item adds a line filled from it. */
	catalogPicker: ReactNode;
	onSaveToCatalog: (line: LineState) => void;
}

export function LineItemsPanel({
	items,
	currency,
	amounts,
	taxRates,
	errors,
	onChange,
	onAdd,
	catalogPicker,
	onSaveToCatalog,
}: LineItemsPanelProps) {
	const update = (key: string, patch: Partial<LineState>) =>
		onChange(items.map((line) => (line.key === key ? { ...line, ...patch } : line)));
	const remove = (key: string) => onChange(items.filter((line) => line.key !== key));
	// Tax is optional: without any rates set up, the column stays hidden.
	const showTax = taxRates.length > 0 || items.some((line) => line.taxRate > 0);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Line items</PanelTitle>
				<div className="flex items-center gap-3">
					{items.length > 0 ? <PanelLabel>{items.length}</PanelLabel> : null}
					{catalogPicker}
					<Button type="button" variant="outline" size="sm" onClick={onAdd}>
						<Plus />
						Add line
					</Button>
				</div>
			</PanelHeader>
			<PanelBody className="px-3 py-3">
				{items.length === 0 ? (
					<p className="px-3 py-2 text-[0.9375rem] text-muted-foreground">
						What you're billing for: hours, a fixed fee, expenses. Add a line to start.
					</p>
				) : (
					<Reorder.Group
						axis="y"
						values={items}
						onReorder={onChange}
						className="flex flex-col divide-y"
					>
						{items.map((line, index) => (
							<LineRow
								key={line.key}
								line={line}
								currency={currency}
								amount={amounts[index] ?? 0}
								taxRates={taxRates}
								showTax={showTax}
								errors={errors}
								autoFocus={index === items.length - 1 && line.description === ""}
								canDrag={items.length > 1}
								onChange={(patch) => update(line.key, patch)}
								onRemove={() => remove(line.key)}
								onSaveToCatalog={() => onSaveToCatalog(line)}
							/>
						))}
					</Reorder.Group>
				)}
			</PanelBody>
		</Panel>
	);
}

function LineRow({
	line,
	currency,
	amount,
	taxRates,
	showTax,
	errors,
	autoFocus,
	canDrag,
	onChange,
	onRemove,
	onSaveToCatalog,
}: {
	line: LineState;
	currency: string;
	amount: number;
	taxRates: TaxRate[];
	showTax: boolean;
	errors: DraftErrors;
	autoFocus: boolean;
	canDrag: boolean;
	onChange: (patch: Partial<LineState>) => void;
	onRemove: () => void;
	onSaveToCatalog: () => void;
}) {
	const controls = useDragControls();
	const quantityError = errors[`items.${line.key}.quantity`];
	const priceError = errors[`items.${line.key}.unitPrice`];
	// A rate that was archived after it was picked still shows as its percentage.
	const knownRate = taxRates.some((rate) => rate.id === line.taxRateId);

	return (
		<Reorder.Item
			value={line}
			dragListener={false}
			dragControls={controls}
			className="relative grid grid-cols-[auto_1fr_auto] items-start gap-x-1 bg-panel px-0 py-3"
		>
			<button
				type="button"
				aria-label="Drag to reorder"
				disabled={!canDrag}
				onPointerDown={(event) => canDrag && controls.start(event)}
				className="mt-2 flex h-5 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing disabled:invisible"
			>
				<GripVertical className="size-4" />
			</button>
			<div className="flex min-w-0 flex-col gap-3">
				<Textarea
					value={line.description}
					onChange={(event) => onChange({ description: event.target.value })}
					placeholder="Description, e.g. Design work for the spring campaign"
					aria-label="Description"
					rows={1}
					autoFocus={autoFocus}
					className="min-h-9 resize-none"
				/>
				<div
					className="grid items-end gap-2"
					style={{
						// Qty and unit stay narrow; rate and tax share the rest; the amount keeps its width.
						gridTemplateColumns: `4rem 4rem minmax(0,1fr)${showTax ? " minmax(0,1fr)" : ""} auto`,
					}}
				>
					<Cell label="Qty" error={quantityError}>
						{(id) => (
							<Input
								id={id}
								value={line.quantity}
								onChange={(event) => onChange({ quantity: event.target.value })}
								inputMode="decimal"
								aria-invalid={Boolean(quantityError)}
								className="text-right tabular-nums"
							/>
						)}
					</Cell>
					<Cell label="Unit">
						{(id) => (
							<Input
								id={id}
								value={line.unit}
								onChange={(event) => onChange({ unit: event.target.value })}
								placeholder="h"
							/>
						)}
					</Cell>
					<Cell label={`Rate, ${currency}`} error={priceError}>
						{(id) => (
							<Input
								id={id}
								value={line.unitPrice}
								onChange={(event) => onChange({ unitPrice: event.target.value })}
								inputMode="decimal"
								placeholder="0.00"
								aria-invalid={Boolean(priceError)}
								className="text-right tabular-nums"
							/>
						)}
					</Cell>
					{showTax ? (
						<Cell label="Tax">
							{(id) => (
								<Select
									value={line.taxRateId ?? (line.taxRate > 0 ? "custom" : "none")}
									onValueChange={(value) => {
										const rate = taxRates.find((r) => r.id === value);
										onChange({ taxRateId: rate?.id ?? null, taxRate: rate?.rate ?? 0 });
									}}
								>
									<SelectTrigger id={id} className="w-full">
										{/* The closed picker shows only the rate; names are in the list. */}
										<SelectValue>
											{line.taxRate > 0 ? `${formatRate(line.taxRate)}%` : "None"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">No tax</SelectItem>
										{taxRates.map((rate) => (
											<SelectItem key={rate.id} value={rate.id}>
												{rate.name} · {formatRate(rate.rate)}%
											</SelectItem>
										))}
										{line.taxRate > 0 && !knownRate ? (
											<SelectItem value={line.taxRateId ?? "custom"}>
												{formatRate(line.taxRate)}%
											</SelectItem>
										) : null}
									</SelectContent>
								</Select>
							)}
						</Cell>
					) : null}
					<div className="flex h-9 min-w-20 items-center justify-end pl-1 text-[0.9375rem] tabular-nums">
						{formatAmount(amount, currency)}
					</div>
				</div>
				{quantityError || priceError ? (
					<p className="text-sm text-destructive">{quantityError ?? priceError}</p>
				) : null}
			</div>
			<div className="mt-0.5 flex flex-col gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Remove line"
							className="text-muted-foreground"
							onClick={onRemove}
						>
							<X />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="left">Remove line</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label="Save to items"
							className="text-muted-foreground"
							disabled={line.description.trim() === ""}
							onClick={onSaveToCatalog}
						>
							<BookmarkPlus />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="left">Save to items</TooltipContent>
				</Tooltip>
			</div>
		</Reorder.Item>
	);
}

function Cell({
	label,
	error,
	className,
	children,
}: {
	label: string;
	error?: string;
	className?: string;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<div className={cn("flex min-w-0 flex-col gap-1", className)}>
			<label
				htmlFor={id}
				className={cn("text-xs text-muted-foreground", error && "text-destructive")}
			>
				{label}
			</label>
			{children(id)}
		</div>
	);
}
