import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { DomainError } from "@dawnstudio/core";
import { app, BrowserWindow, dialog, type OpenDialogOptions } from "electron";

const MB = 1024 * 1024;
const MAX_LOGO_BYTES = 2 * MB;
const MAX_IMPORT_BYTES = 5 * MB;

const LOGO_TYPES = {
	png: "image/png",
	jpg: "image/jpeg",
	webp: "image/webp",
	svg: "image/svg+xml",
} as const;
type LogoType = keyof typeof LOGO_TYPES;

/** Stored image names: a content hash plus the detected type. Anything else is refused. */
export const LOGO_NAME = /^[0-9a-f]{32}\.(png|jpg|webp|svg)$/;

export const logosFolder = () => join(app.getPath("userData"), "logos");

/** Asks for one file, attached to the focused window. Returns null if cancelled. */
async function pickFile(options: OpenDialogOptions): Promise<string | null> {
	const window = BrowserWindow.getFocusedWindow();
	const opts: OpenDialogOptions = { ...options, properties: ["openFile"] };
	const result = window
		? await dialog.showOpenDialog(window, opts)
		: await dialog.showOpenDialog(opts);
	return result.canceled ? null : (result.filePaths[0] ?? null);
}

function readLimited(path: string, maxBytes: number, what: string): Buffer {
	if (statSync(path).size > maxBytes) {
		throw new DomainError("VALIDATION", `${what} is larger than ${maxBytes / MB} MB`);
	}
	return readFileSync(path);
}

/** Identifies the image from its first bytes, so a renamed file can't pass as an image. */
function detectLogoType(bytes: Buffer): LogoType | null {
	if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
		return "png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
	if (bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP")
		return "webp";
	if (/<svg[\s>]/i.test(bytes.toString("utf8", 0, Math.min(bytes.length, 4096)))) return "svg";
	return null;
}

/**
 * Lets the user pick an image (an invoice logo or a workspace avatar) and copies it into the
 * app's logo folder. Files are named by their content hash and never overwritten or deleted,
 * so issued invoice snapshots that point at an older logo keep working. Returns the stored
 * file name, or null if cancelled.
 */
export async function chooseLogo(title = "Choose a logo"): Promise<string | null> {
	const path = await pickFile({
		title,
		filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
	});
	if (!path) return null;
	const bytes = readLimited(path, MAX_LOGO_BYTES, "The image");
	const type = detectLogoType(bytes);
	if (!type) throw new DomainError("VALIDATION", "Choose a PNG, JPG, WebP or SVG image");

	const fileName = `${createHash("sha256").update(bytes).digest("hex").slice(0, 32)}.${type}`;
	mkdirSync(logosFolder(), { recursive: true });
	const target = join(logosFolder(), fileName);
	if (!existsSync(target)) writeFileSync(target, bytes);
	return fileName;
}

/** The logo as a data URL for <img>, or null if the file is missing. */
export function logoDataUrl(fileName: string): string | null {
	const type = fileName.split(".").pop() as LogoType;
	// Names come from chooseLogo; anything else (e.g. "../x") is refused.
	if (!LOGO_NAME.test(fileName) || !(type in LOGO_TYPES)) return null;
	const path = join(logosFolder(), fileName);
	if (!existsSync(path)) return null;
	return `data:${LOGO_TYPES[type]};base64,${readFileSync(path).toString("base64")}`;
}

/** Lets the user pick a CSV file and returns its text. */
export async function chooseCsvFile(): Promise<{ fileName: string; text: string } | null> {
	const path = await pickFile({
		title: "Import clients",
		filters: [{ name: "CSV", extensions: ["csv", "tsv", "txt"] }],
	});
	if (!path) return null;
	const text = readLimited(path, MAX_IMPORT_BYTES, "The file").toString("utf8");
	return { fileName: basename(path), text };
}
