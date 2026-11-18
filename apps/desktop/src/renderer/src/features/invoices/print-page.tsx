import { InvoiceDocument } from "@dawnstudio/invoice-templates";
import { useEffect, useLayoutEffect } from "react";
import { useParams } from "react-router";
import { useInvoice, useLogoFile } from "../../lib/queries";

/**
 * `/print/:id`, loaded only by the main process in a hidden window to make PDFs. Renders
 * the issued invoice alone on white, then flags `data-print="ready"` once fonts and the logo
 * have loaded, which is when the main process prints it.
 */
export function PrintPage() {
	const { id } = useParams();
	const { data: invoice, error } = useInvoice(id);
	const logoFile = invoice?.snapshot?.issuer.logoFile;
	const logo = useLogoFile(logoFile);
	const logoDone = !logoFile || logo.isSuccess || logo.isError;

	useLayoutEffect(() => {
		document.documentElement.classList.add("printing");
		document.documentElement.classList.remove("dark");
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		if (error || (invoice && !invoice.snapshot)) {
			root.dataset.print = "error";
			return;
		}
		if (!invoice?.snapshot || !logoDone) return;
		let cancelled = false;
		void (async () => {
			await document.fonts.ready;
			await Promise.all(
				[...document.images].map((image) =>
					image.complete
						? null
						: new Promise((resolve) => image.addEventListener("load", resolve, { once: true })),
				),
			);
			// One more frame so layout has settled.
			requestAnimationFrame(() => {
				if (!cancelled) root.dataset.print = "ready";
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [invoice, logoDone, error]);

	if (!invoice?.snapshot || !logoDone) return null;
	return <InvoiceDocument invoice={invoice.snapshot} logoSrc={logo.data ?? null} />;
}
