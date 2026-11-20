import { createHash, randomBytes } from "node:crypto";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { DomainError } from "@dawnstudio/core";
import { shell } from "electron";

/**
 * Browser sign-in for a desktop app (OAuth with PKCE and a loopback redirect): listen on
 * 127.0.0.1, open the provider's page in the default browser, and wait for it to redirect
 * back with a code. Only one sign-in runs at a time; starting another cancels the first.
 */

const base64url = (bytes: Buffer) => bytes.toString("base64url");

export function pkce() {
	const verifier = base64url(randomBytes(32));
	const challenge = base64url(createHash("sha256").update(verifier).digest());
	return { verifier, challenge };
}

export const randomToken = () => base64url(randomBytes(24));

const PAGE = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
	body { font: 15px/1.5 system-ui, sans-serif; display: grid; place-items: center; min-height: 90vh; margin: 0; color: #141710; background: #fff; }
	@media (prefers-color-scheme: dark) { body { color: #eef1ea; background: #0e100c; } }
	main { max-width: 26rem; text-align: center; padding: 1.5rem; }
	h1 { font-size: 1.25rem; margin: 0 0 .5rem; }
	p { margin: 0; opacity: .7; }
</style></head>
<body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;

let cancelCurrent: (() => void) | null = null;

/** Stops a sign-in that's waiting for the browser, if any. */
export function cancelSignIn() {
	cancelCurrent?.();
}

export interface LoopbackOptions {
	/** Path the provider redirects to, e.g. "/auth/callback". */
	path: string;
	/** Host in the redirect URI. The server always listens on 127.0.0.1 (and ::1 for "localhost"). */
	host: "127.0.0.1" | "localhost";
	/** Tried first; any free port otherwise. */
	preferredPort?: number;
	/** Builds the provider URL to open, given the exact redirect URI. */
	authorizeUrl: (redirectUri: string) => string;
	timeoutMs?: number;
}

/** Resolves with the callback's query parameters and the redirect URI that was used. */
export async function signInWithBrowser({
	path,
	host,
	preferredPort,
	authorizeUrl,
	timeoutMs = 5 * 60_000,
}: LoopbackOptions): Promise<{ params: URLSearchParams; redirectUri: string }> {
	cancelSignIn();

	let settle: (result: URLSearchParams | Error) => void = () => {};
	const done = new Promise<URLSearchParams>((resolve, reject) => {
		settle = (result) => (result instanceof Error ? reject(result) : resolve(result));
	});

	const handler: RequestListener = (request, response) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1");
		if (url.pathname !== path) {
			response.writeHead(404).end();
			return;
		}
		const failed = url.searchParams.has("error");
		response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		response.end(
			failed
				? PAGE("Sign-in cancelled", "You can close this tab and go back to Invoicing.")
				: PAGE("You're connected", "You can close this tab and go back to Invoicing."),
		);
		settle(url.searchParams);
	};

	const listen = (server: Server, address: string, port: number) =>
		new Promise<number>((resolve, reject) => {
			server.once("error", reject);
			server.listen(port, address, () => resolve((server.address() as AddressInfo).port));
		});

	const servers: Server[] = [createServer(handler)];
	let port: number;
	try {
		port = await listen(servers[0] as Server, "127.0.0.1", preferredPort ?? 0);
	} catch {
		servers[0] = createServer(handler);
		port = await listen(servers[0] as Server, "127.0.0.1", 0);
	}
	// "localhost" may resolve to IPv6 in the browser; answer there too when we can.
	if (host === "localhost") {
		const v6 = createServer(handler);
		await listen(v6, "::1", port).then(
			() => servers.push(v6),
			() => v6.close(),
		);
	}

	const redirectUri = `http://${host}:${port}${path}`;
	const timer = setTimeout(
		() => settle(new DomainError("VALIDATION", "Sign-in timed out. Try again.")),
		timeoutMs,
	);
	cancelCurrent = () => settle(new DomainError("VALIDATION", "Sign-in was cancelled"));

	try {
		await shell.openExternal(authorizeUrl(redirectUri));
		const params = await done;
		return { params, redirectUri };
	} finally {
		clearTimeout(timer);
		cancelCurrent = null;
		for (const server of servers) {
			server.close();
			server.closeIdleConnections();
		}
	}
}
