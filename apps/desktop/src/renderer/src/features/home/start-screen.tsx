import { Panel, PanelBody, PanelHeader, PanelTitle } from "@dawnstudio/ui/components/panel";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@dawnstudio/ui/components/select";
import {
	ChartColumn,
	FileText,
	House,
	LayoutDashboard,
	type LucideIcon,
	Users,
} from "lucide-react";
import { Navigate } from "react-router";
import type { StartScreen } from "../../../../shared/contract";
import { showSaveError } from "../../lib/forms";
import { useSetStartScreen, useStartScreen } from "../../lib/queries";

/** Same labels and icons as the sidebar, so the choice reads as "open this page". */
export const START_SCREEN_OPTIONS: {
	value: StartScreen;
	label: string;
	icon: LucideIcon;
	path: string;
}[] = [
	{ value: "home", label: "Home", icon: House, path: "/home" },
	{ value: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
	{ value: "invoices", label: "Invoices", icon: FileText, path: "/invoices" },
	{ value: "clients", label: "Clients", icon: Users, path: "/clients" },
	{ value: "reports", label: "Reports", icon: ChartColumn, path: "/reports" },
];

const isStartScreen = (value: string): value is StartScreen =>
	START_SCREEN_OPTIONS.some((option) => option.value === value);

/** "/": wherever the user chose to start (the assistant home unless they picked a screen). */
export function StartScreenRedirect() {
	const { data: screen, isPending } = useStartScreen();
	if (isPending) return null;
	const path = START_SCREEN_OPTIONS.find((option) => option.value === screen)?.path ?? "/home";
	return <Navigate to={path} replace />;
}

/** Settings → Appearance: what the app opens with. */
export function StartScreenPanel() {
	const { data: screen = "home" } = useStartScreen();
	const set = useSetStartScreen();
	return (
		<Panel>
			<PanelHeader>
				<PanelTitle id="start-screen-label">Start screen</PanelTitle>
			</PanelHeader>
			<PanelBody className="flex items-center justify-between gap-4">
				<p className="text-sm text-muted-foreground">Opens when you launch the app</p>
				<Select
					value={screen}
					onValueChange={(value) => {
						if (!isStartScreen(value)) return;
						set.mutate({ screen: value }, { onError: (error) => showSaveError(error) });
					}}
				>
					<SelectTrigger aria-labelledby="start-screen-label" className="w-44">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{START_SCREEN_OPTIONS.map(({ value, label, icon: Icon }) => (
							<SelectItem key={value} value={value}>
								<Icon />
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</PanelBody>
		</Panel>
	);
}
