import {
	InvoiceDocument,
	type InvoiceTemplateProps,
	PAGE_HEIGHT,
	PAGE_WIDTH,
} from "@dawnstudio/invoice-templates";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * The printed page, scaled to the width of its column. The template is laid out at its real
 * page size and shrunk with a transform, so the preview matches the PDF exactly.
 */
export function InvoicePreview({
	className,
	...props
}: InvoiceTemplateProps & { className?: string }) {
	const frame = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0);

	useLayoutEffect(() => {
		const element = frame.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setScale(entry.contentRect.width / PAGE_WIDTH);
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div
			ref={frame}
			className={cn(
				"relative w-full overflow-hidden rounded-lg shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-8px_rgb(0_0_0/0.18)]",
				className,
			)}
			style={{ height: PAGE_HEIGHT * scale }}
		>
			<div
				className="absolute top-0 left-0 origin-top-left"
				style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
			>
				<InvoiceDocument {...props} />
			</div>
		</div>
	);
}
