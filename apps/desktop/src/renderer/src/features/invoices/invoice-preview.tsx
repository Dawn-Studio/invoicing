import {
	InvoiceDocument,
	type InvoiceTemplateProps,
	pageSizeOf,
} from "@dawnstudio/invoice-templates";
import { cn } from "@dawnstudio/ui/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * The printed page, scaled to the width of its column. The template is laid out at its real
 * page size and shrunk with a transform, so the preview matches the PDF exactly. Long
 * invoices make the sheet taller than one page; the frame follows its height.
 */
export function InvoicePreview({
	className,
	...props
}: InvoiceTemplateProps & { className?: string }) {
	const frame = useRef<HTMLDivElement>(null);
	const sheet = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0);
	const page = pageSizeOf(props.invoice);
	const [height, setHeight] = useState<number>(page.height);

	useLayoutEffect(() => {
		const frameElement = frame.current;
		const sheetElement = sheet.current;
		if (!frameElement || !sheetElement) return;
		const observer = new ResizeObserver(() => {
			setScale(frameElement.clientWidth / page.width);
			setHeight(sheetElement.offsetHeight);
		});
		observer.observe(frameElement);
		observer.observe(sheetElement);
		return () => observer.disconnect();
	}, [page.width]);

	return (
		<div
			ref={frame}
			className={cn(
				"relative w-full overflow-hidden rounded-lg shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_-8px_rgb(0_0_0/0.18)]",
				className,
			)}
			style={{ height: height * scale }}
		>
			<div
				ref={sheet}
				className="absolute top-0 left-0 origin-top-left"
				style={{ transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
			>
				<InvoiceDocument {...props} />
			</div>
		</div>
	);
}
