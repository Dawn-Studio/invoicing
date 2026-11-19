import { todayIso } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Panel,
	PanelBody,
	PanelFooter,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Skeleton } from "@dawnstudio/ui/components/skeleton";
import {
	ArrowRight,
	Circle,
	CircleAlert,
	CircleCheck,
	Sparkles,
	SquarePen,
	Wallet,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { Page, PageSection } from "../../components/page";
import { LoadError } from "../../components/states";
import { formatAmount } from "../../lib/format";
import { useClients, useDashboardReport, usePaymentAccounts } from "../../lib/queries";
import { dueText } from "../invoices/invoice-row";
import { useStartInvoice } from "../invoices/use-start-invoice";
import { CurrencyMenu, MonthlyChart, StatTile } from "../reports/report-parts";

const plural = (count: number, one: string, many = `${one}s`) =>
	`${count} ${count === 1 ? one : many}`;

/** How the business is doing at a glance, in one currency at a time. */
export function DashboardPage() {
	const [params, setParams] = useSearchParams();
	const requested = params.get("currency") ?? undefined;
	const { data: report, error, refetch } = useDashboardReport(requested);
	const today = todayIso();
	const year = today.slice(0, 4);

	const setCurrency = (currency: string) =>
		setParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("currency", currency);
				return next;
			},
			{ replace: true },
		);

	return (
		<Page
			title="Dashboard"
			className="max-w-4xl"
			actions={
				report ? (
					<CurrencyMenu
						currency={report.currency}
						currencies={report.currencies}
						onChange={setCurrency}
					/>
				) : null
			}
		>
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
			) : report.currencies.length === 0 && report.draftCount === 0 ? (
				<PageSection>
					<GettingStarted />
				</PageSection>
			) : (
				<>
					<PageSection className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<StatTile
							label="Outstanding"
							icon={<Circle className="text-brand-ink" />}
							value={report.outstanding.amount}
							currency={report.currency}
							note={
								report.outstanding.count > 0
									? plural(report.outstanding.count, "open invoice")
									: "Nothing to collect"
							}
						/>
						<StatTile
							label="Overdue"
							icon={<CircleAlert className="text-destructive" />}
							value={report.overdue.amount}
							currency={report.currency}
							tone="danger"
							note={
								report.overdue.count > 0 ? plural(report.overdue.count, "invoice") : "All on time"
							}
						/>
						<StatTile
							label="Received this month"
							icon={<Wallet />}
							value={report.receivedThisMonth}
							currency={report.currency}
						/>
						<StatTile
							label={`Received in ${year}`}
							icon={<CircleCheck className="text-success" />}
							value={report.receivedThisYear}
							currency={report.currency}
						/>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Received per month</PanelTitle>
								<PanelLabel>Last 12 months</PanelLabel>
							</PanelHeader>
							<PanelBody className="pt-5 pb-3">
								<MonthlyChart months={report.months} currency={report.currency} />
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Overdue</PanelTitle>
								{report.overdue.count > report.overdueInvoices.length ? (
									<Button asChild variant="ghost" size="sm" className="text-muted-foreground">
										<Link to="/invoices?status=overdue">
											All {report.overdue.count}
											<ArrowRight />
										</Link>
									</Button>
								) : null}
							</PanelHeader>
							<PanelBody className="px-2 py-2">
								{report.overdueInvoices.length === 0 ? (
									<div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
										<CircleCheck className="size-4 text-success" />
										No overdue invoices. Nice.
									</div>
								) : (
									<ul className="flex flex-col">
										{report.overdueInvoices.map((invoice) => (
											<li key={invoice.id}>
												<Link
													to={`/invoices/${invoice.id}`}
													className="flex items-center gap-3 rounded-md px-3 py-2 text-[0.9375rem] transition-colors hover:bg-accent/60"
												>
													<CircleAlert className="size-3.5 shrink-0 text-destructive" />
													<span className="w-32 shrink-0 truncate font-mono text-sm">
														{invoice.number}
													</span>
													<span className="min-w-0 flex-1 truncate">{invoice.clientName}</span>
													<span className="shrink-0 text-sm text-destructive">
														{dueText(invoice, today)}
													</span>
													<span className="w-28 shrink-0 text-right tabular-nums">
														{formatAmount(invoice.total - invoice.amountPaid, invoice.currency)}
													</span>
												</Link>
											</li>
										))}
									</ul>
								)}
							</PanelBody>
							{report.draftCount > 0 ? (
								<PanelFooter>
									<Link to="/invoices?status=draft" className="hover:text-foreground">
										{plural(report.draftCount, "draft")} not issued yet
									</Link>
								</PanelFooter>
							) : null}
						</Panel>
					</PageSection>
				</>
			)}
		</Page>
	);
}

/** Before the first invoice: the few steps to get there, ticked off as they're done. */
function GettingStarted() {
	const { data: clients = [] } = useClients();
	const { data: accounts = [] } = usePaymentAccounts();
	const start = useStartInvoice();
	const steps = [
		{ label: "Set up your business", done: true, to: "/settings/business" },
		{ label: "Add a payment account", done: accounts.length > 0, to: "/settings/payments" },
		{ label: "Add your first client", done: clients.length > 0, to: "/clients/new" },
	];
	return (
		<Panel>
			<PanelBody className="flex flex-col items-center gap-6 py-12 text-center">
				<span className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-brand-ink">
					<Sparkles className="size-5" />
				</span>
				<div className="flex max-w-sm flex-col gap-2">
					<h2 className="text-lg font-medium tracking-tight">Ready for your first invoice</h2>
					<p className="text-sm/relaxed text-balance text-muted-foreground">
						Once you issue invoices, what you're owed, what's late and what came in each month shows
						up here.
					</p>
				</div>
				<ul className="flex w-full max-w-xs flex-col gap-1 text-left">
					{steps.map((step) => (
						<li key={step.label}>
							<Link
								to={step.to}
								className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[0.9375rem] transition-colors hover:bg-accent/60"
							>
								{step.done ? (
									<CircleCheck className="size-4 text-success" />
								) : (
									<Circle className="size-4 text-muted-foreground" />
								)}
								<span className={step.done ? "text-muted-foreground line-through" : undefined}>
									{step.label}
								</span>
							</Link>
						</li>
					))}
				</ul>
				<Button disabled={start.isPending} onClick={() => void start.run()}>
					<SquarePen />
					Create an invoice
				</Button>
			</PanelBody>
		</Panel>
	);
}
