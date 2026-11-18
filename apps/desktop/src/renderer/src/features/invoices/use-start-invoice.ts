import { useNavigate } from "react-router";
import { showSaveError } from "../../lib/forms";
import { useCreateDraft } from "../../lib/queries";

/** Creates a draft (optionally for a client, which prefills its defaults) and opens it. */
export function useStartInvoice() {
	const navigate = useNavigate();
	const create = useCreateDraft();
	return {
		isPending: create.isPending,
		run: async (clientId?: string) => {
			try {
				const draft = await create.mutateAsync({ clientId: clientId ?? null });
				navigate(`/invoices/${draft.id}`);
			} catch (error) {
				showSaveError(error);
			}
		},
	};
}
