import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import {
	DEFAULT_EMAIL_TEMPLATES,
	DomainError,
	type EmailTemplates,
	exportFileName,
} from "@dawnstudio/core";
import type { Repositories } from "@dawnstudio/db";
import { app, shell } from "electron";
import { getExportSettings, renderPdf } from "./pdf";

/**
 * Sending without an email integration: the PDF is written to an outbox folder, then either
 * Apple Mail gets a ready-to-send draft with the PDF attached (macOS), or the default email
 * app opens a pre-filled message (mailto: can't attach files) and the PDF is shown in the
 * file manager to drag in.
 */

const TEMPLATES_KEY = "email.templates";

export function getEmailTemplates(repos: Repositories): EmailTemplates {
	const saved = repos.settings.get<Partial<EmailTemplates>>(TEMPLATES_KEY) ?? {};
	return {
		invoice: { ...DEFAULT_EMAIL_TEMPLATES.invoice, ...saved.invoice },
		reminder: { ...DEFAULT_EMAIL_TEMPLATES.reminder, ...saved.reminder },
	};
}

export function saveEmailTemplates(repos: Repositories, templates: EmailTemplates) {
	repos.settings.set(TEMPLATES_KEY, templates);
	return getEmailTemplates(repos);
}

export interface EmailRequest {
	id: string;
	to: string;
	cc: string[];
	subject: string;
	body: string;
	/** "mail" = Apple Mail draft with the PDF attached (macOS); "default" = mailto. */
	app: "mail" | "default";
}

const outbox = () => join(app.getPath("userData"), "outbox");

// Values arrive as arguments, never spliced into the script, so quotes can't break it.
const MAIL_SCRIPT = `
on run argv
	set theSubject to item 1 of argv
	set theBody to item 2 of argv
	set theAttachment to POSIX file (item 3 of argv)
	set theTo to item 4 of argv
	tell application "Mail"
		set newMessage to make new outgoing message with properties {subject:theSubject, content:theBody & return & return, visible:true}
		tell newMessage
			make new to recipient at end of to recipients with properties {address:theTo}
			repeat with i from 5 to count of argv
				make new cc recipient at end of cc recipients with properties {address:(item i of argv)}
			end repeat
			make new attachment with properties {file name:theAttachment} at after the last paragraph
		end tell
		activate
	end tell
end run`;

export async function prepareEmail(
	repos: Repositories,
	request: EmailRequest,
): Promise<{ fileName: string }> {
	const invoice = repos.invoices.get(request.id);
	if (!invoice.snapshot || !invoice.number) {
		throw new DomainError("INVALID_STATE", "Issue the invoice before sending it");
	}
	const fileName = exportFileName(getExportSettings(repos).pattern, {
		number: invoice.number,
		client: invoice.snapshot.client.name,
		date: invoice.issueDate,
	});
	mkdirSync(outbox(), { recursive: true });
	const path = join(outbox(), fileName);
	writeFileSync(path, await renderPdf(invoice));

	if (request.app === "mail") {
		if (process.platform !== "darwin") {
			throw new DomainError("VALIDATION", "Apple Mail is only available on macOS");
		}
		try {
			await promisify(execFile)("osascript", [
				"-e",
				MAIL_SCRIPT,
				request.subject,
				request.body,
				path,
				request.to,
				...request.cc,
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new DomainError(
				"INVALID_STATE",
				/not allowed|-1743/i.test(message)
					? "Invoicing isn't allowed to control Mail. Allow it in System Settings → Privacy & Security → Automation, or use another email app."
					: "Couldn't open Apple Mail. Try another email app.",
			);
		}
		return { fileName };
	}

	const query = [
		request.cc.length > 0 ? `cc=${encodeURIComponent(request.cc.join(","))}` : null,
		`subject=${encodeURIComponent(request.subject)}`,
		`body=${encodeURIComponent(request.body)}`,
	]
		.filter(Boolean)
		.join("&");
	await shell.openExternal(`mailto:${encodeURIComponent(request.to)}?${query}`);
	// mailto can't carry attachments: show the PDF so it can be dragged into the message.
	shell.showItemInFolder(path);
	return { fileName };
}
