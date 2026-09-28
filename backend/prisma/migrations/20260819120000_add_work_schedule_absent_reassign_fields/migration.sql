-- Version-up 0.2 Phase 2 #9 (Tình huống B): lets ADMIN mark a doctor absent
-- for a whole shift and swap in a substitute without inserting a second
-- WorkSchedule row for the same room/date/shift -- uq_schedule_user_date_shift
-- and findRoomConflict already establish that 1 room/date/shift belongs to
-- exactly 1 person, so "assign someone else" means overwriting user_id on
-- the existing row (see ReassignScheduleDoctorUseCase), not inserting a new
-- one. original_user_id records who was on the shift before the *first*
-- reassignment (kept as-is on any further reassignment) for audit/reporting.
ALTER TABLE `work_schedules`
  ADD COLUMN `is_absent` tinyint(1) NOT NULL DEFAULT 0 AFTER `updated_by`,
  ADD COLUMN `absent_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `is_absent`,
  ADD COLUMN `original_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `absent_note`;
