-- Email is no longer mandatory when creating a patient/staff account —
-- login already works via phone or idCard (see LoginUseCase /
-- findByEmailOrPhone). MySQL's unique index permits any number of NULLs,
-- so this doesn't relax the "no two accounts share a real email" guarantee.
ALTER TABLE `users` MODIFY COLUMN `email` VARCHAR(150) NULL;
