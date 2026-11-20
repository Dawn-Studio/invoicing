import { DomainError } from "@dawnstudio/core";
import { app, type IpcMainInvokeEvent, ipcMain } from "electron";
import { z } from "zod";
import { RPC_CHANNEL } from "../shared/api";
import {
	type Channel,
	contract,
	type Output,
	type ParsedInput,
	type RpcResult,
} from "../shared/contract";

export type Handlers = {
	[C in Channel]: (input: ParsedInput<C>) => Output<C> | Promise<Output<C>>;
};

/** Only our own renderer may call in: the dev server in development, the bundled file otherwise. */
export function isTrustedSender(event: Pick<IpcMainInvokeEvent, "senderFrame">): boolean {
	const url = event.senderFrame?.url ?? "";
	const devServerUrl = process.env.ELECTRON_RENDERER_URL;
	if (!app.isPackaged && devServerUrl && url.startsWith(devServerUrl)) return true;
	return url.startsWith("file://") && url.includes("/out/renderer/");
}

const isChannel = (value: unknown): value is Channel =>
	typeof value === "string" && Object.hasOwn(contract, value);

function failure(error: unknown): RpcResult<never> {
	if (error instanceof DomainError) {
		return { ok: false, error: { code: error.code, message: error.message } };
	}
	if (error instanceof z.ZodError) {
		return {
			ok: false,
			error: {
				code: "VALIDATION",
				message: error.issues[0]?.message ?? "Invalid input",
				issues: error.issues.map((issue) => ({
					path: issue.path.join("."),
					message: issue.message,
				})),
			},
		};
	}
	console.error(error);
	return {
		ok: false,
		error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
	};
}

/**
 * Registers one IPC endpoint that dispatches to typed handlers. Every input is validated
 * against the contract, and errors come back as data (Electron would otherwise flatten
 * thrown errors into a string and lose the error code).
 */
export function registerRpc(handlers: Handlers) {
	ipcMain.handle(
		RPC_CHANNEL,
		async (event, channel: unknown, input: unknown): Promise<RpcResult<unknown>> => {
			if (!isTrustedSender(event))
				return failure(new Error(`Untrusted sender ${event.senderFrame?.url}`));
			if (!isChannel(channel)) return failure(new Error(`Unknown channel ${String(channel)}`));
			try {
				const parsed = contract[channel].input.parse(input);
				const handler = handlers[channel] as (input: unknown) => unknown;
				return { ok: true, value: await handler(parsed) };
			} catch (error) {
				return failure(error);
			}
		},
	);
}
