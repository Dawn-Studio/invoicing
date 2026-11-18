import {
	CLIENT_IMPORT_LABELS,
	type ClientImportPreview,
	type ClientInput,
	parseClientsCsv,
} from "@dawnstudio/core";
import { Alert, AlertDescription, AlertTitle } from "@dawnstudio/ui/components/alert";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { joinParts } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import { useClients, useImportClients } from "../../lib/queries";
import { rpc } from "../../lib/rpc";

type RowStatus = "new" | "exists" | "duplicate" | "error";

const statusText: Record<RowStatus, string> = {
	new: "New",
	exists: "Already added",
	duplicate: "Duplicate",
	error: "Error",
};

interface Loaded {
	fileName: string;
	preview: ClientImportPreview;
}

export function ImportClientsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [choosing, setChoosing] = useState(false);
	const { data: existing = [] } = useClients({ includeArchived: true });
	const importClients = useImportClients();

	const close = (next: boolean) => {
		onOpenChange(next);
		if (!next) setLoaded(null);
	};

	const chooseFile = async () => {
		setChoosing(true);
		try {
			const file = await rpc("clients.chooseImportFile");
			if (file) setLoaded({ fileName: file.fileName, preview: parseClientsCsv(file.text) });
		} catch (error) {
			showSaveError(error);
		} finally {
			setChoosing(false);
		}
	};

	// Same rule as the import itself: a name that already exists (any case) is skipped.
	const rows = useMemo(() => {
		if (!loaded) return [];
		const names = new Set(existing.map((client) => client.name.toLowerCase()));
		return loaded.preview.rows.map((row) => {
			let status: RowStatus = "error";
			if (row.client) {
				const key = row.client.name.toLowerCase();
				status = names.has(key) ? "exists" : "new";
				if (status === "new") names.add(key);
				else if (!existing.some((client) => client.name.toLowerCase() === key)) {
					status = "duplicate";
				}
			}
			return { ...row, status };
		});
	}, [loaded, existing]);

	const ready = rows.flatMap((row) =>
		row.status === "new" && row.client ? [row.client as ClientInput] : [],
	);
	const count = (status: RowStatus) => rows.filter((row) => row.status === status).length;

	const runImport = async () => {
		try {
			const result = await importClients.mutateAsync({ clients: ready });
			toast.success(
				`Imported ${result.created} ${result.created === 1 ? "client" : "clients"}`,
				result.skipped.length > 0
					? { description: `Skipped ${result.skipped.length} that already existed.` }
					: undefined,
			);
			close(false);
		} catch (error) {
			showSaveError(error);
		}
	};

	const usedColumns = loaded?.preview.columns.filter((column) => column.field) ?? [];
	const ignoredColumns = loaded?.preview.columns.filter((column) => !column.field) ?? [];

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Import clients</DialogTitle>
					<DialogDescription>
						From a CSV file exported from a spreadsheet or another invoicing tool. The first row
						must name the columns.
					</DialogDescription>
				</DialogHeader>

				{!loaded ? (
					<div className="flex flex-col gap-4">
						<div className="rounded-lg border bg-panel-header px-4 py-3 text-sm text-muted-foreground">
							Recognised columns:{" "}
							<span className="text-foreground">
								{Object.values(CLIENT_IMPORT_LABELS).join(", ")}
							</span>
							. Only a name is required; other columns are ignored. Clients whose name already
							exists are skipped.
						</div>
					</div>
				) : loaded.preview.error ? (
					<Alert variant="destructive">
						<AlertTitle>Can't import {loaded.fileName}</AlertTitle>
						<AlertDescription>{loaded.preview.error}</AlertDescription>
					</Alert>
				) : (
					<div className="flex min-w-0 flex-col gap-3">
						<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
							<span className="truncate font-medium">{loaded.fileName}</span>
							<span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
								{joinParts(
									`${count("new")} new`,
									count("exists") ? `${count("exists")} already added` : null,
									count("duplicate")
										? `${count("duplicate")} duplicate${count("duplicate") === 1 ? "" : "s"}`
										: null,
									count("error") ? `${count("error")} with errors` : null,
								)}
							</span>
						</div>
						<ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
							{rows.map((row) => (
								<li key={row.line} className="flex items-start gap-3 px-3 py-2.5 text-sm">
									<div className="min-w-0 flex-1">
										<div className={cn(row.status !== "new" && "text-muted-foreground")}>
											{row.name || <span className="italic">No name</span>}
										</div>
										{row.status === "error" ? (
											<div className="text-destructive">
												Line {row.line}: {row.errors.join("; ")}
											</div>
										) : row.client ? (
											<div className="truncate text-muted-foreground">
												{joinParts(
													row.client.contactName,
													row.client.email,
													row.client.address?.country,
												)}
											</div>
										) : null}
									</div>
									<span
										className={cn(
											"shrink-0 font-mono text-xs tracking-wider uppercase",
											row.status === "error" ? "text-destructive" : "text-muted-foreground",
										)}
									>
										{statusText[row.status]}
									</span>
								</li>
							))}
						</ul>
						<p className="text-sm text-muted-foreground">
							Using {usedColumns.map((column) => column.header).join(", ")}
							{ignoredColumns.length > 0
								? `; ignoring ${ignoredColumns.map((column) => column.header || "(blank)").join(", ")}`
								: ""}
							.
						</p>
					</div>
				)}

				<DialogFooter>
					<Button
						type="button"
						variant={loaded ? "ghost" : "default"}
						onClick={chooseFile}
						disabled={choosing || importClients.isPending}
						className={cn(loaded && "sm:mr-auto")}
					>
						{choosing ? <Spinner /> : <FileUp />}
						{loaded ? "Choose another file" : "Choose CSV file…"}
					</Button>
					{loaded && !loaded.preview.error ? (
						<Button
							type="button"
							onClick={runImport}
							disabled={ready.length === 0 || importClients.isPending}
						>
							{importClients.isPending ? <Spinner /> : null}
							{ready.length === 1 ? "Import 1 client" : `Import ${ready.length} clients`}
						</Button>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
