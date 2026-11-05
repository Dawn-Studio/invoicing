import { syncThemeWithSystem } from "@dawnstudio/ui/lib/theme";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

document.documentElement.dataset.platform = window.api.platform;
syncThemeWithSystem();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
