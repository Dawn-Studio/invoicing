import { createOpenAI } from "@ai-sdk/openai";
import { DomainError } from "@dawnstudio/core";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { AssistantModel } from "../../shared/contract";
import { type ChatGptTokens, hostId, readCredentials, updateCredentials } from "./credentials";
import { pkce, randomToken, signInWithBrowser } from "./loopback";

/**
 * "Sign in with ChatGPT": requests run on the user's own ChatGPT plan (Plus, Pro, Business),
 * within the weekly cap they set for this app at chatgpt.com/settings/usage. Open-source apps
 * may use it without approval. OIDC with PKCE and a loopback redirect; the first sign-in
 * registers this install and OpenAI issues a client id that every later sign-in reuses.
 * https://developers.openai.com/siwc/token-sharing-open-source
 */

const AUTH = "https://auth.openai.com";
const API = "https://api.openai.com/v1";
const RESOURCE = "https://api.openai.com/v1";
const PLAN_SCOPE = "chatgpt.tokens.use.direct";
const SCOPES = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const APP_NAME = "Invoicing";
export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";

const tokenResponseSchema = z.object({
	access_token: z.string(),
	refresh_token: z.string().optional(),
	id_token: z.string().optional(),
	expires_in: z.number().default(3600),
	scope: z.string().default(""),
});

/** Claims from the ID token we got straight from the token endpoint over TLS. */
function idTokenClaims(idToken: string) {
	try {
		const payload = idToken.split(".")[1] ?? "";
		return z
			.object({
				email: z.string().optional(),
				sub: z.string().optional(),
				nonce: z.string().optional(),
				aud: z.union([z.string(), z.array(z.string())]).optional(),
			})
			.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
	} catch {
		return {};
	}
}

