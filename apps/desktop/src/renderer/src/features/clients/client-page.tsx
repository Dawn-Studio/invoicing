import { type Client, clientInputSchema } from "@dawnstudio/core";
import { Alert, AlertDescription, AlertTitle } from "@dawnstudio/ui/components/alert";
import { Button } from "@dawnstudio/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@dawnstudio/ui/components/dropdown-menu";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@dawnstudio/ui/components/panel";
import { Spinner } from "@dawnstudio/ui/components/spinner";
import { cn } from "@dawnstudio/ui/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, ArchiveRestore, Ellipsis, Plus, X } from "lucide-react";
import { FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { z } from "zod";
import { CurrencyField, NumberField, TextareaField, TextField } from "../../components/form/fields";
import { Page, PageSection } from "../../components/page";
import { formatTimestamp } from "../../lib/format";
import { showSaveError } from "../../lib/forms";
import {
	useArchiveClient,
	useClient,
	useCreateClient,
	useProfile,
	useUnarchiveClient,
	useUpdateClient,
} from "../../lib/queries";
import { AddressPanel } from "../profile/profile-form";
import { ClientInvoicesPanel, ClientOverviewPanel } from "./client-overview";

type Values = z.input<typeof clientInputSchema>;
type Output = z.output<typeof clientInputSchema>;

const emptyValues: Values = {
	name: "",
	contactName: "",
	email: "",
	phone: "",
	taxId: "",
	address: { line1: "", line2: "", city: "", region: "", postalCode: "", country: "" },
	currency: null,
	paymentTermsDays: null,
	notes: "",
	contacts: [],
};

function toFormValues(client: Client): Values {
	const { id: _, archivedAt: __, createdAt: ___, updatedAt: ____, ...values } = client;
	return values;
}

/** Create (`/clients/new`) or edit (`/clients/:id`) a client. */
export function ClientPage() {
	const { id } = useParams();
	const { data: client, isPending, error } = useClient(id);

	if (id && isPending)
		return (
			<Page title="Client" back={{ to: "/clients", label: "Clients" }}>
				{null}
			</Page>
		);
	if (id && (error || !client)) {
		return (
			<Page title="Client" back={{ to: "/clients", label: "Clients" }}>
				<PageSection>
					<Alert>
						<AlertTitle>Client not found</AlertTitle>
						<AlertDescription>It may have been removed.</AlertDescription>
					</Alert>
				</PageSection>
			</Page>
		);
	}
	// Remount per client so the form starts from that client's saved values.
	return <ClientForm key={client?.id ?? "new"} client={client} />;
}

function ClientForm({ client }: { client: Client | undefined }) {
	const navigate = useNavigate();
	const { data: profile } = useProfile();
	const create = useCreateClient();
	const update = useUpdateClient();
	const archive = useArchiveClient();
	const unarchive = useUnarchiveClient();

	const form = useForm<Values, unknown, Output>({
		resolver: zodResolver(clientInputSchema),
		defaultValues: client ? toFormValues(client) : emptyValues,
	});
	const { isDirty, isSubmitting } = form.formState;

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			if (client) {
				const saved = await update.mutateAsync({ id: client.id, data: values });
				form.reset(toFormValues(saved));
				toast.success("Saved");
			} else {
				const saved = await create.mutateAsync(values);
				toast.success(`Added ${saved.name}`);
				navigate(`/clients/${saved.id}`, { replace: true });
			}
		} catch (error) {
			showSaveError(error, form.setError, "data.");
		}
	});

	const toggleArchived = async () => {
		if (!client) return;
		try {
			if (client.archivedAt) {
				await unarchive.mutateAsync({ id: client.id });
				toast.success(`${client.name} is active again`);
			} else {
				await archive.mutateAsync({ id: client.id });
				toast.success(`Archived ${client.name}`);
				navigate("/clients");
			}
		} catch (error) {
			showSaveError(error);
		}
	};

	const businessDefault = profile
		? `Business default (${profile.defaultCurrency})`
		: "Business default";

	return (
		<Page
			title={client ? client.name : "New client"}
			back={{ to: "/clients", label: "Clients" }}
			actions={
				client ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon-sm" aria-label="More actions">
								<Ellipsis />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onSelect={toggleArchived}>
								{client.archivedAt ? <ArchiveRestore /> : <Archive />}
								{client.archivedAt ? "Restore client" : "Archive client"}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : null
			}
		>
			{client?.archivedAt ? (
				<PageSection>
					<Alert>
						<Archive />
						<AlertTitle>Archived on {formatTimestamp(client.archivedAt)}</AlertTitle>
						<AlertDescription>
							Archived clients are hidden from lists. Their invoices are kept as they are.
						</AlertDescription>
					</Alert>
				</PageSection>
			) : null}

			{client ? (
				<>
					<PageSection>
						<ClientOverviewPanel client={client} />
					</PageSection>
					<PageSection>
						<ClientInvoicesPanel clientId={client.id} />
					</PageSection>
				</>
			) : null}

			<FormProvider {...form}>
				<form onSubmit={onSubmit} className="contents" noValidate>
					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Client</PanelTitle>
							</PanelHeader>
							<PanelBody className="grid grid-cols-2 gap-x-4 gap-y-5">
								<TextField<Values>
									name="name"
									label="Company or client name"
									className="col-span-2"
									autoFocus={!client}
								/>
								<TextField<Values> name="contactName" label="Contact person" />
								<TextField<Values> name="email" label="Billing email" type="email" />
								<TextField<Values> name="phone" label="Phone" type="tel" />
								<TextField<Values>
									name="taxId"
									label="Tax or VAT number"
									inputClassName="font-mono"
								/>
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection>
						<ContactsPanel />
					</PageSection>

					<PageSection>
						<AddressPanel title="Billing address" />
					</PageSection>

					<PageSection>
						<Panel>
							<PanelHeader>
								<PanelTitle>Billing defaults</PanelTitle>
							</PanelHeader>
							<PanelBody className="grid grid-cols-2 gap-x-4 gap-y-5">
								<CurrencyField<Values>
									name="currency"
									label="Currency"
									emptyLabel={businessDefault}
								/>
								<NumberField<Values>
									name="paymentTermsDays"
									label="Payment terms, days"
									nullable
									min={0}
									placeholder={
										profile ? `${profile.paymentTermsDays} (business default)` : undefined
									}
								/>
								<TextareaField<Values>
									name="notes"
									label="Notes"
									description="Only for you; not printed on invoices."
									className="col-span-2"
									rows={3}
								/>
							</PanelBody>
						</Panel>
					</PageSection>

					<PageSection className="flex justify-end gap-2">
						{!client ? (
							<Button type="button" variant="ghost" onClick={() => navigate("/clients")}>
								Cancel
							</Button>
						) : null}
						<Button type="submit" disabled={isSubmitting || (Boolean(client) && !isDirty)}>
							{isSubmitting ? <Spinner /> : null}
							{client ? "Save changes" : "Add client"}
						</Button>
					</PageSection>
				</form>
			</FormProvider>
		</Page>
	);
}

