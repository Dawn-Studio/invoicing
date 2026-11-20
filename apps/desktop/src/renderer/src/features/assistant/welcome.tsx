import { formatMoney } from "@dawnstudio/core";
import { cn } from "@dawnstudio/ui/lib/utils";
import { CircleAlert, FileText, Wallet } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { assistantPanel } from "../../lib/assistant";
import { useLogo, useProfile, useRpcQuery, useWorkspaces } from "../../lib/queries";
import { WorkspaceAvatar } from "../workspaces/workspace-avatar";

/** Short and concrete; three is enough to show what it can do. */
export const WELCOME_SUGGESTIONS = [
	"Invoice my last client again",
	"Turn a timesheet into an invoice",
	"Who owes me money?",
];

/** The workspace's mark (its avatar, else the business logo, else its initials), so you know where you are. */
function WorkspaceMark({ large }: { large: boolean }) {
	const { data: logo } = useLogo();
	const { data: workspaces } = useWorkspaces();
	const workspace = workspaces?.workspaces.find((w) => w.id === workspaces.activeId);
	const box = large ? "size-14 rounded-2xl" : "size-11 rounded-xl";
	if (logo && !workspace?.avatarFile) {
		return (
			<span
				className={cn(
					"flex items-center justify-center overflow-hidden border bg-white p-2 shadow-sm",
					box,
				)}
			>
				<img src={logo} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
			</span>
		);
	}
	if (!workspace) return <span className={box} />;
	return (
		<WorkspaceAvatar
			id={workspace.id}
			name={workspace.name}
			avatarFile={workspace.avatarFile}
			className={cn("shadow-sm", box, large ? "text-lg" : "text-sm")}
		/>
	);
}

/** Above the prompt before the first message: where you are, and what needs attention. */
export function AssistantWelcome({
	size = "page",
	subtitle,
}: {
	size?: "page" | "panel";
	subtitle?: string;
}) {
	const reduced = useReducedMotion();
	const page = size === "page";
	return (
		<motion.div
			initial={reduced ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
			animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
			transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
			className="flex flex-col items-center gap-4 text-center"
		>
			<WorkspaceMark large={page} />
			<h1
				className={cn(
					"bg-[linear-gradient(180deg,var(--foreground),color-mix(in_oklab,var(--foreground)_55%,var(--brand-ink)))] bg-clip-text font-semibold text-balance text-transparent",
					page ? "text-[2.375rem] leading-[1.1] tracking-[-0.035em]" : "text-xl tracking-tight",
				)}
			>
				What are we invoicing today?
			</h1>
			{subtitle ? (
				<p className="-mt-1 max-w-md text-[0.9375rem] text-pretty text-muted-foreground">
					{subtitle}
				</p>
			) : (
				<Summary compact={!page} />
			)}
		</motion.div>
	);
}

/** Outstanding, overdue and drafts; each one fills in a prompt about it. */
function Summary({ compact }: { compact: boolean }) {
	const { data: profile } = useProfile();
	const { data: report } = useRpcQuery("reports.dashboard", undefined, {
		enabled: Boolean(profile),
	});
	if (!report) return null;
	const chips = [
		report.outstanding.count > 0 && {
			icon: Wallet,
			label: `${formatMoney(report.outstanding.amount, report.currency)} outstanding`,
			prompt: "Who owes me money right now, and how much each?",
			tone: "",
		},
		report.overdue.count > 0 && {
			icon: CircleAlert,
			label: `${report.overdue.count} overdue`,
			prompt: "Which invoices are overdue? Draft a friendly reminder for each client.",
			tone: "text-destructive",
		},
		report.draftCount > 0 && {
			icon: FileText,
			label: `${report.draftCount} ${report.draftCount === 1 ? "draft" : "drafts"}`,
			prompt: "Which drafts haven't I issued yet, and what's missing on them?",
			tone: "",
		},
	].filter(Boolean) as { icon: typeof Wallet; label: string; prompt: string; tone: string }[];
	if (chips.length === 0) return null;
	return (
		<div className="flex flex-wrap justify-center gap-1.5">
			{chips.map(({ icon: Icon, label, prompt, tone }) => (
				<button
					key={label}
					type="button"
					onClick={() => assistantPanel.prefill(prompt)}
					className={cn(
						"inline-flex items-center gap-1.5 rounded-md border bg-background/60 text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground",
						compact ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
					)}
				>
					<Icon className={cn("size-3.5", tone)} />
					{label}
				</button>
			))}
		</div>
	);
}

/** Starting points under the prompt: small, quiet, one tap to send. */
export function SuggestionChips({
	suggestions,
	disabled,
	onPick,
}: {
	suggestions: string[];
	disabled?: boolean;
	onPick: (text: string) => void;
}) {
	return (
		<div className="flex flex-wrap justify-center gap-1.5">
			{suggestions.map((suggestion) => (
				<button
					key={suggestion}
					type="button"
					disabled={disabled}
					onClick={() => onPick(suggestion)}
					className="h-7 rounded-md border border-border/70 bg-background/50 px-2.5 text-xs text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
				>
					{suggestion}
				</button>
			))}
		</div>
	);
}
