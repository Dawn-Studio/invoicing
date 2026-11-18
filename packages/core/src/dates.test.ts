import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, todayIso } from "./dates";
import { uuidv7 } from "./ids";

describe("dates", () => {
	it("validates real calendar dates", () => {
		expect(isIsoDate("2026-02-28")).toBe(true);
		expect(isIsoDate("2028-02-29")).toBe(true);
		expect(isIsoDate("2026-02-29")).toBe(false);
		expect(isIsoDate("2026-13-01")).toBe(false);
		expect(isIsoDate("2026-1-01")).toBe(false);
	});

	it("adds days across month and year ends", () => {
		expect(addDays("2026-11-17", 14)).toBe("2026-12-01");
		expect(addDays("2026-12-25", 30)).toBe("2027-01-24");
		expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("uses the local calendar date", () => {
		expect(todayIso(new Date(2026, 10, 17, 23, 59))).toBe("2026-11-17");
	});
});

describe("uuidv7", () => {
	it("produces RFC 9562 version 7 ids that sort by time", () => {
		const a = uuidv7(1_700_000_000_000);
		const b = uuidv7(1_700_000_000_001);
		expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(a < b).toBe(true);
		expect(a.slice(0, 13)).toBe("018bcfe5-6800");
	});
});
