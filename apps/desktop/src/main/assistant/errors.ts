import { DomainError } from "@dawnstudio/core";
import { APICallError } from "ai";

/** Provider errors in plain words, including the ChatGPT plan's documented codes. */
export function describeError(error: unknown): string {
	if (error instanceof DomainError) return error.message;
	if (APICallError.isInstance(error)) {
		const body = error.responseBody ?? "";
		const code = /"code"\s*:\s*"([^"]+)"/.exec(body)?.[1] ?? "";
		switch (code) {
			case "subscription_sharing_usage_limit_exceeded":
				return "You've reached the limit for this app on your ChatGPT plan. Raise it at chatgpt.com/settings/usage or try again later.";
			case "subscription_sharing_user_not_eligible":
				return "Your ChatGPT plan can't be used in other apps. Plus, Pro and Business plans can.";
			case "subscription_sharing_usage_unavailable":
			case "subscription_sharing_user_unavailable":
				return "ChatGPT is busy right now. Try again in a moment.";
			case "subscription_sharing_unsupported_capability":
				return "ChatGPT can't do that with your plan here (for example, this kind of attachment).";
			case "subscription_sharing_invalid_user":
				return "Your ChatGPT sign-in has ended. Sign in again in Settings → Assistant.";
		}
		if (error.statusCode === 401)
			return "The provider didn't accept the connection. Reconnect in Settings → Assistant.";
		if (error.statusCode === 402)
			return "Your OpenRouter account is out of credits. Add some at openrouter.ai/settings/credits.";
		if (error.statusCode === 429)
			return "Too many requests right now. Wait a moment and try again.";
		if (error.statusCode === 404 && /image|file|pdf|modalit/i.test(body)) {
			return "This model can't read that kind of attachment. Pick another model or remove the file.";
		}
		const message = /"message"\s*:\s*"([^"]+)"/.exec(body)?.[1];
		return message
			? `The provider said: ${message}`
			: `The provider answered with an error (${error.statusCode ?? "no response"}).`;
	}
	if (
		error instanceof Error &&
		/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(error.message)
	) {
		return "Couldn't reach the provider. Check your internet connection.";
	}
	console.error(error);
	return "Something went wrong with the assistant. Try again.";
}
