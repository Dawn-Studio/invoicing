import { emailValues, fillTemplate, type Invoice } from "@dawnstudio/core";
import { Button } from "@dawnstudio/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@dawnstudio/ui/components/dialog";
import { Field, FieldError, FieldLabel } from "@dawnstudio/ui/components/field";
import { Input } from "@dawnstudio/ui/components/input";
import { Label } from "@dawnstudio/ui/components/label";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { Switch } from "@dawnstudio/ui/components/switch";
import { Textarea } from "@dawnstudio/ui/components/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useClient, useRpcQuery } from "../../lib/queries";
import { rpc } from "../../lib/rpc";

const isMac = window.api.platform === "darwin";

/** Email an issued invoice (or a reminder) with the PDF, then confirm it went out. */
export function SendDialog({
	invoice,
	reminder,
	open,
	onOpenChange,
}: {
	invoice: Invoice;
	/** Start with the reminder template (overdue invoices). */
	reminder: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-xl">
				{open ? (
					<SendForm
						invoice={invoice}
						startAsReminder={reminder}
						onDone={() => onOpenChange(false)}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function SendForm({
	invoice,
	startAsReminder,
	onDone,
}: {
	invoice: Invoice;
	startAsReminder: boolean;
	onDone: () => void;
}) {
	const queryClient = useQueryClient();
	const snapshot = invoice.snapshot;
	const { data: templates } = useRpcQuery("emailTemplates.get");
	const { data: client } = useClient(invoice.clientId ?? undefined);
	const values = snapshot ? emailValues(snapshot, invoice.amountPaid) : null;

	const [reminder, setReminder] = useState(startAsReminder);
	const [to, setTo] = useState(snapshot?.client.email ?? "");
	const [excluded, setExcluded] = useState<Set<string>>(new Set());
	const [edited, setEdited] = useState<{ subject: string; body: string } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<"mail" | "default" | null>(null);
	const [opened, setOpened] = useState<{ fileName: string; app: "mail" | "default" } | null>(null);

	// Until edited, the text follows the chosen template.
	const template = templates?.[reminder ? "reminder" : "invoice"];
	const subject =
		edited?.subject ?? (template && values ? fillTemplate(template.subject, values) : "");
	const body = edited?.body ?? (template && values ? fillTemplate(template.body, values) : "");
	const contacts = client?.contacts ?? [];
	const cc = contacts.map((c) => c.email).filter((email) => !excluded.has(email) && email !== to);

	const open = async (app: "mail" | "default") => {
		setError(null);
		setPending(app);
		try {
			const result = await rpc("invoices.email", { id: invoice.id, to, cc, subject, body, app });
			setOpened({ fileName: result.fileName, app });
		} catch (failure) {
			if (failure instanceof Error && /email/i.test(failure.message)) setError(failure.message);
			else showSaveError(failure);
		} finally {
			setPending(null);
		}
	};

	const markSent = async () => {
		try {
			await rpc("invoices.markSent", { id: invoice.id, to, reminder });
			void queryClient.invalidateQueries({ queryKey: ["invoices", "events"] });
			toast.success(reminder ? "Reminder marked as sent" : `${invoice.number} marked as sent`);
			onDone();
		} catch (failure) {
			showSaveError(failure);
		}
	};

	if (opened) {
		return (
			<>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<MailCheck className="size-5 text-brand-ink" />
						Did it go out?
					</DialogTitle>
					<DialogDescription>
						{opened.app === "mail"
							? `A draft to ${to} with ${opened.fileName} attached is open in Mail.`
							: `Your email app has the message to ${to}. Drag ${opened.fileName} from the folder that just opened into it.`}{" "}
						Mark it as sent once you've sent it, so it shows in the activity.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="ghost" onClick={onDone}>
						Not yet
					</Button>
					<Button onClick={markSent}>Mark as sent</Button>
				</DialogFooter>
			</>
		);
	}

	return (
		<form
			className="flex flex-col gap-5"
			onSubmit={(event) => {
				event.preventDefault();
				void open(isMac ? "mail" : "default");
			}}
		>
			<DialogHeader>
				<DialogTitle>{reminder ? "Send a reminder" : `Send ${invoice.number}`}</DialogTitle>
				<DialogDescription>
					The PDF is attached{isMac ? " in Apple Mail" : ""}. Edit the text below or change the
					templates in Settings.
				</DialogDescription>
			</DialogHeader>

			<Labeled label="To" error={error}>
				{(id) => (
					<Input
						id={id}
						type="email"
						value={to}
						onChange={(event) => setTo(event.target.value)}
						placeholder="billing@client.com"
						aria-invalid={Boolean(error)}
						autoFocus={!to}
					/>
				)}
			</Labeled>

			{contacts.length > 0 ? (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-medium">Copy to</span>
					{contacts.map((contact) => (
						<div key={contact.email} className="flex items-center gap-2">
							<Switch
								id={`cc-${contact.email}`}
								size="sm"
								checked={!excluded.has(contact.email)}
								onCheckedChange={(checked) =>
									setExcluded((current) => {
										const next = new Set(current);
										if (checked) next.delete(contact.email);
										else next.add(contact.email);
										return next;
									})
								}
							/>
							<Label htmlFor={`cc-${contact.email}`} className="font-normal">
								{contact.name ? `${contact.name} · ` : ""}
								<span className="text-muted-foreground">{contact.email}</span>
							</Label>
						</div>
					))}
				</div>
			) : null}

			{invoice.status === "issued" ? (
				<div className="flex items-center gap-2">
					<Switch
						id="as-reminder"
						size="sm"
						checked={reminder}
						onCheckedChange={(checked) => {
							setReminder(checked);
							setEdited(null);
						}}
					/>
					<Label htmlFor="as-reminder" className="font-normal">
						Payment reminder
					</Label>
				</div>
			) : null}

			<Labeled label="Subject">
				{(id) => (
					<Input
						id={id}
						value={subject}
						onChange={(event) => setEdited({ subject: event.target.value, body })}
						maxLength={300}
					/>
				)}
			</Labeled>
			<Labeled label="Message">
				{(id) => (
					<Textarea
						id={id}
						value={body}
						onChange={(event) => setEdited({ subject, body: event.target.value })}
						rows={8}
						className="max-h-72"
					/>
				)}
			</Labeled>

			<DialogFooter className="sm:justify-between">
				{isMac ? (
					<Button
						type="button"
						variant="ghost"
						onClick={() => open("default")}
						disabled={pending !== null || !to || !subject.trim()}
					>
						{pending === "default" ? <Spinner /> : null}
						Other email app
					</Button>
				) : (
					<span />
				)}
				<Button type="submit" disabled={pending !== null || !to || !subject.trim()}>
					{pending === (isMac ? "mail" : "default") ? <Spinner /> : null}
					{isMac ? "Open in Mail" : "Open email app"}
				</Button>
			</DialogFooter>
		</form>
	);
}

function Labeled({
	label,
	error,
	children,
}: {
	label: string;
	error?: string | null;
	children: (id: string) => ReactNode;
}) {
	const id = useId();
	return (
		<Field data-invalid={Boolean(error)}>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{children(id)}
			{error ? <FieldError>{error}</FieldError> : null}
		</Field>
	);
}
