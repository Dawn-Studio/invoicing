/** Default name for exported PDFs, e.g. "INV-2026-0042 Halden Studio AB.pdf". */
export const DEFAULT_EXPORT_PATTERN = "{number} {client}";

export const EXPORT_PATTERN_TOKENS = ["{number}", "{client}", "{date}"] as const;

/**
 * Builds a PDF file name from a pattern. Characters that aren't allowed in file names on
 * macOS, Windows or Linux are replaced, and the result is never empty.
 */
export function exportFileName(
	pattern: string,
	values: { number: string; client: string; date: string },
): string {
	const filled = (pattern.trim() || DEFAULT_EXPORT_PATTERN)
		.replaceAll("{number}", values.number)
		.replaceAll("{client}", values.client)
		.replaceAll("{date}", values.date);
	const safe = filled
		// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what we strip
		.replaceAll(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
		.replaceAll(/\s+/g, " ")
		.replace(/^[\s.]+|[\s.]+$/g, "")
		.slice(0, 120);
	return `${safe || values.number || "invoice"}.pdf`;
}
