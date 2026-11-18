import { Button } from "@dawnstudio/ui/components/button";
import {
	Panel,
	PanelBody,
	PanelHeader,
	PanelLabel,
	PanelTitle,
} from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { showSaveError } from "../../lib/forms";
import { useChooseLogo, useLogo, useProfile, useRemoveLogo } from "../../lib/queries";

/** The logo on a white tile: invoices are printed on white, so that's how it will look. */
export function LogoTile({
	src,
	className,
}: {
	src: string | null | undefined;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white",
				className,
			)}
		>
			{src ? (
				<img src={src} alt="" className="size-full object-contain p-[12%]" draggable={false} />
			) : (
				<ImageIcon className="size-1/3 text-neutral-400" />
			)}
		</div>
	);
}

export function LogoPanel({ optional = false }: { optional?: boolean }) {
	const { data: profile } = useProfile();
	const { data: logo } = useLogo();
	const choose = useChooseLogo();
	const remove = useRemoveLogo();
	const busy = choose.isPending || remove.isPending;

	const onChoose = () =>
		choose
			.mutateAsync(undefined)
			.then((saved) => saved && toast.success("Logo updated"))
			.catch((error) => showSaveError(error));
	// Old logo files stay on disk: invoices issued with them still point at them.
	const onRemove = () => remove.mutateAsync(undefined).catch((error) => showSaveError(error));

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Logo</PanelTitle>
				{optional ? <PanelLabel>Optional</PanelLabel> : null}
			</PanelHeader>
			<PanelBody className="flex items-center gap-5">
				<LogoTile src={logo} className="h-20 w-32" />
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<p className="text-sm text-muted-foreground">
						Printed at the top of your invoices. PNG, JPG, WebP or SVG up to 2 MB; a wide logo on a
						transparent background works best.
					</p>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onChoose}
							disabled={busy || !profile}
						>
							{choose.isPending ? <Spinner /> : null}
							{profile?.logoFile ? "Replace…" : "Choose image…"}
						</Button>
						{profile?.logoFile ? (
							<Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={busy}>
								Remove
							</Button>
						) : null}
					</div>
				</div>
			</PanelBody>
		</Panel>
	);
}
