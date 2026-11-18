CREATE TABLE `business_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`logo_file` text,
	`default_currency` text NOT NULL,
	`payment_terms_days` integer NOT NULL,
	`number_pattern` text NOT NULL,
	`next_sequence` integer NOT NULL,
	`branding` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text NOT NULL,
	`tax_id` text DEFAULT '' NOT NULL,
	`currency` text,
	`payment_terms_days` integer,
	`notes` text DEFAULT '' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice_events` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_events_invoice_idx` ON `invoice_events` (`invoice_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`tax_rate_id` text,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`,`position`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text,
	`status` text NOT NULL,
	`client_id` text,
	`payment_account_id` text,
	`currency` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`discount` text,
	`notes` text DEFAULT '' NOT NULL,
	`terms` text DEFAULT '' NOT NULL,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`discount_total` integer DEFAULT 0 NOT NULL,
	`taxes` text NOT NULL,
	`tax_total` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`snapshot` text,
	`issued_at` integer,
	`paid_at` integer,
	`voided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`payment_account_id`) REFERENCES `payment_accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_unique` ON `invoices` (`number`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_client_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE INDEX `invoices_issue_date_idx` ON `invoices` (`issue_date`);--> statement-breakpoint
CREATE TABLE `payment_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`currency` text NOT NULL,
	`details` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rate` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
