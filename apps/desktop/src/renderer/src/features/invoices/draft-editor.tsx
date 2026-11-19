import {
	addDays,
	type CatalogItem,
	computeTotals,
	formatInvoiceNumber,
	formatRate,
	fromMinor,
	type Invoice,
	isIsoDate,
	issueProblems,
	previewSnapshot,
	toMinor,
} from "@dawnstudio/core";
import { Amount } from "@dawnstudio/ui/components/amount";
import { Field, FieldDescription, FieldError, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import {
	DetailList,
	DetailRow,
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
import { cn } from "@dawnstudio/ui/lib/utils";
import { useAppHotkeys, useHotkey } from "@tanstack/react-hotkeys";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { CurrencySelect } from "../../components/currency-select";
import { Page, PageSection } from "../../components/page";
import { formatAmount, joinParts } from "../../lib/format";
import {
	useClients,
	useLogo,
	usePaymentAccounts,
	useProfile,
	useTaxRates,
} from "../../lib/queries";
import { CatalogItemDialog, type ItemDialogState } from "../catalog/catalog-item-dialog";
import { CatalogPicker } from "./catalog-picker";
import { ClientSelect } from "./client-select";
import { DraftActions } from "./draft-actions";
import {
	applyClient,
	applyCurrency,
	type DiscountType,
	type DraftState,
	emptyLine,
	parseDraft,
	stateFromInvoice,
	termDays,
} from "./draft-state";
import { InvoicePreview } from "./invoice-preview";
import { LineItemsPanel } from "./line-items";
import { type SaveStatus, useDraftAutosave } from "./use-autosave";

/** Editing a draft: the form on the left, the page as it will print on the right. */
export function DraftEditor({ invoice }: { invoice: Invoice }) {
	const [state, setState] = useState<DraftState>(() => stateFromInvoice(invoice));
	const { data: profile } = useProfile();
	const { data: clients = [] } = useClients({ includeArchived: true });
	const { data: accounts = [] } = usePaymentAccounts();
	const { data: taxRates = [] } = useTaxRates();
	const { data: logo } = useLogo();

	const parsed = useMemo(() => parseDraft(state), [state]);
	const { status, error: saveError, flush } = useDraftAutosave(invoice.id, parsed);
	const { errors, input } = parsed;

	const client = clients.find((c) => c.id === state.clientId) ?? null;
	const account = accounts.find((a) => a.id === state.paymentAccountId) ?? null;
	const nextNumber =
		profile && isIsoDate(state.issueDate)
			? formatInvoiceNumber(profile.numberPattern, profile.nextSequence, state.issueDate)
			: null;
	const defaults = {
		currency: profile?.defaultCurrency ?? state.currency,
		paymentTermsDays: profile?.paymentTermsDays ?? 14,
	};

	const items = useMemo(
		() =>
			(input.items ?? []).map((item) => ({
				description: item.description ?? "",
				unit: item.unit ?? "",
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				taxRate: item.taxRate ?? 0,
			})),
		[input],
	);
	const discount = input.discount ?? null;
	const totals = useMemo(() => computeTotals(items, discount), [items, discount]);

	const preview = useMemo(() => {
		if (!profile) return null;
		const usedRates = new Set(state.items.map((line) => line.taxRateId));
		return previewSnapshot({
			number: nextNumber ?? "",
			issueDate: isIsoDate(state.issueDate) ? state.issueDate : invoice.issueDate,
			dueDate: isIsoDate(state.dueDate) ? state.dueDate : invoice.dueDate,
			currency: state.currency,
			discount,
			notes: state.notes,
			terms: state.terms,
			items,
			profile,
			client,
			paymentAccount: account,
			taxNotes: taxRates.filter((rate) => usedRates.has(rate.id)).map((rate) => rate.note),
		});
	}, [profile, state, items, discount, client, account, taxRates, nextNumber, invoice]);

	const problems = [
		...(Object.keys(errors).length > 0 ? ["Fix the highlighted fields"] : []),
		...issueProblems({
			client,
			items,
			issueDate: state.issueDate,
			dueDate: state.dueDate,
			discount,
		}),
	];

	const [itemDialog, setItemDialog] = useState<ItemDialogState>({ mode: "closed" });

	/** A line filled from a saved item; its rate only carries over in the same currency. */
	const addFromCatalog = (item: CatalogItem) => {
		const taxRate = taxRates.find((rate) => rate.id === item.taxRateId) ?? null;
		const sameCurrency = item.currency === state.currency;
		setState((current) => ({
			...current,
			items: [
				...current.items,
				{
					...emptyLine(taxRate),
					description: item.description,
					unit: item.unit,
					unitPrice: sameCurrency ? fromMinor(item.unitPrice, item.currency) : "",
				},
			],
		}));
		if (!sameCurrency) {
			toast.info(`${item.description} is priced in ${item.currency}`, {
				description: `Enter the rate in ${state.currency}.`,
			});
		}
	};

	const set = (patch: Partial<DraftState>) => setState((current) => ({ ...current, ...patch }));
	const defaultRate = taxRates.find((rate) => rate.isDefault) ?? null;
	const addLine = () =>
		setState((current) => ({ ...current, items: [...current.items, emptyLine(defaultRate)] }));

	const hotkeys = useAppHotkeys();
	useHotkey(hotkeys["editor.addLine"], addLine);
	useHotkey(hotkeys["editor.save"], () => {
		if (Object.keys(errors).length > 0) {
			toast.error("Not saved yet", { description: "Fix the highlighted fields first." });
			return;
		}
		flush().catch(() => undefined);
	});
	const terms = termDays(state);

	return (
		<Page
			title={nextNumber ? `Draft · ${nextNumber}` : "Draft invoice"}
			back={{ to: "/invoices", label: "Invoices" }}
			className="@container max-w-[1440px]"
			actions={
				<>
					<SaveStatusLabel status={status} error={saveError} />
					<DraftActions
						invoice={invoice}
						flush={flush}
						problems={problems}
						number={nextNumber}
						summary={joinParts(
							client?.name,
							`${formatAmount(totals.total, state.currency)} ${state.currency}`,
						)}
					/>
				</>
			}
		>
			<div className="grid items-start gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
				<div className="flex min-w-0 flex-col gap-3">
					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Bill to</PanelTitle>
								{client ? (
									<Link
										to={`/clients/${client.id}`}
										className="text-sm text-muted-foreground hover:text-foreground"
									>
										View client
									</Link>
								) : null}
							</PanelHeader>
							<PanelBody className="flex flex-col gap-3">
								{clients.length === 0 ? (
									<p className="text-[0.9375rem] text-muted-foreground">
										No clients yet.{" "}
										<Link
											to="/clients/new"
											className="text-foreground underline underline-offset-4"
										>
											Add a client
										</Link>{" "}
										first; this draft is saved and waits here.
									</p>
								) : (
									<ClientSelect
										clients={clients}
										value={state.clientId}
										onChange={(next) =>
											setState((current) => applyClient(current, next, defaults, accounts))
										}
									/>
								)}
								{client ? (
									<p className="text-sm text-muted-foreground">
										{joinParts(client.contactName, client.email, client.address.country) ||
											"No contact details saved"}
									</p>
								) : null}
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Details</PanelTitle>
								<PanelLabel>{terms === 0 ? "Due on receipt" : `Net ${terms}`}</PanelLabel>
							</PanelHeader>
							<PanelBody className="grid grid-cols-2 gap-x-4 gap-y-5">
								<LabeledField label="Issue date" error={errors.issueDate}>
									{(id) => (
										<Input
											id={id}
											type="date"
											value={state.issueDate}
											aria-invalid={Boolean(errors.issueDate)}
											onChange={(event) => {
												const issueDate = event.target.value;
												// Moving the issue date keeps the payment terms.
												set(
													isIsoDate(issueDate) && isIsoDate(state.issueDate)
														? { issueDate, dueDate: addDays(issueDate, terms) }
														: { issueDate },
												);
											}}
										/>
									)}
								</LabeledField>
								<LabeledField label="Due date" error={errors.dueDate}>
									{(id) => (
										<Input
											id={id}
											type="date"
											value={state.dueDate}
											min={state.issueDate}
											aria-invalid={Boolean(errors.dueDate)}
											onChange={(event) => set({ dueDate: event.target.value })}
										/>
									)}
								</LabeledField>
								<LabeledField label="Currency">
									{(id) => (
										<CurrencySelect
											id={id}
											value={state.currency}
											onChange={(currency) =>
												currency &&
												setState((current) => applyCurrency(current, currency, accounts))
											}
										/>
									)}
								</LabeledField>
								<LabeledField
									label="Paid to"
									description={
										account && account.currency !== state.currency
											? `This account is in ${account.currency}.`
											: accounts.length === 0
												? "Add a payment account in Settings."
												: undefined
									}
								>
									{(id) => (
										<Select
											value={state.paymentAccountId ?? "none"}
											onValueChange={(value) =>
												set({ paymentAccountId: value === "none" ? null : value })
											}
										>
											<SelectTrigger id={id} className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">No payment details</SelectItem>
												{accounts.map((a) => (
													<SelectItem key={a.id} value={a.id}>
														{a.label} · {a.currency}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</LabeledField>
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection>
						<LineItemsPanel
							items={state.items}
							currency={state.currency}
							amounts={totals.lines.map((line) => line.amount)}
							taxRates={taxRates}
							errors={errors}
							onChange={(items) => set({ items })}
							onAdd={addLine}
							catalogPicker={<CatalogPicker currency={state.currency} onPick={addFromCatalog} />}
							onSaveToCatalog={(line) => {
								let unitPrice = 0;
								try {
									unitPrice = line.unitPrice.trim() ? toMinor(line.unitPrice, state.currency) : 0;
								} catch {
									// Saved without a rate; it can be set in the item dialog.
								}
								setItemDialog({
									mode: "new",
									initial: {
										description: line.description.trim(),
										unit: line.unit,
										unitPrice,
										currency: state.currency,
										taxRateId: line.taxRateId,
									},
								});
							}}
						/>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Total</PanelTitle>
								<PanelLabel>{state.currency}</PanelLabel>
							</PanelHeader>
							<PanelBody className="flex flex-col gap-4">
								<DetailList>
									<DetailRow label="Subtotal" className="tabular-nums">
										{formatAmount(totals.subtotal, state.currency)}
									</DetailRow>
									<DiscountRow
										type={state.discountType}
										value={state.discountValue}
										currency={state.currency}
										amount={totals.discountTotal}
										error={errors.discount}
										onChange={(discountType, discountValue) => set({ discountType, discountValue })}
									/>
									{totals.taxes.map((tax) => (
										<DetailRow key={tax.rate} label={`Tax ${formatRate(tax.rate)}%`}>
											<span className="tabular-nums">
												{formatAmount(tax.amount, state.currency)}
											</span>
										</DetailRow>
									))}
								</DetailList>
								<div className="flex items-end justify-between gap-4 border-t pt-4">
									<span className="text-sm text-muted-foreground">Total due</span>
									<Amount
										value={formatAmount(totals.total, state.currency)}
										unit={state.currency}
									/>
								</div>
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Notes</PanelTitle>
								<PanelLabel>Printed</PanelLabel>
							</PanelHeader>
							<PanelBody className="flex flex-col gap-5">
								<LabeledField label="Note to the client">
									{(id) => (
										<Textarea
											id={id}
											value={state.notes}
											onChange={(event) => set({ notes: event.target.value })}
											placeholder="Thanks for your business!"
											rows={2}
										/>
									)}
								</LabeledField>
								<LabeledField label="Terms">
									{(id) => (
										<Textarea
											id={id}
											value={state.terms}
											onChange={(event) => set({ terms: event.target.value })}
											placeholder="Late payment fees, purchase order number, …"
											rows={2}
										/>
									)}
								</LabeledField>
							</PanelBody>
						</Panel>
					</PageSection>
				</div>

				<CatalogItemDialog state={itemDialog} onClose={() => setItemDialog({ mode: "closed" })} />
				<PageSection className="@3xl:sticky @3xl:top-14">
					{preview ? <InvoicePreview invoice={preview} logoSrc={logo} draft /> : null}
				</PageSection>
			</div>
		</Page>
	);
}

function DiscountRow({
	type,
	value,
	currency,
	amount,
	error,
	onChange,
}: {
	type: DiscountType;
	value: string;
	currency: string;
	amount: number;
	error?: string;
	onChange: (type: DiscountType, value: string) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<div className="flex flex-col gap-1 py-1.5">
			<div className="flex items-center justify-between gap-3 text-[0.9375rem]">
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground">Discount</span>
					<Select
						value={type}
						onValueChange={(next) => {
							onChange(next as DiscountType, "");
							// Focus the amount once it appears, but not on page load.
							requestAnimationFrame(() => input.current?.focus());
						}}
					>
						<SelectTrigger size="sm" aria-label="Discount type" className="h-7">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">None</SelectItem>
							<SelectItem value="percent">Percent</SelectItem>
							<SelectItem value="amount">Amount</SelectItem>
						</SelectContent>
					</Select>
					{type !== "none" ? (
						<div className="relative">
							<Input
								value={value}
								onChange={(event) => onChange(type, event.target.value)}
								inputMode="decimal"
								aria-label={type === "percent" ? "Discount percent" : `Discount in ${currency}`}
								aria-invalid={Boolean(error)}
								placeholder="0"
								ref={input}
								className="h-7 w-24 pr-8 text-right tabular-nums"
							/>
							<span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-xs text-muted-foreground">
								{type === "percent" ? "%" : currency}
							</span>
						</div>
					) : null}
				</div>
				<span className={cn("tabular-nums", amount === 0 && "text-muted-foreground")}>
					{amount > 0 ? "−" : ""}
					{formatAmount(amount, currency)}
				</span>
			</div>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
		</div>
	);
}

function LabeledField({
	label,
	description,
	error,
	children,
}: {
	label: string;
	description?: ReactNode;
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

const statusText: Record<SaveStatus, string> = {
	saved: "Saved",
	pending: "Editing",
	saving: "Saving…",
	invalid: "Not saved",
	failed: "Save failed",
};

function SaveStatusLabel({ status, error }: { status: SaveStatus; error: string | null }) {
	return (
		<PanelLabel
			title={
				status === "failed"
					? (error ?? undefined)
					: status === "invalid"
						? "Fix the highlighted fields to save"
						: undefined
			}
			className={cn("mr-1", (status === "failed" || status === "invalid") && "text-destructive")}
		>
			{statusText[status]}
		</PanelLabel>
	);
}
