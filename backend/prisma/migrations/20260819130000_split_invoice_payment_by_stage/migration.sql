-- Version-up 0.2 item #10 "Tách luồng thanh toán theo từng bước": Invoice's
-- lifecycle moves from "create once, pay once, at the very end of the
-- visit" to "create early at check-in, grow line-by-line (exam fee -> CLS
-- fee(s) -> medicine fee), collected in stages". See
-- kaizen/KE_HOACH_VERSION_UP_0.2.md, Phase 2.5, for the full design.
--
-- NOT YET APPLIED to any real database as of this commit — verify against
-- the target DB's actual constraint names (schema.sql is the DDL source of
-- truth for what's really deployed) before running this against AWS RDS.

-- 1. invoice_items.paid_at — marks a specific billed line as collected.
ALTER TABLE `invoice_items`
  ADD COLUMN `paid_at` datetime DEFAULT NULL AFTER `amount`;

-- 2. invoices.amount_due can no longer be forced to equal total: with
-- per-item payments, amount_due now tracks the sum of still-unpaid items
-- and can legitimately sit strictly between 0 and total while
-- payment_status = PARTIALLY_PAID. chk_invoices_amount_due (>= 0) is kept.
ALTER TABLE `invoices`
  DROP CHECK `chk_invoices_amount_due_calc`;

-- 3. invoice_payments — one row per "collect now" round a receptionist
-- performs (thu phí khám / thu phí CLS / thu tiền thuốc), replacing the old
-- single Invoice.paidAt/paymentMethod-only, all-at-once payment model.
CREATE TABLE `invoice_payments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `method` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paid_at` datetime NOT NULL,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_invoice_payments_invoice` (`invoice_id`),
  KEY `fk_invoice_payments_created_by` (`created_by`),
  CONSTRAINT `fk_invoice_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_payments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_invoice_payments_amount` CHECK ((`amount` >= 0)),
  CONSTRAINT `chk_invoice_payments_method` CHECK ((`method` in (_utf8mb4'CASH',_utf8mb4'CARD',_utf8mb4'TRANSFER')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. invoice_payment_items — join table: which invoice_items rows a given
-- invoice_payments round covered (lets a future per-stage receipt print
-- know exactly what it collected).
CREATE TABLE `invoice_payment_items` (
  `invoice_payment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_item_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`invoice_payment_id`, `invoice_item_id`),
  KEY `fk_invoice_payment_items_item` (`invoice_item_id`),
  CONSTRAINT `fk_invoice_payment_items_payment` FOREIGN KEY (`invoice_payment_id`) REFERENCES `invoice_payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_payment_items_item` FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
