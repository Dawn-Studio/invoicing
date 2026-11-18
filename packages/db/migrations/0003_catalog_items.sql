CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`unit_price` integer NOT NULL,
	`currency` text NOT NULL,
	`tax_rate_id` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tax_rate_id`) REFERENCES `tax_rates`(`id`) ON UPDATE no action ON DELETE set null
);
