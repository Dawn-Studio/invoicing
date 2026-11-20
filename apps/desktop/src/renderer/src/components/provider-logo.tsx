import { cn } from "@dawnstudio/ui/lib/utils";
import { Sparkles } from "lucide-react";
import alibaba from "../assets/providers/alibaba.svg";
import anthropic from "../assets/providers/anthropic.svg";
import cohere from "../assets/providers/cohere.svg";
import deepseek from "../assets/providers/deepseek.svg";
import google from "../assets/providers/google.svg";
import meta from "../assets/providers/meta.svg";
import minimax from "../assets/providers/minimax.svg";
import mistral from "../assets/providers/mistral.svg";
import moonshotai from "../assets/providers/moonshotai.svg";
import nvidia from "../assets/providers/nvidia.svg";
import openai from "../assets/providers/openai.svg";
import perplexity from "../assets/providers/perplexity.svg";
import xai from "../assets/providers/xai.svg";
import zhipuai from "../assets/providers/zhipuai.svg";

/** Who makes a model, from the start of its OpenRouter id ("anthropic/claude-…"). */
const MAKERS: Record<string, { name: string; logo: string }> = {
	anthropic: { name: "Anthropic", logo: anthropic },
	openai: { name: "OpenAI", logo: openai },
	google: { name: "Google", logo: google },
	"meta-llama": { name: "Meta", logo: meta },
	mistralai: { name: "Mistral", logo: mistral },
	deepseek: { name: "DeepSeek", logo: deepseek },
	"x-ai": { name: "xAI", logo: xai },
	qwen: { name: "Qwen", logo: alibaba },
	cohere: { name: "Cohere", logo: cohere },
	perplexity: { name: "Perplexity", logo: perplexity },
	moonshotai: { name: "Moonshot", logo: moonshotai },
	"z-ai": { name: "Z.ai", logo: zhipuai },
	nvidia: { name: "NVIDIA", logo: nvidia },
	minimax: { name: "MiniMax", logo: minimax },
};

export interface ModelMaker {
	id: string;
	name: string;
	logo: string | null;
}

/** The maker of a model; ChatGPT plan models are OpenAI's. */
export function makerOf(modelId: string, provider: "openrouter" | "chatgpt"): ModelMaker {
	if (provider === "chatgpt") return { id: "openai", ...MAKERS.openai } as ModelMaker;
	const id = modelId.split("/")[0] ?? "";
	const maker = MAKERS[id];
	return maker
		? { id, ...maker }
		: { id, name: id ? id[0]?.toUpperCase() + id.slice(1) : "Other", logo: null };
}

/** "Anthropic: Claude Sonnet 5.5" → "Claude Sonnet 5.5". */
export const modelLabel = (name: string) => name.replace(/^[^:]+:\s*/, "");

/**
 * The maker's mark in the current text colour (drawn as a mask, so it follows light and dark),
 * or a neutral sparkle for makers we don't have a mark for.
 */
export function ProviderLogo({ logo, className }: { logo: string | null; className?: string }) {
	if (!logo) return <Sparkles aria-hidden="true" className={cn("size-4 shrink-0", className)} />;
	return (
		<span
			aria-hidden="true"
			className={cn("inline-block size-4 shrink-0 bg-current", className)}
			style={{
				maskImage: `url("${logo}")`,
				WebkitMaskImage: `url("${logo}")`,
				maskSize: "contain",
				maskRepeat: "no-repeat",
				maskPosition: "center",
			}}
		/>
	);
}