/** People who get a copy of each invoice, e.g. an accounts-payable inbox. */
function ContactsPanel() {
	const { control } = useFormContext<Values>();
	const { fields, append, remove } = useFieldArray({ control, name: "contacts" });

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Other contacts</PanelTitle>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => append({ name: "", email: "" })}
				>
					<Plus />
					Add contact
				</Button>
			</PanelHeader>
			<PanelBody>
				{fields.length === 0 ? (
					<p className="text-[0.9375rem] text-muted-foreground">
						People who should get a copy of every invoice, such as an accounts payable inbox.
					</p>
				) : (
					<div className="flex flex-col gap-3">
						{fields.map((field, index) => (
							<div
								key={field.id}
								className={cn(
									"grid grid-cols-[1fr_1fr_auto] items-start gap-x-4",
									index > 0 && "[&_[data-slot=field-label]]:sr-only",
								)}
							>
								<TextField<Values>
									name={`contacts.${index}.name`}
									label="Name"
									placeholder="Optional"
								/>
								<TextField<Values>
									name={`contacts.${index}.email`}
									label="Email"
									type="email"
									autoFocus={index === fields.length - 1 && field.email === ""}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label="Remove contact"
									className={cn("text-muted-foreground", index === 0 && "mt-[31px]")}
									onClick={() => remove(index)}
								>
									<X />
								</Button>
							</div>
						))}
					</div>
				)}
			</PanelBody>
		</Panel>
	);
}
