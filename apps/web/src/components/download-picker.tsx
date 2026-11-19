import { cn } from "@dawnstudio/ui/lib/utils";
import { transitions } from "@dawnstudio/ui/motion";
import { ArrowUpRight, Download } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Download buttons for the latest GitHub release. The asset names come from
 * apps/desktop/electron-builder.yml. Until the release loads (or if GitHub can't be reached)
 * every button points at the releases page, so nothing is ever a dead link.
 */

type Os = "mac" | "windows" | "linux";

interface Choice {
	id: string;
	os: Os;
	label: string;
	/** For the big button: "Download for …". */
	short: string;
	detail: string;
	pattern: RegExp;
}

const CHOICES: Choice[] = [
	{
		id: "mac-arm64",
		os: "mac",
		label: "macOS · Apple silicon",
		short: "Mac (Apple silicon)",
		detail: "M1 and newer, .dmg",
		pattern: /-mac-arm64\.dmg$/,
	},
	{
		id: "mac-x64",
		os: "mac",
		label: "macOS · Intel",
		short: "Mac (Intel)",
		detail: "Intel Macs, .dmg",
		pattern: /-mac-x64\.dmg$/,
	},
	{
		id: "windows",
		os: "windows",
		label: "Windows",
		short: "Windows",
		detail: "Windows 10 and 11, 64-bit installer",
		pattern: /-windows-setup\.exe$/,
	},
	{
		id: "appimage",
		os: "linux",
		label: "Linux · AppImage",
		short: "Linux (AppImage)",
		detail: "Most distributions, x64",
		pattern: /-linux-x86_64\.AppImage$/,
	},
	{
		id: "deb",
		os: "linux",
		label: "Linux · .deb",
		short: "Linux (.deb)",
		detail: "Debian and Ubuntu, x64",
		pattern: /_amd64\.deb$/,
	},
];

interface Release {
	version: string;
	date: string;
	url: string;
	assets: Record<string, { url: string; size: number }>;
}

function detectOs(): Os | null {
	const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
	const platform = (nav.userAgentData?.platform ?? navigator.platform ?? "").toLowerCase();
	const agent = navigator.userAgent.toLowerCase();
	if (platform.includes("mac") || agent.includes("mac os")) {
		// iPhones and iPads also say "Mac"; they can't run the app.
		return navigator.maxTouchPoints > 1 && !platform.includes("mac") ? null : "mac";
	}
	if (platform.includes("win") || agent.includes("windows")) return "windows";
	if (platform.includes("linux") || agent.includes("linux")) {
		return agent.includes("android") ? null : "linux";
	}
	return null;
}

const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;
const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function DownloadPicker({ repo }: { repo: string }) {
	const releasesUrl = `https://github.com/${repo}/releases`;
	const [release, setRelease] = useState<Release | null>(null);
	const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");
	const [os, setOs] = useState<Os | null>(null);

	useEffect(() => {
		setOs(detectOs());
		const controller = new AbortController();
		fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
			headers: { Accept: "application/vnd.github+json" },
			signal: controller.signal,
		})
			.then(async (response) => {
				if (response.status === 404) return setState("none");
				if (!response.ok) throw new Error(String(response.status));
				const data = (await response.json()) as {
					tag_name: string;
					published_at: string;
					html_url: string;
					assets: { name: string; browser_download_url: string; size: number }[];
				};
				const assets: Release["assets"] = {};
				for (const choice of CHOICES) {
					const asset = data.assets.find((a) => choice.pattern.test(a.name));
					if (asset) assets[choice.id] = { url: asset.browser_download_url, size: asset.size };
				}
				setRelease({
					version: data.tag_name.replace(/^v/, ""),
					date: data.published_at,
					url: data.html_url,
					assets,
				});
				setState("ready");
			})
			.catch((error: unknown) => {
				if (!(error instanceof DOMException && error.name === "AbortError")) setState("error");
			});
		return () => controller.abort();
	}, [repo]);

	const href = (choice: Choice) => release?.assets[choice.id]?.url ?? release?.url ?? releasesUrl;
	// No big buttons before there's a release to download.
	const primary = state === "none" ? [] : CHOICES.filter((choice) => choice.os === os);

	return (
		<div className="flex flex-col gap-8">
			<p className="min-h-6 text-sm text-muted-foreground" aria-live="polite">
				{state === "loading" && "Looking up the latest version…"}
				{state === "ready" && release
					? `Version ${release.version} · released ${dateFormat.format(new Date(release.date))}`
					: null}
				{state === "none" &&
					"The first release is on its way. Watch the GitHub repository to hear when it's out."}
				{state === "error" && (
					<>
						Couldn't reach GitHub.{" "}
						<a href={releasesUrl} className="underline underline-offset-4 hover:text-foreground">
							All downloads are on the releases page
						</a>
						.
					</>
				)}
			</p>

			{primary.length > 0 ? (
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={transitions.smooth}
					className="flex flex-wrap gap-3"
				>
					{primary.map((choice, index) => (
						<a
							key={choice.id}
							href={href(choice)}
							className={cn(
								"inline-flex h-12 items-center gap-2.5 rounded-lg px-5 font-medium transition-[filter,background-color] [&_svg]:size-4",
								index === 0
									? "bg-primary text-primary-foreground shadow-[0_8px_24px_-8px] shadow-primary/60 hover:brightness-95"
									: "border bg-background hover:bg-accent",
							)}
						>
							<Download />
							Download for {choice.short}
						</a>
					))}
				</motion.div>
			) : null}

			<div className="overflow-hidden rounded-xl border bg-panel">
				<ul className="divide-y">
					{CHOICES.map((choice) => {
						const asset = release?.assets[choice.id];
						return (
							<li key={choice.id}>
								<a
									href={href(choice)}
									className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/60"
								>
									<div className="min-w-0 flex-1">
										<div className="font-medium">{choice.label}</div>
										<div className="text-sm text-muted-foreground">
											{choice.detail}
											{asset ? ` · ${megabytes(asset.size)}` : null}
										</div>
									</div>
									{choice.os === os ? (
										<span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-brand-ink">
											Your computer
										</span>
									) : null}
									{asset ? (
										<Download className="size-4 text-muted-foreground" />
									) : (
										<ArrowUpRight className="size-4 text-muted-foreground" />
									)}
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
