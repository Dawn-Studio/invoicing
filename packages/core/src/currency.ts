const exponents = new Map<string, number>();
let supported: Set<string> | undefined;

/** True for ISO 4217 codes the runtime's Intl data knows about. */
export function isCurrencyCode(code: string): boolean {
	supported ??= new Set(Intl.supportedValuesOf("currency"));
	return supported.has(code);
}

/** Number of minor-unit digits: USD → 2, JPY → 0, KWD → 3. */
export function currencyExponent(currency: string): number {
	let exponent = exponents.get(currency);
	if (exponent === undefined) {
		exponent = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
			.maximumFractionDigits;
		if (exponent === undefined) throw new RangeError(`Unknown currency ${currency}`);
		exponents.set(currency, exponent);
	}
	return exponent;
}
