import { createHashRouter } from "react-router";
import { AppLayout } from "./app-layout";
import { ItemsPage } from "./features/catalog/items-page";
import { ClientPage } from "./features/clients/client-page";
import { ClientsPage } from "./features/clients/clients-page";
import { DashboardPage } from "./features/dashboard/dashboard-page";
import { InvoicePage } from "./features/invoices/invoice-page";
import { InvoicesPage } from "./features/invoices/invoices-page";
import { SettingsPage } from "./features/settings/settings-page";
import { WelcomePage } from "./features/welcome/welcome-page";

// Hash routing works with the file:// URL the packaged app loads from.
export const router = createHashRouter([
	{ path: "/welcome", element: <WelcomePage /> },
	{
		element: <AppLayout />,
		children: [
			{ index: true, element: <DashboardPage /> },
			{ path: "invoices", element: <InvoicesPage /> },
			{ path: "invoices/:id", element: <InvoicePage /> },
			{ path: "clients", element: <ClientsPage /> },
			{ path: "clients/new", element: <ClientPage /> },
			{ path: "clients/:id", element: <ClientPage /> },
			{ path: "items", element: <ItemsPage /> },
			{ path: "settings", element: <SettingsPage /> },
		],
	},
]);
