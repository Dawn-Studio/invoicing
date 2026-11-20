import { DomainError } from "@dawnstudio/core";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { app } from "electron";
import { z } from "zod";
import type { AssistantModel, OpenRouterUsage } from "../../shared/contract";
import { readCredentials, updateCredentials } from "./credentials";
import { pkce, signInWithBrowser } from "./loopback";

/**
 * OpenRouter, the default provider: one connection to hundreds of models, billed to the
 * user's own OpenRouter account. "Connect" runs OpenRouter's OAuth PKCE flow and gets a key
 * tied to that account; pasting a key works too.
 */

/** Development builds can point at a local stand-in (end-to-end tests); never the packaged app. */
const API =
	(!app.isPackaged && process.env.INVOICING_OPENROUTER_API) || "https://openrouter.ai/api/v1";
/** A capable, reasonably priced model with tools, images and PDFs. */
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-5.5";
const SITE = "https://invoicing.dawn.studio";
const APP_TITLE = "Invoicing by Dawn Studio";

export const openRouterKey = () => readCredentials().openrouter?.key ?? null;

/** Checks a key against OpenRouter and returns what it says about it. */
async function keyInfo(key: string): Promise<OpenRouterUsage> {
	const response = await fetch(`${API}/key`, { headers: { Authorization: `Bearer ${key}` } });
	if (response.status === 401)
		throw new DomainError("VALIDATION", "OpenRouter didn't accept this key");
	if (!response.ok) throw new Error(`OpenRouter answered ${response.status}`);
	const { data } = z
		.object({
			data: z.object({
				label: z.string().nullish(),
				usage: z.number().nullish(),
				limit: z.number().nullish(),
				limit_remaining: z.number().nullish(),
				is_free_tier: z.boolean().nullish(),
			}),
		})
		.parse(await response.json());
	return {
		label: data.label ?? "",
		usage: data.usage ?? 0,
		limit: data.limit ?? null,
		remaining: data.limit_remaining ?? null,
		freeTier: data.is_free_tier ?? false,
	};
}

export async function connectOpenRouter() {
	const { verifier, challenge } = pkce();
	const { params } = await signInWithBrowser({
		host: "localhost",
		path: "/callback",
		authorizeUrl: (redirectUri) => {
			const url = new URL("https://openrouter.ai/auth");
			url.searchParams.set("callback_url", redirectUri);
			url.searchParams.set("code_challenge", challenge);
			url.searchParams.set("code_challenge_method", "S256");
			url.searchParams.set("key_label", "Invoicing");
			return url.href;
		},
	});
	const code = params.get("code");
	if (!code) throw new DomainError("VALIDATION", "OpenRouter didn't connect. Try again.");

	const response = await fetch(`${API}/auth/keys`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
	});
	if (!response.ok) {
		throw new DomainError("VALIDATION", "OpenRouter didn't accept the sign-in. Try again.");
	}
	const { key } = z.object({ key: z.string().min(1) }).parse(await response.json());
	await updateCredentials({ openrouter: { key, via: "oauth" } });
}

export async function setOpenRouterKey(key: string) {
	await keyInfo(key);
	await updateCredentials({ openrouter: { key, via: "key" } });
}

export function disconnectOpenRouter() {
	return updateCredentials({ openrouter: undefined });
}

export async function openRouterUsage(): Promise<OpenRouterUsage | null> {
	const key = openRouterKey();
	return key ? keyInfo(key) : null;
}

const modelSchema = z.object({
	id: z.string(),
	name: z.string(),
	context_length: z.number().nullish(),
	architecture: z.object({
		input_modalities: z.array(z.string()).default([]),
		output_modalities: z.array(z.string()).default([]),
	}),
	pricing: z.object({ prompt: z.string().nullish(), completion: z.string().nullish() }).nullish(),
	supported_parameters: z.array(z.string()).nullish(),
});

let modelCache: { at: number; models: AssistantModel[] } | null = null;

/** Text models that can use tools (the assistant needs them), cheapest variants hidden. */
export async function openRouterModels(): Promise<AssistantModel[]> {
	if (modelCache && Date.now() - modelCache.at < 60 * 60_000) return modelCache.models;
	const response = await fetch(`${API}/models?supported_parameters=tools`);
	if (!response.ok) throw new Error(`OpenRouter answered ${response.status}`);
	const { data } = z.object({ data: z.array(z.unknown()) }).parse(await response.json());
	const perMillion = (value: string | null | undefined) =>
		value ? Math.round(Number(value) * 1_000_000 * 100) / 100 : 0;
	const models = data
		.map((raw) => modelSchema.safeParse(raw))
		.flatMap((result) => (result.success ? [result.data] : []))
		.filter(
			(model) =>
				!model.id.includes(":batch") &&
				model.architecture.output_modalities.includes("text") &&
				(model.supported_parameters?.includes("tools") ?? true),
		)
		.map((model) => ({
			id: model.id,
			name: model.name,
			images: model.architecture.input_modalities.includes("image"),
			files: model.architecture.input_modalities.includes("file"),
			contextLength: model.context_length ?? null,
			price: model.pricing
				? {
						input: perMillion(model.pricing.prompt),
						output: perMillion(model.pricing.completion),
					}
				: null,
		}));
	modelCache = { at: Date.now(), models };
	return models;
}

export function openRouterModel(modelId: string): LanguageModel {
	const key = openRouterKey();
	if (!key) throw new DomainError("VALIDATION", "Connect OpenRouter in Settings → Assistant");
	// Attribution shows the app by name in the user's OpenRouter activity.
	const provider = createOpenRouter({
		apiKey: key,
		baseURL: API,
		appName: APP_TITLE,
		appUrl: SITE,
	});
	return provider.chat(modelId);
}
