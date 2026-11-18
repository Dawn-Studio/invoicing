export type DomainErrorCode = "NOT_FOUND" | "VALIDATION" | "INVALID_STATE" | "CONFLICT";

/** An expected failure that is safe to show to the user (as opposed to a bug). */
export class DomainError extends Error {
	readonly code: DomainErrorCode;

	constructor(code: DomainErrorCode, message: string) {
		super(message);
		this.name = "DomainError";
		this.code = code;
	}
}