async function tokenRequest(form: Record<string, string>): Promise<ChatGptTokens> {
	const response = await fetch(`${AUTH}/api/accounts/oauth/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(form),
	});
	const json: unknown = await response.json().catch(() => ({}));
	if (!response.ok) {
		const code =
			z.object({ error: z.string() }).safeParse(json).data?.error ?? String(response.status);
		throw new TokenError(code);
	}
	const tokens = tokenResponseSchema.parse(json);
	const previous = readCredentials().chatgpt;
	const claims = tokens.id_token ? idTokenClaims(tokens.id_token) : {};
	return {
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? "",
		idToken: tokens.id_token ?? previous?.idToken ?? "",
		expiresAt: Date.now() + tokens.expires_in * 1000,
		scopes: tokens.scope ? tokens.scope.split(" ") : (previous?.scopes ?? []),
		email: claims.email ?? previous?.email ?? null,
		subject: claims.sub ?? previous?.subject ?? null,
	};
}

class TokenError extends Error {
	constructor(readonly code: string) {
		super(`ChatGPT sign-in failed (${code})`);
	}
}

/** Codes after which the saved sign-in is dead and the user has to sign in again. */
const SIGNED_OUT = new Set([
	"invalid_grant",
	"invalid_refresh_token",
	"token_expired",
	"refresh_token_expired",
	"refresh_token_invalidated",
	"refresh_token_reused",
]);

export async function connectChatGpt() {
	const { verifier, challenge } = pkce();
	const state = randomToken();
	const nonce = randomToken();
	const savedClientId = readCredentials().chatgptClientId;
	const previous = readCredentials().chatgpt;
	const host = await hostId();

	const { params, redirectUri } = await signInWithBrowser({
		host: "127.0.0.1",
		path: "/auth/callback",
		preferredPort: 1455,
		authorizeUrl: (redirect) => {
			const url = new URL(`${AUTH}/api/accounts/authorize`);
			const query = url.searchParams;
			query.set("client_id", savedClientId ?? "dynamic_agent_client");
			if (!savedClientId) query.set("agent_name_hint", APP_NAME);
			query.set("ext_agent_host_id", host);
			query.set("redirect_uri", redirect);
			query.set("scope", SCOPES);
			query.set("resource", RESOURCE);
			query.set("response_type", "code");
			query.set("state", state);
			query.set("nonce", nonce);
			query.set("code_challenge", challenge);
			query.set("code_challenge_method", "S256");
			// Signing back in skips the account picker; plan usage was refused before → ask again.
			if (previous?.idToken) query.set("id_token_hint", previous.idToken);
			if (previous && !previous.scopes.includes(PLAN_SCOPE)) query.set("prompt", "consent");
			return url.href;
		},
	});

	if (params.get("state") !== state)
		throw new DomainError("VALIDATION", "Sign-in didn't match. Try again.");
	if (params.get("error")) throw new DomainError("VALIDATION", "Sign-in was cancelled");
	const code = params.get("code");
	const issuedClientId = params.get("client_id") ?? savedClientId;
	if (!code || !issuedClientId) {
		throw new DomainError("VALIDATION", "ChatGPT didn't finish signing in. Try again.");
	}
	if (savedClientId && issuedClientId !== savedClientId) {
		throw new DomainError("VALIDATION", "ChatGPT answered for a different app. Try again.");
	}
	if (!savedClientId) await updateCredentials({ chatgptClientId: issuedClientId });

	let tokens: ChatGptTokens;
	try {
		tokens = await tokenRequest({
			grant_type: "authorization_code",
			client_id: issuedClientId,
			code,
			code_verifier: verifier,
			redirect_uri: redirectUri,
			resource: RESOURCE,
		});
	} catch {
		throw new DomainError("VALIDATION", "ChatGPT didn't accept the sign-in. Try again.");
	}
	const claims = idTokenClaims(tokens.idToken);
	if (claims.nonce !== undefined && claims.nonce !== nonce) {
		throw new DomainError("VALIDATION", "Sign-in didn't match. Try again.");
	}
	await updateCredentials({ chatgpt: tokens });
}

let refreshing: Promise<string> | null = null;

/** A fresh access token, refreshing it a minute before it expires (one refresh at a time). */
export async function chatGptAccessToken(): Promise<string> {
	const { chatgpt, chatgptClientId } = readCredentials();
	if (!chatgpt || !chatgptClientId) {
		throw new DomainError("VALIDATION", "Sign in with ChatGPT in Settings → Assistant");
	}
	if (chatgpt.expiresAt - 60_000 > Date.now()) return chatgpt.accessToken;
	refreshing ??= (async () => {
		try {
			const tokens = await tokenRequest({
				grant_type: "refresh_token",
				client_id: chatgptClientId,
				refresh_token: chatgpt.refreshToken,
				resource: RESOURCE,
			});
			await updateCredentials({ chatgpt: tokens });
			return tokens.accessToken;
		} catch (error) {
			if (error instanceof TokenError && SIGNED_OUT.has(error.code)) {
				await updateCredentials({ chatgpt: undefined });
				throw new DomainError(
					"VALIDATION",
					"Your ChatGPT sign-in expired. Sign in again in Settings → Assistant.",
				);
			}
			throw error;
		} finally {
			refreshing = null;
		}
	})();
	return refreshing;
}

export function chatGptPlanUsage() {
	return readCredentials().chatgpt?.scopes.includes(PLAN_SCOPE) ?? false;
}

/** Revokes the refresh token at OpenAI (best effort) and forgets the sign-in. */
export async function disconnectChatGpt() {
	const { chatgpt, chatgptClientId } = readCredentials();
	await updateCredentials({ chatgpt: undefined });
	if (!chatgpt || !chatgptClientId) return;
	try {
		const discovery = z
			.object({ revocation_endpoint: z.url() })
			.parse(await (await fetch(`${AUTH}/.well-known/openid-configuration`)).json());
		await fetch(discovery.revocation_endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				token: chatgpt.refreshToken,
				token_type_hint: "refresh_token",
				client_id: chatgptClientId,
			}),
		});
	} catch (error) {
		// The tokens are gone from this computer either way; the user can also remove the app
		// at chatgpt.com.
		console.warn("Couldn't revoke the ChatGPT sign-in", error);
	}
}

let modelCache: { at: number; subject: string | null; models: AssistantModel[] } | null = null;

/** The models this account's plan offers, in OpenAI's order. */
export async function chatGptModels(): Promise<AssistantModel[]> {
	const subject = readCredentials().chatgpt?.subject ?? null;
	if (modelCache && modelCache.subject === subject && Date.now() - modelCache.at < 60 * 60_000) {
		return modelCache.models;
	}
	const response = await fetch(`${API}/models`, {
		headers: { Authorization: `Bearer ${await chatGptAccessToken()}` },
	});
	if (!response.ok) throw new Error(`ChatGPT answered ${response.status}`);
	const { models } = z
		.object({
			models: z.array(
				z.object({
					slug: z.string(),
					display_name: z.string().nullish(),
					visibility: z.string().nullish(),
				}),
			),
		})
		.parse(await response.json());
	const list = models
		.filter((model) => model.visibility === "list")
		.map((model) => ({
			id: model.slug,
			name: model.display_name ?? model.slug,
			// The plan's models take images and files; the API refuses what a model can't read.
			images: true,
			files: true,
			contextLength: null,
			price: null,
		}));
	modelCache = { at: Date.now(), subject, models: list };
	return list;
}

/**
 * The Responses API with the user's token. Plan usage only takes streamed, unstored requests
 * without sampling settings, and instructions as developer messages.
 */
export function chatGptModel(modelId: string): LanguageModel {
	const openai = createOpenAI({ baseURL: API, apiKey: chatGptAccessToken });
	return openai.responses(modelId);
}

export const CHATGPT_PROVIDER_OPTIONS = {
	openai: { store: false, systemMessageMode: "developer" },
} as const;
