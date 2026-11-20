import { cn } from "@dawnstudio/ui/lib/utils";
import { useLogoFile } from "../../lib/queries";

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

/**
 * The workspace's uploaded avatar, or its initials on a colour picked from the workspace id
 * (like Linear's workspace icons) when it has none or the image is missing.
 */
export function WorkspaceAvatar({
	id,
	name,
	avatarFile,
	className,
}: {
	id: string;
	name: string;
	avatarFile?: string | null;
	className?: string;
}) {
	const { data: avatar } = useLogoFile(avatarFile);
	const words = name.trim().split(/\s+/).filter(Boolean);
	const initials = (
		words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : name.trim().slice(0, 2)
	).toUpperCase();
	let hash = 0;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	const image = avatarFile ? avatar : null;

	return (
		<span
			aria-hidden
			className={cn(
				"flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] text-[10px] font-semibold text-white",
				className,
			)}
			style={image ? undefined : { backgroundColor: colors[Math.abs(hash) % colors.length] }}
		>
			{image ? (
				<img src={image} alt="" className="size-full object-cover" draggable={false} />
			) : (
				initials || "?"
			)}
		</span>
	);
}
