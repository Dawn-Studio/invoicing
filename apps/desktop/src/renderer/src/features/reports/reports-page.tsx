import { formatRate, todayIso } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelLabel,
	PanelTitle,
	RowList,
} from "@dawnstudio/ui/components/panel";
import { Skeleton } from "@dawnstudio/ui/components/skeleton";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import {
	Calendar,
	ChevronDown,
	Circle,
	CircleCheck,
	Download,
	FileArchive,
	FileSpreadsheet,
	FileText,
	Percent,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { ReportExportKind } from "../../../../shared/contract";
import { Page, PageSection } from "../../components/page";
import { LoadError } from "../../components/states";
import { formatAmount, formatIsoDate } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { usePeriodReport } from "../../lib/queries";
import { rpc } from "../../lib/rpc";
import { PERIODS, type Period, periodRange } from "../invoices/list-filters";
import { CurrencyMenu, StatTile } from "./report-parts";

const revealLabel = window.api.platform === "darwin" ? "Show in Finder" : "Show in folder";

const EXPORTS: {
	kind: ReportExportKind;
	label: string;
	description: string;
	icon: typeof FileText;
	unit: [string, string];
}[] = [
	{
		kind: "invoices",
		label: "Invoices",
		description: "One row per invoice issued in the period, all currencies, void included",
		icon: FileSpreadsheet,
		unit: ["invoice", "invoices"],
	},
	{
		kind: "payments",
		label: "Payments",
		description: "Every payment received in the period",
		icon: FileSpreadsheet,
		unit: ["payment", "payments"],
	},
	{
		kind: "items",
		label: "Line items",
		description: "Each invoice line, with quantity, price and tax rate",
		icon: FileSpreadsheet,
		unit: ["line", "lines"],
	},
	{
		kind: "pdfs",
		label: "Invoice PDFs",
		description: "A zip with the PDF of every invoice issued in the period",
		icon: FileArchive,
		unit: ["PDF", "PDFs"],
	},
];

/** Revenue per client, the tax summary and accountant exports for a period. */
export function ReportsPage() {
	const [params, setParams] = useSearchParams();
	const today = todayIso();
	const period = (params.get("period") as Period | null) ?? "this-year";
	const requested = params.get("currency") ?? undefined;
	const range = periodRange(period, today);
	const { data: report, error, refetch } = usePeriodReport({ ...range, currency: requested });

	const setParam = (key: string, value: string) =>
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set(key, value);
				return next;
			},
			{ replace: true },
		);

	const outstanding = report?.clients.reduce((sum, client) => sum + client.outstanding, 0) ?? 0;
	const topInvoiced = report?.clients[0]?.invoiced ?? 0;

	return (
		<Page
			title="Reports"
			className="max-w-4xl"
			actions={
				<>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="font-normal">
								<Calendar />
								{PERIODS.find((p) => p.value === period)?.label}
								<ChevronDown className="text-muted-foreground" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-40">
							<DropdownMenuRadioGroup value={period} onValueChange={(v) => setParam("period", v)}>
								{PERIODS.map((p) => (
									<DropdownMenuRadioItem key={p.value} value={p.value}>
										{p.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					{report ? (
						<CurrencyMenu
							currency={report.currency}
							currencies={report.currencies}
							onChange={(currency) => setParam("currency", currency)}
						/>
					) : null}
				</>
			}
		>
			<PageSection className="-mb-2 px-1 text-sm text-muted-foreground">
				{formatIsoDate(range.from)} – {formatIsoDate(range.to)}
			</PageSection>

			{error ? (
				<PageSection>
					<LoadError error={error} retry={() => void refetch()} />
				</PageSection>
			) : !report ? (
				<PageSection className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-24 rounded-lg" />
					))}
				</PageSection>
			) : (
				<>
					<PageSection className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<StatTile
							label="Invoiced"
							icon={<FileText />}
							value={report.invoiced.amount}
							currency={report.currency}
							note={`${report.invoiced.count} ${report.invoiced.count === 1 ? "invoice" : "invoices"}`}
						/>
						<StatTile
							label="Received"
							icon={<CircleCheck className="text-success" />}
							value={report.received.amount}
							currency={report.currency}
							note={`From ${report.received.count} ${report.received.count === 1 ? "invoice" : "invoices"}`}
						/>
						<StatTile
							label="Still owed"
							icon={<Circle className="text-brand-ink" />}
							value={outstanding}
							currency={report.currency}
							note="On this period's invoices"
						/>
						<StatTile
							label="Tax charged"
							icon={<Percent />}
							value={report.taxTotal}
							currency={report.currency}
						/>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Revenue by client</PanelTitle>
								<PanelLabel>{report.currency}</PanelLabel>
							</PanelHeader>
							<PanelBody className="px-0 py-0">
								{report.clients.length === 0 ? (
									<p className="px-5 py-4 text-sm text-muted-foreground">
										No invoices or payments in this period.
									</p>
								) : (
									<table className="w-full text-[0.9375rem]">
										<thead>
											<tr className="border-b text-left text-xs text-muted-foreground [&>th]:px-5 [&>th]:py-2.5 [&>th]:font-medium">
												<th>Client</th>
												<th className="text-right">Invoices</th>
												<th className="text-right">Invoiced</th>
												<th className="text-right">Received</th>
												<th className="text-right">Owed</th>
											</tr>
										</thead>
										<tbody className="divide-y">
											{report.clients.map((client) => (
												<tr
													key={client.clientId ?? client.name}
													className="tabular-nums [&>td]:px-5 [&>td]:py-2.5"
												>
													<td className="max-w-0 w-[40%]">
														<div className="flex flex-col gap-1.5">
															{client.clientId ? (
																<Link
																	to={`/clients/${client.clientId}`}
																	className="truncate hover:underline"
																>
																	{client.name}
																</Link>
															) : (
																<span className="truncate">{client.name}</span>
															)}
															{/* Share of the period's largest client, as a thin meter. */}
															<span className="h-1 w-full overflow-hidden rounded-full bg-muted">
																<span
																	className="block h-full rounded-full bg-brand-ink"
																	style={{
																		width: `${topInvoiced > 0 ? (client.invoiced / topInvoiced) * 100 : 0}%`,
																	}}
																/>
															</span>
														</div>
													</td>
													<td className="text-right text-muted-foreground">
														{client.invoiceCount}
													</td>
													<td className="text-right">
														{formatAmount(client.invoiced, report.currency)}
													</td>
													<td className="text-right">
														{formatAmount(client.received, report.currency)}
													</td>
													<td className="text-right text-muted-foreground">
														{formatAmount(client.outstanding, report.currency)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</PanelBody>
							<PanelFooter>
								Invoiced counts invoices issued in the period; received counts payments that arrived
								in it.
							</PanelFooter>
						</Panel>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Tax summary</PanelTitle>
								<PanelLabel>{report.currency}</PanelLabel>
							</PanelHeader>
							<PanelBody className="px-0 py-0">
								{report.taxes.length === 0 ? (
									<p className="px-5 py-4 text-sm text-muted-foreground">
										No invoices issued in this period.
									</p>
								) : (
									<table className="w-full text-[0.9375rem]">
										<thead>
											<tr className="border-b text-left text-xs text-muted-foreground [&>th]:px-5 [&>th]:py-2.5 [&>th]:font-medium">
												<th>Rate</th>
												<th className="text-right">Invoices</th>
												<th className="text-right">Taxable amount</th>
												<th className="text-right">Tax</th>
											</tr>
										</thead>
										<tbody className="divide-y">
											{report.taxes.map((tax) => (
												<tr key={tax.rate} className="tabular-nums [&>td]:px-5 [&>td]:py-2.5">
													<td>{tax.rate === 0 ? "No tax" : `${formatRate(tax.rate)}%`}</td>
													<td className="text-right text-muted-foreground">{tax.invoiceCount}</td>
													<td className="text-right">{formatAmount(tax.base, report.currency)}</td>
													<td className="text-right">
														{formatAmount(tax.amount, report.currency)}
													</td>
												</tr>
											))}
										</tbody>
										<tfoot>
											<tr className="border-t font-medium tabular-nums [&>td]:px-5 [&>td]:py-2.5">
												<td>Total</td>
												<td />
												<td className="text-right">
													{formatAmount(
														report.taxes.reduce((sum, tax) => sum + tax.base, 0),
														report.currency,
													)}
												</td>
												<td className="text-right">
													{formatAmount(report.taxTotal, report.currency)}
												</td>
											</tr>
										</tfoot>
									</table>
								)}
							</PanelBody>
							<PanelFooter>
								By issue date, after discounts. Drafts and void invoices are left out.
							</PanelFooter>
						</Panel>
					</PageSection>
				</>
			)}

			<PageSection>
				<ExportPanel from={range.from} to={range.to} />
			</PageSection>
		</Page>
	);
}

function ExportPanel({ from, to }: { from: string; to: string }) {
	const [busy, setBusy] = useState<ReportExportKind | null>(null);
	const run = async (kind: ReportExportKind, unit: [string, string]) => {
		setBusy(kind);
		try {
			const result = await rpc("reports.export", { kind, from, to });
			if (!result) return;
			if (result.count === 0) {
				toast.info(`No ${unit[1]} in this period`);
				return;
			}
			const { path } = result;
			toast.success(`Exported ${result.count} ${result.count === 1 ? unit[0] : unit[1]}`, {
				description: path.split(/[\\/]/).pop(),
				action: {
					label: revealLabel,
					onClick: () => void rpc("files.reveal", { path }).catch(showSaveError),
				},
			});
		} catch (error) {
			showSaveError(error);
		} finally {
			setBusy(null);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Export</PanelTitle>
				<PanelLabel>For your accountant</PanelLabel>
			</PanelHeader>
			<PanelBody>
				<RowList>
					{EXPORTS.map(({ kind, label, description, icon: Icon, unit }) => (
						<li key={kind} className="flex items-center gap-3">
							<Icon className="size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<div className="text-[0.9375rem]">
									{label}
									<span className="ml-2 font-mono text-xs text-muted-foreground uppercase">
										{kind === "pdfs" ? "zip" : "csv"}
									</span>
								</div>
								<div className="truncate text-sm text-muted-foreground">{description}</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								disabled={busy !== null}
								onClick={() => void run(kind, unit)}
							>
								{busy === kind ? <Spinner /> : <Download />}
								Export
							</Button>
						</li>
					))}
				</RowList>
			</PanelBody>
			<PanelFooter>
				Covers {formatIsoDate(from)} – {formatIsoDate(to)} in every currency. Amounts are plain
				numbers so spreadsheets can add them up.
			</PanelFooter>
		</Panel>
	);
}
