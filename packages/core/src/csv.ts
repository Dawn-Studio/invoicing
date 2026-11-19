/**
 * Minimal RFC 4180 CSV reader: quoted fields, escaped quotes (""), newlines inside quotes,
 * CRLF/LF line endings and a leading BOM. The delimiter is detected from the header line
 * (comma, semicolon or tab) unless given, since spreadsheet apps in many locales export ";".
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
	const input = text.startsWith("﻿") ? text.slice(1) : text;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;

	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (quoted) {
			if (char === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}
		} else if (char === '"' && field === "") {
			quoted = true;
		} else if (char === delimiter) {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && input[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

const DELIMITERS = [",", ";", "\t"] as const;

/** Picks the delimiter that occurs most often (outside quotes) on the first line. */
export function detectDelimiter(text: string): string {
	const counts = new Map<string, number>(DELIMITERS.map((d) => [d, 0]));
	let quoted = false;
	for (const char of text) {
		if (char === '"') quoted = !quoted;
		else if (!quoted && (char === "\n" || char === "\r")) break;
		else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
	}
	let best = ",";
	for (const [delimiter, count] of counts) {
		if (count > (counts.get(best) ?? 0)) best = delimiter;
	}
	return best;
}

/**
 * Writes RFC 4180 CSV with CRLF line endings and a BOM so Excel reads UTF-8 correctly.
 * Text that a spreadsheet would run as a formula (=, +, -, @ at the start) gets a leading
 * apostrophe; plain numbers such as "-12.50" are left alone.
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
	const cell = (value: string | number | null | undefined) => {
		let text = value === null || value === undefined ? "" : String(value);
		if (/^[=+\-@\t\r]/.test(text) && !/^[-+]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
		return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
	};
	return `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
