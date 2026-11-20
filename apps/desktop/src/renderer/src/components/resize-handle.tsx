import { cn } from "@dawnstudio/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

const STEP = 16;

/** The screen between the sidebar and the assistant never gets narrower than this. */
export const MIN_SCREEN = 460;

export function useWindowWidth() {
	const [width, setWidth] = useState(() => window.innerWidth);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);
	return width;
}

interface Bounds {
	min: number;
	max: number;
}

/**
 * A panel width the user can drag, remembered on this computer. Widths are a per-computer
 * convenience, so browser storage is enough; a missing or unreadable value means the default.
 */
export function usePanelWidth(key: string, fallback: number, { min, max }: Bounds) {
	const clamp = useCallback(
		(value: number) => Math.round(Math.min(max, Math.max(min, value))),
		[min, max],
	);
	const [width, setWidth] = useState(() => {
		try {
			const saved = Number(localStorage.getItem(`panel-width:${key}`));
			return saved > 0 ? saved : fallback;
		} catch {
			return fallback;
		}
	});
	const save = useCallback(
		(value: number) => {
			try {
				localStorage.setItem(`panel-width:${key}`, String(value));
			} catch {
				// Not remembered; fine.
			}
		},
		[key],
	);
	return { width: clamp(width), setWidth: (value: number) => setWidth(clamp(value)), save, clamp };
}

interface ResizeHandleProps {
	/** Which way dragging grows the panel: a left sidebar grows to the right, a right panel to the left. */
	grows: "right" | "left";
	width: number;
	min: number;
	max: number;
	onResize: (width: number) => void;
	/** When a drag or key press ends; persist here. */
	onCommit: (width: number) => void;
	/** Double-click: back to the default width. */
	onReset: () => void;
	/** Lets the panel turn off its width animation while dragging. */
	onDraggingChange?: (dragging: boolean) => void;
	label: string;
	className?: string;
	style?: React.CSSProperties;
}

/**
 * The thin strip on a panel's edge. Drag it (or focus it and use the arrow keys) to change the
 * width; double-click to reset. A hairline shows on hover so it's discoverable without clutter.
 */
export function ResizeHandle({
	grows,
	width,
	min,
	max,
	onResize,
	onCommit,
	onReset,
	onDraggingChange,
	label,
	className,
	style,
}: ResizeHandleProps) {
	const latest = useRef(width);
	latest.current = width;
	const handlers = useRef({ onResize, onCommit });
	handlers.current = { onResize, onCommit };
	const [dragging, setDragging] = useState(false);

	const setActive = (active: boolean) => {
		setDragging(active);
		onDraggingChange?.(active);
		// While dragging: the resize cursor everywhere, no text selection, no width transitions.
		document.documentElement.classList.toggle("resizing", active);
	};

	const sign = grows === "right" ? 1 : -1;

	return (
		// biome-ignore lint/a11y/useSemanticElements: an <hr> can't be focused or dragged; this is the ARIA window splitter pattern
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label}
			aria-valuenow={width}
			aria-valuemin={min}
			aria-valuemax={max}
			tabIndex={0}
			title={`${label} · double-click to reset`}
			data-dragging={dragging || undefined}
			className={cn(
				"group/handle app-no-drag absolute inset-y-0 z-30 flex w-2 cursor-col-resize touch-none justify-center outline-none",
				className,
			)}
			style={style}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				const startX = event.clientX;
				const startWidth = latest.current;
				setActive(true);
				// Follow the pointer on the whole window: the handle moves as the panel resizes,
				// so it can't rely on staying under the pointer.
				const move = (e: PointerEvent) =>
					handlers.current.onResize(startWidth + sign * (e.clientX - startX));
				const end = () => {
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", end);
					window.removeEventListener("pointercancel", end);
					window.removeEventListener("blur", end);
					setActive(false);
					// After React has applied the last width; a drag that changed nothing (say, pushing
					// against a limit) keeps the width the user chose before.
					requestAnimationFrame(() => {
						if (latest.current !== startWidth) handlers.current.onCommit(latest.current);
					});
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", end);
				window.addEventListener("pointercancel", end);
				window.addEventListener("blur", end);
			}}
			onDoubleClick={onReset}
			onKeyDown={(event) => {
				const delta =
					event.key === "ArrowRight" ? STEP * sign : event.key === "ArrowLeft" ? -STEP * sign : 0;
				if (event.key === "Home" || event.key === "End") {
					event.preventDefault();
					const next = (event.key === "Home") === (grows === "right") ? min : max;
					onResize(next);
					onCommit(next);
				} else if (delta) {
					event.preventDefault();
					const next = Math.min(max, Math.max(min, width + delta));
					onResize(next);
					onCommit(next);
				}
			}}
		>
			<span
				aria-hidden="true"
				className="h-full w-px bg-transparent transition-colors delay-100 group-hover/handle:bg-primary/60 group-focus-visible/handle:bg-primary group-data-[dragging]/handle:bg-primary group-data-[dragging]/handle:delay-0"
			/>
		</div>
	);
}
