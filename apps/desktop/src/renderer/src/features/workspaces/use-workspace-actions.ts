import { useState } from "react";
import { useNavigate } from "react-router";
import { showSaveError } from "../../lib/forms";
import { rpc } from "../../lib/rpc";

/**
 * Switching, creating and deleting workspaces swap the whole database underneath the app,
 * so afterwards the window reloads instead of patching every cached query.
 */
export function useWorkspaceActions() {
	const navigate = useNavigate();
	const [pending, setPending] = useState(false);

	const run = async (action: () => Promise<unknown>) => {
		setPending(true);
		try {
			// Leave the current screen first, so an open editor saves its draft into the
			// workspace it belongs to before the database changes.
			navigate("/");
			await new Promise((resolve) => setTimeout(resolve, 150));
			await action();
			window.location.reload();
		} catch (error) {
			showSaveError(error);
			setPending(false);
		}
	};

	return {
		pending,
		switchTo: (id: string) => run(() => rpc("workspaces.switch", { id })),
		create: (name: string) => run(() => rpc("workspaces.create", { name })),
		remove: (id: string) => run(() => rpc("workspaces.delete", { id })),
	};
}
