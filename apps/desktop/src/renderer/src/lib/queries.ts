import { type QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Channel, Input, Output } from "../../../shared/contract";
import { rpc } from "./rpc";

/**
 * React Query wrappers around `rpc`. Query keys start with the entity name, so a mutation
 * invalidates everything about that entity with one key.
 */
export function useRpcQuery<C extends Channel>(
	channel: C,
	input?: Input<C>,
	options: { enabled?: boolean; staleTime?: number } = {},
) {
	return useQuery({
		queryKey: [...channel.split("."), input ?? null] as QueryKey,
		queryFn: () => (rpc as (c: C, i?: Input<C>) => Promise<Output<C>>)(channel, input),
		...options,
	});
}

export function useRpcMutation<C extends Channel>(channel: C, invalidates: string[]) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: Input<C>) =>
			(rpc as (c: C, i: Input<C>) => Promise<Output<C>>)(channel, input),
		onSuccess: () =>
			Promise.all(invalidates.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
	});
}

export const useAppInfo = () => useRpcQuery("app.info");
export const useProfile = () => useRpcQuery("profile.get");
export const useSaveProfile = () => useRpcMutation("profile.save", ["profile"]);
export const useLogo = () => useRpcQuery("profile.logo");
export const useChooseLogo = () => useRpcMutation("profile.chooseLogo", ["profile"]);
export const useRemoveLogo = () => useRpcMutation("profile.removeLogo", ["profile"]);

export const useClients = (input?: Input<"clients.list">) => useRpcQuery("clients.list", input);
export const useClient = (id: string | undefined) =>
	useRpcQuery("clients.get", { id: id ?? "" }, { enabled: Boolean(id) });
export const useCreateClient = () => useRpcMutation("clients.create", ["clients"]);
export const useUpdateClient = () => useRpcMutation("clients.update", ["clients", "invoices"]);
export const useArchiveClient = () => useRpcMutation("clients.archive", ["clients"]);
export const useUnarchiveClient = () => useRpcMutation("clients.unarchive", ["clients"]);
export const useClientStats = (id: string) => useRpcQuery("clients.stats", { id });
export const useImportClients = () => useRpcMutation("clients.import", ["clients"]);

/** A logo by stored file name; null name → no logo. */
export const useLogoFile = (fileName: string | null | undefined) =>
	useRpcQuery("logos.get", { fileName: fileName ?? "" }, { enabled: Boolean(fileName) });

export const useInvoices = (input?: Input<"invoices.list">) => useRpcQuery("invoices.list", input);
export const useInvoice = (id: string | undefined) =>
	useRpcQuery("invoices.get", { id: id ?? "" }, { enabled: Boolean(id) });
export const useCreateDraft = () => useRpcMutation("invoices.createDraft", ["invoices", "clients"]);
export const useDeleteDraft = () => useRpcMutation("invoices.deleteDraft", ["invoices", "clients"]);
export const useDuplicateInvoice = () =>
	useRpcMutation("invoices.duplicate", ["invoices", "clients"]);
// Issuing uses up a sequence number, so the profile's "next number" changes too.
export const useIssueInvoice = () =>
	useRpcMutation("invoices.issue", ["invoices", "clients", "profile"]);

export const usePaymentAccounts = () => useRpcQuery("paymentAccounts.list");
export const useCreatePaymentAccount = () =>
	useRpcMutation("paymentAccounts.create", ["paymentAccounts"]);
export const useUpdatePaymentAccount = () =>
	useRpcMutation("paymentAccounts.update", ["paymentAccounts"]);
export const useArchivePaymentAccount = () =>
	useRpcMutation("paymentAccounts.archive", ["paymentAccounts"]);

export const useTaxRates = () => useRpcQuery("taxRates.list");
export const useCreateTaxRate = () => useRpcMutation("taxRates.create", ["taxRates"]);
export const useUpdateTaxRate = () => useRpcMutation("taxRates.update", ["taxRates"]);
export const useArchiveTaxRate = () => useRpcMutation("taxRates.archive", ["taxRates"]);

export const useWorkspaces = () => useRpcQuery("workspaces.list");
export const useRenameWorkspace = () => useRpcMutation("workspaces.rename", ["workspaces"]);

const invoiceKeys = ["invoices", "clients", "reports"];
export const usePayments = (id: string) => useRpcQuery("invoices.payments", { id });
export const useRecordPayment = () => useRpcMutation("invoices.recordPayment", invoiceKeys);
export const useRemovePayment = () => useRpcMutation("invoices.removePayment", invoiceKeys);
export const useMarkPaid = () => useRpcMutation("invoices.markPaid", invoiceKeys);
export const useVoidInvoice = () => useRpcMutation("invoices.void", invoiceKeys);

export const useCatalog = (input?: Input<"catalog.list">) => useRpcQuery("catalog.list", input);
export const useCreateCatalogItem = () => useRpcMutation("catalog.create", ["catalog"]);
export const useUpdateCatalogItem = () => useRpcMutation("catalog.update", ["catalog"]);
export const useArchiveCatalogItem = () => useRpcMutation("catalog.archive", ["catalog"]);
export const useUnarchiveCatalogItem = () => useRpcMutation("catalog.unarchive", ["catalog"]);

/** Reports are cheap to compute and change with almost any write, so they refetch on mount. */
export const useDashboardReport = (currency?: string) =>
	useRpcQuery("reports.dashboard", currency ? { currency } : undefined, { staleTime: 0 });
export const usePeriodReport = (input: Input<"reports.period">) =>
	useRpcQuery("reports.period", input, { staleTime: 0 });

export const useTheme = () => useRpcQuery("preferences.theme");
export const useSetTheme = () => useRpcMutation("preferences.setTheme", ["preferences"]);
export const usePalette = () => useRpcQuery("preferences.palette");
export const useSetPalette = () => useRpcMutation("preferences.setPalette", ["preferences"]);
