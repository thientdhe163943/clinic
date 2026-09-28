-- Non-destructive local schema synchronization for the 2026-08-02 codebase.
-- Existing data is preserved. This migration only adds nullable specialty
-- references and extends the CLS category enum with ECG.

SET NAMES utf8mb4;

ALTER TABLE `users`
  ADD COLUMN `specialty_id` CHAR(36) NULL AFTER `role`,
  ADD INDEX `users_specialty_id_idx` (`specialty_id`),
  ADD CONSTRAINT `users_specialty_id_fkey`
    FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `rooms`
  ADD COLUMN `specialty_id` CHAR(36) NULL AFTER `cls_category`,
  MODIFY COLUMN `cls_category` ENUM('LAB', 'XRAY', 'ULTRASOUND', 'ECG') NULL,
  ADD INDEX `rooms_specialty_id_idx` (`specialty_id`),
  ADD CONSTRAINT `rooms_specialty_id_fkey`
    FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `services`
  MODIFY COLUMN `cls_category` ENUM('LAB', 'XRAY', 'ULTRASOUND', 'ECG') NULL;
