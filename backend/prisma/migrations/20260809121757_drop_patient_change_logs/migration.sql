-- Drop patient_change_logs — spec-required (Feature 14) but never
-- implemented via this table; per-field old/new value tracking on patient
-- update is now recorded in system_logs.detail instead (see
-- UpdatePatientUseCase), so this dedicated table stayed permanently empty
-- and unused since creation.
DROP TABLE `patient_change_logs`;
