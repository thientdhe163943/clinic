-- Remove the drug-interaction feature entirely: medicine_interactions had no
-- CRUD path to populate it (only a read-side check in
-- CreatePrescriptionUseCase), so it was permanently empty in production and
-- the check could never actually fire. prescription_items.interaction_warning
-- is dropped alongside it since it can now never be anything but false.
ALTER TABLE `prescription_items` DROP COLUMN `interaction_warning`;
DROP TABLE `medicine_interactions`;
