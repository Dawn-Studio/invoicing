import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Check, ChevronDown, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useWorkspaces } from "../../lib/queries";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { useWorkspaceActions } from "./use-workspace-actions";
import { WorkspaceAvatar } from "./workspace-avatar";

/** The workspace name at the top of the sidebar; opens a menu to switch or add workspaces. */
export function WorkspaceSwitcher() {
	const navigate = useNavigate();
	const { data } = useWorkspaces();
	const actions = useWorkspaceActions();
	const [creating, setCreating] = useState(false);
	const active = data?.workspaces.find((w) => w.id === data.activeId);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					className="app-no-drag flex h-7 min-w-0 items-center gap-2 rounded-md px-1.5 text-[0.9375rem] font-semibold outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent"
					disabled={!active}
				>
					{active ? <WorkspaceAvatar id={active.id} name={active.name} /> : null}
					<span className="truncate">{active?.name ?? "Invoicing"}</span>
					<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-60">
					<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
						Workspaces
					</DropdownMenuLabel>
					{data?.workspaces.map((workspace) => (
						<DropdownMenuItem
							key={workspace.id}
							disabled={actions.pending}
							onSelect={() => workspace.id !== data.activeId && actions.switchTo(workspace.id)}
						>
							<WorkspaceAvatar id={workspace.id} name={workspace.name} />
							<span className="flex-1 truncate">{workspace.name}</span>
							{workspace.id === data.activeId ? <Check className="text-muted-foreground" /> : null}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => setCreating(true)}>
						<Plus />
						Create workspace…
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => navigate("/settings")}>
						<Settings />
						Workspace settings
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
		</>
	);
}
