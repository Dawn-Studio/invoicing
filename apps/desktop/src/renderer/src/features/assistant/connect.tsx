import { Button } from "@dawnstudio/ui/components/button";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { AssistantProvider } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import { rpc } from "../../lib/rpc";

export const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";

/** Browser sign-in for a provider, with a way to give up while it waits. */
export function useConnect() {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState<AssistantProvider | null>(null);

	const connect = async (provider: AssistantProvider) => {
		setPending(provider);
		try {
			const status = await rpc(
				provider === "openrouter" ? "assistant.connectOpenRouter" : "assistant.connectChatGpt",
			);
			queryClient.setQueryData(["assistant", "status", null], status);
			await queryClient.invalidateQueries({ queryKey: ["assistant"] });
			if (provider === "chatgpt" && !status.chatgpt.planUsage) {
				toast.warning(
					"Signed in, but using your ChatGPT plan wasn't allowed. Sign in again and allow it.",
				);
			} else {
				toast.success(
					provider === "openrouter" ? "OpenRouter connected" : "Signed in with ChatGPT",
				);
			}
		} catch (error) {
			if (!(error instanceof Error && /cancelled/i.test(error.message))) showSaveError(error);
		} finally {
			setPending(null);
		}
	};

	const cancel = () => void rpc("assistant.cancelSignIn");
	return { pending, connect, cancel };
}

/** The two ways to connect, side by side; shown in the panel and in Settings. */
export function ConnectButtons({ compact = false }: { compact?: boolean }) {
	const { pending, connect, cancel } = useConnect();
	if (pending) {
		return (
			<div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
				<span className="inline-flex items-center gap-2">
					<Spinner />
					Finish in your browser…
				</span>
				<Button size="sm" variant="ghost" onClick={cancel}>
					Cancel
				</Button>
			</div>
		);
	}
	return (
		<div className={compact ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
			<Button onClick={() => void connect("openrouter")}>Connect OpenRouter</Button>
			<Button variant="outline" onClick={() => void connect("chatgpt")}>
				Sign in with ChatGPT
			</Button>
		</div>
	);
}
