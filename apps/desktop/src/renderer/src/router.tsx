import { createHashRouter, Navigate } from "react-router";
import { AppLayout } from "./app-layout";
import { RouteError } from "./components/route-error";
import { ItemsPage } from "./features/catalog/items-page";
import { ClientPage } from "./features/clients/client-page";
import { ClientsPage } from "./features/clients/clients-page";
import { DashboardPage } from "./features/dashboard/dashboard-page";
import { InvoicePage } from "./features/invoices/invoice-page";
import { InvoicesPage } from "./features/invoices/invoices-page";
import { PrintPage } from "./features/invoices/print-page";
import { ReportsPage } from "./features/reports/reports-page";
import { SettingsPage } from "./features/settings/settings-page";
import { WelcomePage } from "./features/welcome/welcome-page";

// Hash routing works with the file:// URL the packaged app loads from.
export const router = createHashRouter([
	{ path: "/welcome", element: <WelcomePage />, errorElement: <RouteError /> },
	{ path: "/print/:id", element: <PrintPage /> },
	{
		element: <AppLayout />,
		errorElement: <RouteError />,
		children: [
			{
				// A screen that crashes is replaced by the error inside the layout; the sidebar stays.
				errorElement: <RouteError />,
				children: [
					{ index: true, element: <DashboardPage /> },
					{ path: "invoices", element: <InvoicesPage /> },
					{ path: "invoices/:id", element: <InvoicePage /> },
					{ path: "clients", element: <ClientsPage /> },
					{ path: "clients/new", element: <ClientPage /> },
					{ path: "clients/:id", element: <ClientPage /> },
					{ path: "items", element: <ItemsPage /> },
					{ path: "reports", element: <ReportsPage /> },
					{ path: "settings", element: <Navigate to="/settings/general" replace /> },
					{ path: "settings/:section", element: <SettingsPage /> },
					{ path: "*", element: <Navigate to="/" replace /> },
				],
			},
		],
	},
]);
