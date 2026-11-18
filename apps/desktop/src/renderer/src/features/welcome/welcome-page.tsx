import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { stagger } from "@dawnstudio/ui/motion";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { PageSection } from "../../components/page";
import { useProfile, useWorkspaces } from "../../lib/queries";
import { LogoPanel } from "../profile/logo-panel";
import { ProfileForm } from "../profile/profile-form";
import { PaymentAccountForm } from "../settings/payment-account-form";
import { useWorkspaceActions } from "../workspaces/use-workspace-actions";
import { WorkspaceAvatar } from "../workspaces/workspace-avatar";

/** First run: business details, then (optionally) the account clients pay into. */
export function WelcomePage() {
	const navigate = useNavigate();
	const { data: profile, isPending } = useProfile();
	const { data: workspaces } = useWorkspaces();
	const current = workspaces?.workspaces.find((w) => w.id === workspaces.activeId);
	// Decided once on arrival, so saving the profile in step 1 doesn't bounce away mid-setup.
	const [step, setStep] = useState<"business" | "payment" | null>(null);

	if (isPending) return null;
	if (step === null) {
		if (profile) return <Navigate to="/" replace />;
		setStep("business");
		return null;
	}

	const finish = () => navigate("/", { replace: true });

	return (
		<div className="h-full overflow-y-auto">
			<div className="app-drag flex h-13 shrink-0 items-center justify-end px-4">
				<SetupWorkspaceSwitch />
			</div>
			<div className="mx-auto max-w-2xl px-6 pb-16">
				<AnimatePresence mode="wait">
					<motion.div
						key={step}
						variants={stagger(0.05)}
						initial="hidden"
						animate="visible"
						exit={{ opacity: 0, transition: { duration: 0.12 } }}
						className="flex flex-col gap-3"
					>
						<PageSection className="flex flex-col gap-3 pt-6 pb-6">
							<span className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
								Step {step === "business" ? 1 : 2} of 2
							</span>
							<h1 className="text-4xl font-medium tracking-tight">
								{step === "business"
									? workspaces && workspaces.workspaces.length > 1
										? `Set up ${current?.name ?? "your business"}`
										: "Set up your business"
									: "Logo and payment details"}
							</h1>
							<p className="text-lg text-muted-foreground">
								{step === "business"
									? "Enter these once. Every invoice picks them up, so you never type them again."
									: "Both are optional and printed on your invoices. You can add more accounts for other currencies later."}
							</p>
						</PageSection>

						{step === "business" ? (
							<ProfileForm
								profile={null}
								submitLabel="Continue"
								onSaved={() => setStep("payment")}
							/>
						) : (
							<>
								<PageSection>
									<LogoPanel optional />
								</PageSection>
								<PageSection>
									<Panel>
										<PanelHeader>
											<PanelTitle>Payment account</PanelTitle>
											<PanelLabel>Optional</PanelLabel>
										</PanelHeader>
										<PanelBody>
											<PaymentAccountForm
												defaultCurrency={profile?.defaultCurrency}
												submitLabel="Finish setup"
												onSaved={finish}
												secondaryAction={
													<Button type="button" variant="ghost" onClick={finish}>
														Skip for now
													</Button>
												}
											/>
										</PanelBody>
									</Panel>
								</PageSection>
							</>
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}

/** A new workspace starts here; offer a way back to the others without setting it up. */
function SetupWorkspaceSwitch() {
	const { data } = useWorkspaces();
	const actions = useWorkspaceActions();
	const others = data?.workspaces.filter((w) => w.id !== data.activeId) ?? [];
	if (others.length === 0) return null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" className="app-no-drag text-muted-foreground">
					Switch workspace
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{others.map((workspace) => (
					<DropdownMenuItem
						key={workspace.id}
						disabled={actions.pending}
						onSelect={() => actions.switchTo(workspace.id)}
					>
						<WorkspaceAvatar id={workspace.id} name={workspace.name} />
						<span className="truncate">{workspace.name}</span>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
