import { describe, expect, it } from "vitest";
import { exportFileName } from "./export-name";

const values = { number: "INV-2026-0042", client: "Halden Studio AB", date: "2026-11-18" };

describe("exportFileName", () => {
	it("fills the pattern", () => {
		expect(exportFileName("{number} {client}", values)).toBe("INV-2026-0042 Halden Studio AB.pdf");
		expect(exportFileName("{date}_{number}", values)).toBe("2026-11-18_INV-2026-0042.pdf");
	});

	it("replaces characters file systems reject", () => {
		expect(exportFileName("{number} {client}", { ...values, client: 'A/B: "C"?' })).toBe(
			"INV-2026-0042 A-B- -C--.pdf",
		);
	});

	it("falls back when the pattern is empty or fills to nothing", () => {
		expect(exportFileName("", values)).toBe("INV-2026-0042 Halden Studio AB.pdf");
		expect(exportFileName("{client}", { ...values, client: "..." })).toBe("INV-2026-0042.pdf");
	});
});
