-- Drop the OPERATING (Phòng điều trị) room type — feature not used, and the
-- clinic doesn't run operating-room workflows. Any existing OPERATING rooms
-- must be removed/retyped before this runs, since MySQL enum columns reject
-- values outside the new set.
ALTER TABLE `rooms` MODIFY COLUMN `type` ENUM('EXAMINATION', 'CLS', 'ADMIN') NOT NULL;
