import {
	DEFAULT_EMAIL_TEMPLATES,
	EMAIL_VARIABLES,
	type EmailTemplate,
	type EmailTemplates,
} from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import { Field, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useId, useState } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useRpcMutation, useRpcQuery } from "../../lib/queries";

/** Settings: the text used when sending invoices and payment reminders. */
export function EmailPanel() {
	const { data } = useRpcQuery("emailTemplates.get");
	if (!data) return null;
	return <EmailForm key={JSON.stringify(data)} saved={data} />;
}

function EmailForm({ saved }: { saved: EmailTemplates }) {
	const [templates, setTemplates] = useState(saved);
	const [tab, setTab] = useState<keyof EmailTemplates>("invoice");
	const save = useRpcMutation("emailTemplates.save", ["emailTemplates"]);
	const dirty = JSON.stringify(templates) !== JSON.stringify(saved);
	const current = templates[tab];
	const set = (patch: Partial<EmailTemplate>) =>
		setTemplates((all) => ({ ...all, [tab]: { ...all[tab], ...patch } }));
	const isDefault = JSON.stringify(current) === JSON.stringify(DEFAULT_EMAIL_TEMPLATES[tab]);

	const onSave = async () => {
		try {
			await save.mutateAsync(templates);
			toast.success("Email templates saved");
		} catch (error) {
			showSaveError(error);
		}
	};

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Email</PanelTitle>
				<PanelLabel>{dirty ? "Unsaved" : "Used by Send"}</PanelLabel>
			</PanelHeader>
			<PanelBody className="flex flex-col gap-5">
				<div className="flex w-fit rounded-md border p-0.5">
					{(
						[
							["invoice", "Invoice"],
							["reminder", "Payment reminder"],
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type="button"
							aria-pressed={tab === value}
							onClick={() => setTab(value)}
							className={cn(
								"h-7 rounded-[5px] px-3 text-sm text-muted-foreground transition-colors",
								tab === value && "bg-accent font-medium text-foreground",
							)}
						>
							{label}
						</button>
					))}
				</div>
				<TemplateFields template={current} onChange={set} />
				<p className="text-sm text-muted-foreground">
					Variables:{" "}
					{EMAIL_VARIABLES.map((variable, index) => (
						<span key={variable}>
							<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
								{`{${variable}}`}
							</code>
							{index < EMAIL_VARIABLES.length - 1 ? " " : ""}
						</span>
					))}
				</p>
				<div className="flex justify-end gap-2">
					{!isDefault ? (
						<Button type="button" variant="ghost" onClick={() => set(DEFAULT_EMAIL_TEMPLATES[tab])}>
							Use default text
						</Button>
					) : null}
					<Button type="button" onClick={onSave} disabled={!dirty || save.isPending}>
						{save.isPending ? <Spinner /> : null}
						Save templates
					</Button>
				</div>
			</PanelBody>
		</Panel>
	);
}

function TemplateFields({
	template,
	onChange,
}: {
	template: EmailTemplate;
	onChange: (patch: Partial<EmailTemplate>) => void;
}) {
	const subjectId = useId();
	const bodyId = useId();
	return (
		<>
			<Field>
				<FieldLabel htmlFor={subjectId}>Subject</FieldLabel>
				<Input
					id={subjectId}
					value={template.subject}
					onChange={(event) => onChange({ subject: event.target.value })}
					maxLength={300}
				/>
			</Field>
			<Field>
				<FieldLabel htmlFor={bodyId}>Message</FieldLabel>
				<Textarea
					id={bodyId}
					value={template.body}
					onChange={(event) => onChange({ body: event.target.value })}
					rows={7}
				/>
			</Field>
		</>
	);
}
