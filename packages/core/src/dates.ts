/** Calendar dates are stored as ISO "YYYY-MM-DD" strings: no time zone, compare as strings. */
export type IsoDate = string;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): value is IsoDate {
	const match = ISO_DATE.exec(value);
	if (!match) return false;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
}

export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
	const match = ISO_DATE.exec(value);
	if (!match || !isIsoDate(value)) throw new RangeError(`Invalid date ${value}`);
	return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function addDays(date: IsoDate, days: number): IsoDate {
	const { year, month, day } = parseIsoDate(date);
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Today's date in the local time zone of the machine. */
export function todayIso(now: Date = new Date()): IsoDate {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
