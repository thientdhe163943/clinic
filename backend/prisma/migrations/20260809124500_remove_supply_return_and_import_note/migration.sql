-- Remove the RETURN supply-transaction type — spec itself flags this as
-- "chưa xác nhận scope" (sprint4/12_medical_supply.md Feature 30) and no
-- use-case/controller has ever created a RETURN transaction. Also drop
-- supply_imports.note — ImportSuppliesDto never accepted this field, so it
-- was always null and never surfaced in any response DTO either.
ALTER TABLE `supply_transactions` MODIFY COLUMN `transaction_type` ENUM('IMPORT', 'DISTRIBUTE') NOT NULL;
ALTER TABLE `supply_imports` DROP COLUMN `note`;
