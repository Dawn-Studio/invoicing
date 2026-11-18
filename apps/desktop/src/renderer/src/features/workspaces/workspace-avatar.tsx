import { cn } from "@dawnstudio/ui/lib/utils";

// Muted, readable on white text in both themes.
const colors = [
	"#6366f1",
	"#0ea5e9",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#ec4899",
	"#8b5cf6",
	"#14b8a6",
];

/** Initials on a colour picked from the workspace id, like Linear's workspace icons. */
export function WorkspaceAvatar({
	id,
	name,
	className,
}: {
	id: string;
	name: string;
	className?: string;
}) {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const initials = (
		words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : name.trim().slice(0, 2)
	).toUpperCase();
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;

	return (
		<span
			aria-hidden
			className={cn(
				"flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-semibold text-white",
				className,
			)}
			style={{ backgroundColor: colors[Math.abs(hash) % colors.length] }}
		>
			{initials || "?"}
		</span>
	);
}
