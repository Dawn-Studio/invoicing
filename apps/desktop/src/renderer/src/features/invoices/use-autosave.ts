import type { InvoiceDraftInput } from "@dawnstudio/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "../../lib/rpc";
import type { ParsedDraft } from "./draft-state";

export type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "failed";

const DELAY_MS = 600;

/**
 * Saves the draft a moment after you stop typing, one save at a time and in order. Nothing
 * is saved while a field doesn't parse. `flush` saves right away (before issuing, leaving).
 *
 * The editor owns the draft while it's open, so a save writes the result straight into the
 * cache instead of refetching it (a refetch could race newer edits).
 */
export function useDraftAutosave(id: string, draft: ParsedDraft) {
	const queryClient = useQueryClient();
	const serialized = JSON.stringify(draft.input);
	const valid = Object.keys(draft.errors).length === 0;

	const saved = useRef(serialized);
	const latest = useRef({ serialized, input: draft.input, valid });
	latest.current = { serialized, input: draft.input, valid };
	const queue = useRef<Promise<void>>(Promise.resolve());
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [status, setStatus] = useState<SaveStatus>("saved");
	const [error, setError] = useState<string | null>(null);

	const save = useCallback((): Promise<void> => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
		queue.current = queue.current.then(async () => {
			const { serialized: next, input, valid: ok } = latest.current;
			if (!ok || next === saved.current) return;
			setStatus("saving");
			try {
				const invoice = await rpc("invoices.updateDraft", {
					id,
					data: input as InvoiceDraftInput,
				});
				saved.current = next;
				queryClient.setQueryData(["invoices", "get", { id }], invoice);
				void queryClient.invalidateQueries({ queryKey: ["invoices", "list"] });
				void queryClient.invalidateQueries({ queryKey: ["clients", "stats"] });
				setError(null);
				setStatus(latest.current.serialized === next ? "saved" : "pending");
			} catch (failure) {
				setError(failure instanceof Error ? failure.message : "Couldn't save");
				setStatus("failed");
				throw failure;
			}
		});
		// Callers that don't await shouldn't see an unhandled rejection; `flush` rethrows.
		const run = queue.current;
		queue.current = run.catch(() => undefined);
		return run;
	}, [id, queryClient]);

	useEffect(() => {
		if (serialized === saved.current) {
			setStatus((current) => (current === "failed" ? current : "saved"));
			return;
		}
		if (!valid) {
			setStatus("invalid");
			return;
		}
		setStatus("pending");
		timer.current = setTimeout(() => void save().catch(() => undefined), DELAY_MS);
		return () => {
			if (timer.current) clearTimeout(timer.current);
		};
	}, [serialized, valid, save]);

	// Leaving the editor saves whatever is still waiting.
	useEffect(() => () => void save().catch(() => undefined), [save]);

	return { status, error, flush: save };
}
