import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DomainError } from "@dawnstudio/core";
import { app } from "electron";
import type { AssistantAttachment } from "../../shared/contract";

/**
 * Files attached to assistant messages. Stored once, named by content hash, so messages
 * reference them as `attachment:<id>` instead of carrying the bytes in the database. Images
 * and PDFs go to the model as files; text files (CSV timesheets, notes) go as text.
 */

const MAX_BYTES = 20 * 1024 * 1024;

const KINDS = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp",
	gif: "image/gif",
	pdf: "application/pdf",
	txt: "text/plain",
	csv: "text/csv",
	md: "text/markdown",
	json: "application/json",
} as const;
type Kind = keyof typeof KINDS;

export const folder = () => join(app.getPath("userData"), "attachments");

const TEXT_EXTENSIONS: Record<string, Kind> = {
	txt: "txt",
	text: "txt",
	log: "txt",
	csv: "csv",
	tsv: "csv",
	md: "md",
	markdown: "md",
	json: "json",
};

/** Works out what a file is from its bytes (and its name, for text), never trusting the type. */
function detect(bytes: Buffer, filename: string): Kind | null {
	if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
		return "png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
	if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP")
		return "webp";
	if (bytes.toString("latin1", 0, 4) === "GIF8") return "gif";
	if (bytes.toString("latin1", 0, 5) === "%PDF-") return "pdf";
	const extension = filename.split(".").pop()?.toLowerCase() ?? "";
	const textKind = TEXT_EXTENSIONS[extension];
	// Text: a known extension and no NUL bytes in the first 64 KB.
	if (textKind && !bytes.subarray(0, 65_536).includes(0)) return textKind;
	return null;
}

const ID = /^[0-9a-f]{32}\.(png|jpg|webp|gif|pdf|txt|csv|md|json)$/;

export function saveAttachment(input: { filename: string; data: string }): AssistantAttachment {
	const bytes = Buffer.from(input.data, "base64");
	if (bytes.length === 0) throw new DomainError("VALIDATION", "The file is empty");
	if (bytes.length > MAX_BYTES) throw new DomainError("VALIDATION", "Files can be up to 20 MB");
	const kind = detect(bytes, input.filename);
	if (!kind) {
		throw new DomainError(
			"VALIDATION",
			"Attach images (PNG, JPG, WebP, GIF), PDFs or text files (CSV, TXT, Markdown, JSON)",
		);
	}
	const id = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${kind}`;
	mkdirSync(folder(), { recursive: true });
	const path = join(folder(), id);
	if (!existsSync(path)) writeFileSync(path, bytes);
	return {
		id,
		filename: input.filename,
		mediaType: KINDS[kind],
		size: bytes.length,
		url: `attachment:${id}`,
	};
}

export function readAttachment(id: string): { bytes: Buffer; mediaType: string } | null {
	if (!ID.test(id)) return null;
	const path = join(folder(), id);
	if (!existsSync(path)) return null;
	const kind = id.split(".").pop() as Kind;
	return { bytes: readFileSync(path), mediaType: KINDS[kind] };
}

export function attachmentDataUrl(id: string): string | null {
	const file = readAttachment(id);
	return file ? `data:${file.mediaType};base64,${file.bytes.toString("base64")}` : null;
}

export const isTextType = (mediaType: string) =>
	mediaType.startsWith("text/") || mediaType === "application/json";
