/** Currencies shown first in pickers; the rest follow alphabetically. */
const COMMON = [
	"EUR",
	"USD",
	"GBP",
	"CHF",
	"PLN",
	"CZK",
	"SEK",
	"NOK",
	"DKK",
	"UAH",
	"CAD",
	"AUD",
	"JPY",
];

const names = new Intl.DisplayNames(undefined, { type: "currency" });

export interface CurrencyOption {
	code: string;
	name: string;
}

let options: CurrencyOption[] | undefined;

export function currencyOptions(): CurrencyOption[] {
	if (!options) {
		const all = Intl.supportedValuesOf("currency");
		const rest = all.filter((code) => !COMMON.includes(code));
		options = [...COMMON.filter((code) => all.includes(code)), ...rest].map((code) => ({
			code,
			name: names.of(code) ?? code,
		}));
	}
	return options;
}

export const currencyName = (code: string) => names.of(code) ?? code;
