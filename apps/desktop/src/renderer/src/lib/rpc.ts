import type { Channel, Input, Output, RpcErrorCode } from "../../../shared/contract";

export class RpcError extends Error {
	readonly code: RpcErrorCode;
	readonly issues: { path: string; message: string }[];

	constructor(
		code: RpcErrorCode,
		message: string,
		issues: { path: string; message: string }[] = [],
	) {
		super(message);
		this.name = "RpcError";
		this.code = code;
		this.issues = issues;
	}
}

type Args<C extends Channel> = undefined extends Input<C> ? [input?: Input<C>] : [input: Input<C>];

/** Typed call into the main process, e.g. `rpc("clients.list", { search: "acme" })`. */
export async function rpc<C extends Channel>(channel: C, ...[input]: Args<C>): Promise<Output<C>> {
	const result = await window.api.invoke(channel, input);
	if (!result.ok) throw new RpcError(result.error.code, result.error.message, result.error.issues);
	return result.value as Output<C>;
}
