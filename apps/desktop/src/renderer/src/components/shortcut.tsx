import { Kbd } from "@dawnstudio/ui/components/kbd";
import { type Hotkey, useFormatForDisplay } from "@tanstack/react-hotkeys";

/**
 * A shortcut as keys: "⌘ ," on macOS, "Ctrl+," elsewhere. Sequences such as G then I
 * show each step.
 */
export function Shortcut({
	hotkey,
	className,
}: {
	hotkey: Hotkey | null | undefined;
	className?: string;
}) {
	const format = useFormatForDisplay();
	if (!hotkey) return null;
	const steps = Array.isArray(hotkey) ? hotkey : [hotkey];
	return (
		<span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
			{steps.map((step, index) => (
				// Steps can repeat (G G); position is their identity.
				// biome-ignore lint/suspicious/noArrayIndexKey: see above
				<Kbd key={index}>{format(step)}</Kbd>
			))}
		</span>
	);
}
