import { exportFileName, formatInvoiceNumber, todayIso } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@dawnstudio/ui/components/panel";
import { useId, useState } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useProfile, useRpcMutation, useRpcQuery } from "../../lib/queries";

/** Settings: how exported PDFs are named and where the save dialog opens. */
export function ExportPanel() {
	const { data: settings } = useRpcQuery("exportSettings.get");
	if (!settings) return null;
	return <ExportForm key={settings.pattern} pattern={settings.pattern} folder={settings.folder} />;
}

function ExportForm({ pattern: saved, folder }: { pattern: string; folder: string }) {
	const id = useId();
	const [pattern, setPattern] = useState(saved);
	const { data: profile } = useProfile();
	const save = useRpcMutation("exportSettings.save", ["exportSettings"]);
	const choose = useRpcMutation("exportSettings.chooseFolder", ["exportSettings"]);
	const example = exportFileName(pattern, {
		number: profile
			? formatInvoiceNumber(profile.numberPattern, profile.nextSequence, todayIso())
			: "INV-0042",
		client: "Northwind Studio",
		date: todayIso(),
	});

	const onSave = async () => {
		try {
			await save.mutateAsync({ pattern });
			toast.success("Saved");
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>PDF export</PanelTitle>
			</PanelHeader>
			<PanelBody className="flex flex-col gap-5">
				<form
					className="flex items-end gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						void onSave();
					}}
				>
					<Field className="flex-1">
						<FieldLabel htmlFor={id}>File name</FieldLabel>
						<Input
							id={id}
							value={pattern}
							onChange={(event) => setPattern(event.target.value)}
							placeholder="{number} {client}"
							maxLength={100}
							className="font-mono"
						/>
						<FieldDescription>
							Use {"{number}"}, {"{client}"} and {"{date}"}. Example:{" "}
							<span className="text-foreground">{example}</span>
						</FieldDescription>
					</Field>
					<Button
						type="submit"
						variant="outline"
						className="mb-[26px]"
						disabled={pattern.trim() === saved || save.isPending}
					>
						Save
					</Button>
				</form>
				<div className="flex items-center justify-between gap-4 border-t pt-5">
					<div className="min-w-0">
						<div className="text-sm font-medium">Save to</div>
						<div className="truncate font-mono text-sm text-muted-foreground" title={folder}>
							{folder}
						</div>
						<div className="text-sm text-muted-foreground">
							The save dialog opens here and remembers where you last saved.
						</div>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={() => choose.mutateAsync(undefined).catch(showSaveError)}
						disabled={choose.isPending}
					>
						Change…
					</Button>
				</div>
			</PanelBody>
		</Panel>
	);
}
