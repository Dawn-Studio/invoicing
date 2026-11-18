CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`method` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`,`date`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `amount_paid` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Invoices marked paid before payments were tracked get one payment for the full total.
INSERT INTO `payments` (`id`, `invoice_id`, `amount`, `date`, `method`, `note`, `created_at`)
SELECT
	lower(substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)),
	`id`, `total`, date(coalesce(`paid_at`, `updated_at`) / 1000, 'unixepoch'), '', '', coalesce(`paid_at`, `updated_at`)
FROM (SELECT hex(randomblob(16)) AS h, * FROM `invoices` WHERE `status` = 'paid');--> statement-breakpoint
UPDATE `invoices` SET `amount_paid` = `total` WHERE `status` = 'paid';
