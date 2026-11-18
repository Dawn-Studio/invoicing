import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import { RpcError } from "./rpc";

/**
 * Shows a failed save: field-level validation errors go next to their inputs (paths use the
 * same names as the form), anything else becomes a toast.
 */
export function showSaveError<T extends FieldValues>(
	error: unknown,
	setError?: UseFormSetError<T>,
	prefix = "",
) {
	if (
		error instanceof RpcError &&
		error.code === "VALIDATION" &&
		setError &&
		error.issues.length > 0
	) {
		for (const issue of error.issues) {
			const path = issue.path.startsWith(prefix) ? issue.path.slice(prefix.length) : issue.path;
			setError((path || "root") as Path<T>, { message: issue.message });
		}
		return;
	}
	toast.error(error instanceof Error ? error.message : "Something went wrong");
}
