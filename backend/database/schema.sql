-- =====================================================================
-- Clinic System — canonical database schema
-- =====================================================================
-- Single source of truth for the full table structure, generated directly
-- from the live database (SHOW CREATE TABLE / SHOW CREATE TRIGGER against
-- clinic-system-db) on 2026-08-01, replacing the previous hand-maintained
-- schema.sql + database/migrations/*.sql history (36 incremental files).
-- That history is preserved in git log for anyone who needs to see how a
-- specific column/constraint came to be — this file only reflects the
-- current, final state, so local setup and AWS never diverge from what's
-- actually running.
--
-- Usage:
--   Fresh local DB:  npm run db:schema   (then npm run db:seed for fixture data)
--   Docker Compose:  auto-applied via docker-entrypoint-initdb.d on first run
--   AWS/production:  already applied — this file is not re-run against it,
--                     it exists purely as documentation + local/dev parity.
--   Future changes:  add a new dated file under database/migrations/ again
--                     (the folder is recreated on the next schema change),
--                     apply it to AWS via `prisma db execute`, and fold the
--                     result back into this file once verified.

CREATE DATABASE IF NOT EXISTS clinic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clinic;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- I. AUTHENTICATION & USER MODULE
-- =============================================================

CREATE TABLE `users` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_card` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `failed_login_count` smallint NOT NULL DEFAULT '0',
  `locked_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  UNIQUE KEY `uq_users_id_card` (`id_card`),
  KEY `idx_users_role` (`role`),
  KEY `fk_users_created_by` (`created_by`),
  KEY `fk_users_updated_by` (`updated_by`),
  KEY `fk_users_specialty` (`specialty_id`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_users_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `fk_users_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_users_role` CHECK ((`role` in (_utf8mb4'ADMIN',_utf8mb4'RECEPTIONIST',_utf8mb4'DOCTOR',_utf8mb4'NURSE',_utf8mb4'LAB_TECH',_utf8mb4'PATIENT')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `refresh_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `device_info` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `replaced_by_token_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_refresh_token_hash` (`token_hash`),
  KEY `idx_refresh_tokens_user` (`user_id`),
  CONSTRAINT `fk_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `otp_tokens` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_code` char(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_user_purpose` (`user_id`,`purpose`),
  CONSTRAINT `fk_otp_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_otp_purpose` CHECK ((`purpose` in (_utf8mb4'FORGOT_PASSWORD',_utf8mb4'VERIFY_PHONE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- II. PATIENT MODULE
-- =============================================================

CREATE TABLE `patients` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `patient_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date NOT NULL,
  `gender` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_card` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `note` text COLLATE utf8mb4_unicode_ci,
  `notification_consent` tinyint(1) NOT NULL DEFAULT '0',
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_patients_code` (`patient_code`),
  UNIQUE KEY `uq_patients_phone` (`phone`),
  KEY `idx_patients_full_name` (`full_name`),
  KEY `patients_email_idx` (`email`),
  KEY `fk_patients_user` (`user_id`),
  KEY `fk_patients_created_by` (`created_by`),
  KEY `fk_patients_updated_by` (`updated_by`),
  CONSTRAINT `fk_patients_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_patients_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_patients_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_patients_gender` CHECK ((`gender` in (_utf8mb4'MALE',_utf8mb4'FEMALE',_utf8mb4'OTHER')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `medical_records` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medical_history` text COLLATE utf8mb4_unicode_ci,
  `clinical_note` text COLLATE utf8mb4_unicode_ci,
  `diagnosis_summary` text COLLATE utf8mb4_unicode_ci,
  `treatment_summary` text COLLATE utf8mb4_unicode_ci,
  `follow_up_note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_medical_records_patient` (`patient_id`),
  KEY `idx_medical_records_updated_at` (`updated_at`),
  KEY `fk_medical_records_created_by` (`created_by`),
  KEY `fk_medical_records_updated_by` (`updated_by`),
  CONSTRAINT `fk_medical_records_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_medical_records_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_medical_records_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patient_allergies` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `allergen` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_allergies_patient` (`patient_id`),
  KEY `fk_allergies_created_by` (`created_by`),
  CONSTRAINT `fk_allergies_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_allergies_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_allergy_severity` CHECK ((`severity` in (_utf8mb4'MILD',_utf8mb4'MODERATE',_utf8mb4'SEVERE')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `patient_change_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_value` text COLLATE utf8mb4_unicode_ci,
  `new_value` text COLLATE utf8mb4_unicode_ci,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_patient_chglogs_patient` (`patient_id`),
  KEY `idx_patient_chglogs_date` (`changed_at`),
  KEY `fk_chglogs_changed_by` (`changed_by`),
  CONSTRAINT `fk_chglogs_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_chglogs_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- III. ROOM MODULE
-- =============================================================

CREATE TABLE `rooms` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `room_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `technique_type` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cls_category` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rooms_code` (`room_code`),
  KEY `idx_rooms_type` (`type`),
  KEY `idx_rooms_active` (`is_active`),
  KEY `fk_rooms_created_by` (`created_by`),
  KEY `fk_rooms_updated_by` (`updated_by`),
  KEY `fk_rooms_specialty` (`specialty_id`),
  CONSTRAINT `fk_rooms_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_rooms_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `fk_rooms_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_rooms_cls_category` CHECK (((`cls_category` is null) or (`cls_category` in (_utf8mb4'LAB',_utf8mb4'XRAY',_utf8mb4'ULTRASOUND',_utf8mb4'ECG')))),
  CONSTRAINT `chk_rooms_type` CHECK ((`type` in (_utf8mb4'EXAMINATION',_utf8mb4'CLS',_utf8mb4'ADMIN')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- IV. SERVICE MODULE
-- =============================================================

CREATE TABLE `services` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `service_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `type` enum('EXAMINATION','CLS') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EXAMINATION',
  `cls_category` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(15,2) NOT NULL,
  `quantity` int NOT NULL DEFAULT '0',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_services_name` (`name`),
  UNIQUE KEY `services_service_code_key` (`service_code`),
  KEY `services_specialty_id_idx` (`specialty_id`),
  KEY `fk_services_created_by` (`created_by`),
  KEY `fk_services_updated_by` (`updated_by`),
  CONSTRAINT `fk_services_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_services_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `services_specialty_id_fk` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `chk_services_cls_category` CHECK (((`cls_category` is null) or (`cls_category` in (_utf8mb4'LAB',_utf8mb4'XRAY',_utf8mb4'ULTRASOUND',_utf8mb4'ECG')))),
  CONSTRAINT `chk_services_price` CHECK ((`price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- V. DOCTOR MODULE
-- =============================================================

CREATE TABLE `specialties` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_specialties_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctor_profiles` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subspecialty` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `degree` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certification` text COLLATE utf8mb4_unicode_ci,
  `years_experience` smallint DEFAULT NULL,
  `biography` text COLLATE utf8mb4_unicode_ci,
  `avatar_url` text COLLATE utf8mb4_unicode_ci,
  `approval_status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'APPROVED',
  `approved_at` datetime DEFAULT NULL,
  `approved_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rejected_at` datetime DEFAULT NULL,
  `rejected_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doctor_profiles_user` (`user_id`),
  KEY `idx_doctor_profiles_specialty` (`specialty_id`),
  KEY `idx_doctor_profiles_approval` (`approval_status`),
  KEY `fk_doctor_profiles_updated_by` (`updated_by`),
  CONSTRAINT `fk_doctor_profiles_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `fk_doctor_profiles_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_doctor_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_doctor_experience` CHECK ((`years_experience` >= 0)),
  CONSTRAINT `chk_doctor_profile_approval` CHECK ((`approval_status` in (_utf8mb4'PENDING_APPROVAL',_utf8mb4'APPROVED',_utf8mb4'REJECTED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctor_profile_pending_updates` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `doctor_profile_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `specialty_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subspecialty` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `degree` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `certification` text COLLATE utf8mb4_unicode_ci,
  `certification_file_urls` text COLLATE utf8mb4_unicode_ci,
  `years_experience` smallint DEFAULT NULL,
  `biography` text COLLATE utf8mb4_unicode_ci,
  `avatar_url` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_APPROVAL',
  `submitted_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doctor_pending_profile` (`doctor_profile_id`),
  KEY `idx_doctor_pending_status` (`status`),
  KEY `idx_doctor_pending_submitted_by` (`submitted_by`),
  KEY `fk_doctor_pending_specialty` (`specialty_id`),
  KEY `fk_doctor_pending_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_doctor_pending_profile` FOREIGN KEY (`doctor_profile_id`) REFERENCES `doctor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doctor_pending_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_doctor_pending_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `fk_doctor_pending_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_doctor_pending_experience` CHECK ((`years_experience` >= 0)),
  CONSTRAINT `chk_doctor_pending_status` CHECK ((`status` in (_utf8mb4'PENDING_APPROVAL',_utf8mb4'APPROVED',_utf8mb4'REJECTED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `doctor_certification_files` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `doctor_profile_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_doctor_cert_files_profile` (`doctor_profile_id`),
  KEY `fk_doctor_cert_files_user` (`uploaded_by`),
  CONSTRAINT `fk_doctor_cert_files_profile` FOREIGN KEY (`doctor_profile_id`) REFERENCES `doctor_profiles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doctor_cert_files_user` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- VI. SCHEDULE MODULE
-- =============================================================

CREATE TABLE `work_schedules` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `room_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `work_date` date NOT NULL,
  `shift` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_absent` tinyint(1) NOT NULL DEFAULT 0,
  `absent_note` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `original_user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schedule_user_date_shift` (`user_id`,`work_date`,`shift`),
  UNIQUE KEY `uq_schedule_room_date_shift` (`room_id`,`work_date`,`shift`),
  KEY `idx_schedule_user_date` (`user_id`,`work_date`),
  KEY `idx_schedule_date` (`work_date`),
  KEY `idx_schedule_room` (`room_id`,`work_date`),
  KEY `fk_schedules_created_by` (`created_by`),
  KEY `fk_schedules_updated_by` (`updated_by`),
  CONSTRAINT `fk_schedules_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_schedules_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `fk_schedules_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_schedules_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_schedule_shift` CHECK ((`shift` in (_utf8mb4'MORNING',_utf8mb4'AFTERNOON',_utf8mb4'FULL_DAY')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- VII. APPOINTMENT MODULE
-- =============================================================

CREATE TABLE `appointments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doctor_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `service_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `room_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `schedule_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `appointment_time` datetime NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `note` text COLLATE utf8mb4_unicode_ci,
  `cancel_reason` text COLLATE utf8mb4_unicode_ci,
  `cancelled_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `checked_in_at` datetime DEFAULT NULL,
  `booked_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_appt_patient` (`patient_id`),
  KEY `idx_appt_doctor_date` (`doctor_id`,`appointment_time`),
  KEY `idx_appt_status` (`status`),
  KEY `idx_appt_date` (`appointment_time`),
  KEY `idx_appt_schedule` (`schedule_id`),
  KEY `fk_appt_service` (`service_id`),
  KEY `fk_appt_room` (`room_id`),
  KEY `fk_appt_cancelled_by` (`cancelled_by`),
  KEY `fk_appt_booked_by` (`booked_by`),
  CONSTRAINT `fk_appt_booked_by` FOREIGN KEY (`booked_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appt_cancelled_by` FOREIGN KEY (`cancelled_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appt_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `fk_appt_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `fk_appt_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `work_schedules` (`id`),
  CONSTRAINT `fk_appt_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  CONSTRAINT `chk_appt_cancel` CHECK (((`status` <> _utf8mb4'CANCELLED') or (`cancel_reason` is not null))),
  CONSTRAINT `chk_appt_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'CONFIRMED',_utf8mb4'CHECKED_IN',_utf8mb4'IN_PROGRESS',_utf8mb4'COMPLETED',_utf8mb4'CANCELLED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointment_history` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `appointment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_time` datetime DEFAULT NULL,
  `new_time` datetime DEFAULT NULL,
  `old_doctor_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_doctor_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `changed_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appt_history_appointment` (`appointment_id`),
  KEY `fk_appt_history_old_doctor` (`old_doctor_id`),
  KEY `fk_appt_history_new_doctor` (`new_doctor_id`),
  KEY `fk_appt_history_changed_by` (`changed_by`),
  CONSTRAINT `fk_appt_history_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `fk_appt_history_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appt_history_new_doctor` FOREIGN KEY (`new_doctor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_appt_history_old_doctor` FOREIGN KEY (`old_doctor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- VIII. VISIT & CLINICAL MODULE
-- =============================================================

CREATE TABLE `visits` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `appointment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `doctor_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `room_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue_number` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'WAITING',
  `called_at` datetime DEFAULT NULL,
  `called_count` int NOT NULL DEFAULT '0',
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_visits_appointment` (`appointment_id`),
  KEY `idx_visits_doctor_date` (`doctor_id`,`created_at`),
  KEY `idx_visits_patient` (`patient_id`),
  KEY `idx_visits_status` (`status`),
  KEY `idx_visits_room` (`room_id`),
  CONSTRAINT `fk_visits_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `fk_visits_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_visits_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `fk_visits_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `chk_visits_priority` CHECK ((`priority` in (_utf8mb4'NORMAL',_utf8mb4'ELDERLY',_utf8mb4'PREGNANT',_utf8mb4'CHILD',_utf8mb4'EMERGENCY'))),
  CONSTRAINT `chk_visits_status` CHECK ((`status` in (_utf8mb4'WAITING',_utf8mb4'CALLED',_utf8mb4'IN_PROGRESS',_utf8mb4'AWAITING_RESULTS',_utf8mb4'COMPLETED',_utf8mb4'NO_SHOW',_utf8mb4'CANCELLED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vital_signs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `visit_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `systolic_bp` int DEFAULT NULL,
  `diastolic_bp` int DEFAULT NULL,
  `heart_rate` int DEFAULT NULL,
  `temperature` decimal(4,1) DEFAULT NULL,
  `spo2` int DEFAULT NULL,
  `weight` decimal(5,1) DEFAULT NULL,
  `height` decimal(5,1) DEFAULT NULL,
  `recorded_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `recorded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `vital_signs_visit_id_key` (`visit_id`),
  CONSTRAINT `vital_signs_visit_id_fkey` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `examination_results` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `visit_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `diagnosis` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `clinical_note` text COLLATE utf8mb4_unicode_ci,
  `treatment_result` text COLLATE utf8mb4_unicode_ci,
  `follow_up_date` date DEFAULT NULL,
  `access_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `access_code_expires_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exam_result_visit` (`visit_id`),
  UNIQUE KEY `uq_exam_result_access_code` (`access_code`),
  KEY `idx_exam_result_followup` (`follow_up_date`),
  KEY `fk_exam_result_created_by` (`created_by`),
  KEY `fk_exam_result_updated_by` (`updated_by`),
  CONSTRAINT `fk_exam_result_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exam_result_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_exam_result_visit` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cls_orders` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `visit_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cls_room_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `called_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cls_orders_visit` (`visit_id`),
  KEY `idx_cls_orders_room` (`cls_room_id`),
  KEY `idx_cls_orders_status` (`status`),
  KEY `fk_cls_orders_service` (`service_id`),
  KEY `fk_cls_orders_created_by` (`created_by`),
  CONSTRAINT `fk_cls_orders_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cls_orders_room` FOREIGN KEY (`cls_room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `fk_cls_orders_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`),
  CONSTRAINT `fk_cls_orders_visit` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`),
  CONSTRAINT `chk_cls_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'IN_PROGRESS',_utf8mb4'COMPLETED',_utf8mb4'CANCELLED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cls_results` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `cls_order_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result_data` json NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cls_results_order` (`cls_order_id`),
  KEY `fk_cls_results_created_by` (`created_by`),
  KEY `fk_cls_results_updated_by` (`updated_by`),
  CONSTRAINT `fk_cls_results_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_cls_results_order` FOREIGN KEY (`cls_order_id`) REFERENCES `cls_orders` (`id`),
  CONSTRAINT `fk_cls_results_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cls_attachments` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `cls_result_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_type` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size_kb` int DEFAULT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `uploaded_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cls_attachments_result` (`cls_result_id`),
  KEY `fk_cls_attachments_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_cls_attachments_result` FOREIGN KEY (`cls_result_id`) REFERENCES `cls_results` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cls_attachments_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_cls_file_size_kb` CHECK ((`file_size_kb` > 0)),
  CONSTRAINT `chk_cls_file_type` CHECK ((`file_type` in (_utf8mb4'PDF',_utf8mb4'JPG',_utf8mb4'PNG',_utf8mb4'DICOM')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- IX. PRESCRIPTION MODULE
-- =============================================================

CREATE TABLE `medicines` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `active_ingredient` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosage_form` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` decimal(15,2) DEFAULT NULL,
  `contraindications` text COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_medicines_name` (`name`),
  KEY `idx_medicines_name` (`name`),
  KEY `idx_medicines_ingredient` (`active_ingredient`),
  KEY `fk_medicines_created_by` (`created_by`),
  KEY `fk_medicines_updated_by` (`updated_by`),
  CONSTRAINT `fk_medicines_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_medicines_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_medicines_price` CHECK ((`price` >= 0)),
  CONSTRAINT `chk_medicines_unit` CHECK ((`unit` in (_utf8mb4'VIEN',_utf8mb4'VI',_utf8mb4'HOP',_utf8mb4'CHAI',_utf8mb4'ONG',_utf8mb4'GOI',_utf8mb4'TUYP',_utf8mb4'LO',_utf8mb4'CAI',_utf8mb4'BO',_utf8mb4'KHAC')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescriptions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `visit_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prescriptions_visit` (`visit_id`),
  KEY `fk_prescriptions_created_by` (`created_by`),
  CONSTRAINT `fk_prescriptions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_prescriptions_visit` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescription_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `prescription_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medicine_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dosage` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `frequency` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `duration_days` smallint NOT NULL,
  `instruction` text COLLATE utf8mb4_unicode_ci,
  `allergy_warning` tinyint(1) NOT NULL DEFAULT '0',
  `interaction_warning` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` smallint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_rx_items_prescription` (`prescription_id`),
  KEY `idx_rx_items_medicine` (`medicine_id`),
  CONSTRAINT `fk_rx_items_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`),
  CONSTRAINT `fk_rx_items_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_rx_duration` CHECK ((`duration_days` > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- X. INVOICE MODULE
-- =============================================================

CREATE TABLE `invoices` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `appointment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `patient_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total` decimal(15,2) NOT NULL,
  `amount_due` decimal(15,2) NOT NULL,
  `payment_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'UNPAID',
  `payment_method` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invoices_appointment` (`appointment_id`),
  UNIQUE KEY `uq_invoices_code` (`invoice_code`),
  KEY `idx_invoices_patient` (`patient_id`),
  KEY `idx_invoices_status` (`payment_status`),
  KEY `idx_invoices_date` (`created_at`),
  KEY `fk_invoices_created_by` (`created_by`),
  CONSTRAINT `fk_invoices_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `fk_invoices_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_invoices_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`),
  CONSTRAINT `chk_invoices_amount_due` CHECK ((`amount_due` >= 0)),
  -- chk_invoices_amount_due_calc (amount_due = total) dropped 2026-08-19,
  -- migration 20260819130000_split_invoice_payment_by_stage — version-up
  -- 0.2 item #10 lets amount_due sit below total while PARTIALLY_PAID.
  CONSTRAINT `chk_invoices_discount` CHECK ((`discount` >= 0)),
  CONSTRAINT `chk_invoices_paid_method` CHECK (((`payment_status` <> _utf8mb4'PAID') or (`payment_method` is not null))),
  CONSTRAINT `chk_invoices_payment_method` CHECK ((`payment_method` in (_utf8mb4'CASH',_utf8mb4'CARD',_utf8mb4'TRANSFER'))),
  CONSTRAINT `chk_invoices_payment_status` CHECK ((`payment_status` in (_utf8mb4'UNPAID',_utf8mb4'PARTIALLY_PAID',_utf8mb4'PAID',_utf8mb4'CANCELLED'))),
  CONSTRAINT `chk_invoices_subtotal` CHECK ((`subtotal` >= 0)),
  CONSTRAINT `chk_invoices_total` CHECK ((`total` >= 0)),
  CONSTRAINT `chk_invoices_total_calc` CHECK ((`total` = (`subtotal` - `discount`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `invoice_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `service_ref_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cls_ref_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `medicine_ref_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `quantity` smallint NOT NULL DEFAULT '1',
  `amount` decimal(15,2) NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_inv_items_invoice` (`invoice_id`),
  KEY `fk_inv_items_service` (`service_ref_id`),
  KEY `fk_inv_items_cls` (`cls_ref_id`),
  KEY `fk_inv_items_rx` (`medicine_ref_id`),
  CONSTRAINT `fk_inv_items_cls` FOREIGN KEY (`cls_ref_id`) REFERENCES `cls_orders` (`id`),
  CONSTRAINT `fk_inv_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_items_rx` FOREIGN KEY (`medicine_ref_id`) REFERENCES `prescription_items` (`id`),
  CONSTRAINT `fk_inv_items_service` FOREIGN KEY (`service_ref_id`) REFERENCES `services` (`id`),
  CONSTRAINT `chk_inv_item_amount` CHECK ((`amount` >= 0)),
  CONSTRAINT `chk_inv_item_amount_calc` CHECK ((`amount` = (`unit_price` * `quantity`))),
  CONSTRAINT `chk_inv_item_quantity` CHECK ((`quantity` > 0)),
  CONSTRAINT `chk_inv_item_type` CHECK ((`item_type` in (_utf8mb4'SERVICE',_utf8mb4'CLS',_utf8mb4'MEDICINE'))),
  CONSTRAINT `chk_inv_item_unit_price` CHECK ((`unit_price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Version-up 0.2 item #10 (migration 20260819130000): one row per "collect
-- now" round a receptionist performs — an Invoice can now be paid in
-- several stages (exam fee, then CLS fee(s), then medicine) instead of
-- all at once.
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

-- Join table: which invoice_items rows a given invoice_payments round
-- covered (used later for per-stage receipt printing).
CREATE TABLE `invoice_payment_items` (
  `invoice_payment_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `invoice_item_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`invoice_payment_id`,`invoice_item_id`),
  KEY `fk_invoice_payment_items_item` (`invoice_item_id`),
  CONSTRAINT `fk_invoice_payment_items_payment` FOREIGN KEY (`invoice_payment_id`) REFERENCES `invoice_payments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_invoice_payment_items_item` FOREIGN KEY (`invoice_item_id`) REFERENCES `invoice_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XI. MEDICINE MODULE
-- =============================================================

CREATE TABLE `medicine_interactions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `medicine_a_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `medicine_b_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `severity` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_interactions_medicine_a` (`medicine_a_id`),
  KEY `fk_interactions_medicine_b` (`medicine_b_id`),
  KEY `fk_interactions_created_by` (`created_by`),
  CONSTRAINT `fk_interactions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_interactions_medicine_a` FOREIGN KEY (`medicine_a_id`) REFERENCES `medicines` (`id`),
  CONSTRAINT `fk_interactions_medicine_b` FOREIGN KEY (`medicine_b_id`) REFERENCES `medicines` (`id`),
  CONSTRAINT `chk_interaction_severity` CHECK ((`severity` in (_utf8mb4'MILD',_utf8mb4'MODERATE',_utf8mb4'SEVERE'))),
  CONSTRAINT `chk_no_self_interaction` CHECK ((`medicine_a_id` <> `medicine_b_id`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XII. SUPPLY MODULE
-- =============================================================

CREATE TABLE `supply_categories` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supply_categories_name` (`name`),
  KEY `fk_supply_cat_created_by` (`created_by`),
  KEY `fk_supply_cat_updated_by` (`updated_by`),
  CONSTRAINT `fk_supply_cat_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_supply_cat_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suppliers` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_suppliers_name` (`name`),
  KEY `fk_suppliers_created_by` (`created_by`),
  KEY `fk_suppliers_updated_by` (`updated_by`),
  CONSTRAINT `fk_suppliers_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_suppliers_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supplies` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `category_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `current_stock` int NOT NULL DEFAULT '0',
  `min_stock_level` int NOT NULL DEFAULT '0',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_by` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_supply_name_category` (`name`,`category_id`),
  KEY `idx_supplies_category` (`category_id`),
  KEY `idx_supplies_low_stock` (`current_stock`),
  KEY `fk_supplies_created_by` (`created_by`),
  KEY `fk_supplies_updated_by` (`updated_by`),
  CONSTRAINT `fk_supplies_category` FOREIGN KEY (`category_id`) REFERENCES `supply_categories` (`id`),
  CONSTRAINT `fk_supplies_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_supplies_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_supplies_min_stock` CHECK ((`min_stock_level` >= 0)),
  CONSTRAINT `chk_supplies_stock` CHECK ((`current_stock` >= 0)),
  CONSTRAINT `chk_supplies_unit` CHECK ((`unit` in (_utf8mb4'VIEN',_utf8mb4'VI',_utf8mb4'HOP',_utf8mb4'CHAI',_utf8mb4'ONG',_utf8mb4'GOI',_utf8mb4'TUYP',_utf8mb4'LO',_utf8mb4'CAI',_utf8mb4'BO',_utf8mb4'KHAC')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supply_imports` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `supplier_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `import_date` date NOT NULL DEFAULT (curdate()),
  `total_value` decimal(15,2) DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_supply_imports_supplier` (`supplier_id`),
  KEY `fk_supply_imports_created_by` (`created_by`),
  CONSTRAINT `fk_supply_imports_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_supply_imports_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supply_import_items` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `import_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `supply_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(15,2) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_import_items_supply` (`supply_id`),
  KEY `fk_import_items_import` (`import_id`),
  CONSTRAINT `fk_import_items_import` FOREIGN KEY (`import_id`) REFERENCES `supply_imports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_import_items_supply` FOREIGN KEY (`supply_id`) REFERENCES `supplies` (`id`),
  CONSTRAINT `chk_import_items_qty` CHECK ((`quantity` > 0)),
  CONSTRAINT `chk_import_items_unit_price` CHECK ((`unit_price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `supply_transactions` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `supply_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int NOT NULL,
  `import_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `room_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_supply_tx_supply` (`supply_id`),
  KEY `idx_supply_tx_type` (`transaction_type`),
  KEY `idx_supply_tx_date` (`created_at`),
  KEY `fk_supply_tx_import` (`import_id`),
  KEY `fk_supply_tx_room` (`room_id`),
  KEY `fk_supply_tx_created_by` (`created_by`),
  CONSTRAINT `fk_supply_tx_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_supply_tx_import` FOREIGN KEY (`import_id`) REFERENCES `supply_imports` (`id`),
  CONSTRAINT `fk_supply_tx_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  CONSTRAINT `fk_supply_tx_supply` FOREIGN KEY (`supply_id`) REFERENCES `supplies` (`id`),
  CONSTRAINT `chk_supply_tx_type` CHECK ((`transaction_type` in (_utf8mb4'IMPORT',_utf8mb4'DISTRIBUTE',_utf8mb4'RETURN')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XIII. NOTIFICATION MODULE
-- =============================================================

CREATE TABLE `notification_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `channel` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `sent_at` datetime DEFAULT NULL,
  `error_msg` text COLLATE utf8mb4_unicode_ci,
  `retry_count` smallint NOT NULL DEFAULT '0',
  `ref_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`),
  KEY `idx_notif_status` (`status`),
  KEY `idx_notif_type` (`type`),
  KEY `idx_notif_date` (`created_at`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_notif_channel` CHECK ((`channel` in (_utf8mb4'EMAIL',_utf8mb4'SMS',_utf8mb4'PUSH'))),
  CONSTRAINT `chk_notif_status` CHECK ((`status` in (_utf8mb4'PENDING',_utf8mb4'SENT',_utf8mb4'FAILED')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XIV. MESSAGE MODULE
-- =============================================================

CREATE TABLE `app_messages` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `message_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `locale` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'vi',
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_messages_code_locale` (`message_code`,`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XV. AUDIT & LOG MODULE
-- =============================================================

CREATE TABLE `system_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `module` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `detail` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_syslog_user` (`user_id`),
  KEY `idx_syslog_created` (`created_at`),
  KEY `idx_syslog_module` (`module`),
  KEY `idx_syslog_action` (`action`),
  CONSTRAINT `fk_syslog_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XVI. AI MODULE
-- =============================================================

CREATE TABLE `ai_chat_logs` (
  `id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `user_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `session_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `suggested_specialty_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_chat_user` (`user_id`),
  KEY `idx_ai_chat_session` (`session_id`),
  KEY `idx_ai_chat_created` (`created_at`),
  KEY `fk_ai_chat_specialty` (`suggested_specialty_id`),
  CONSTRAINT `fk_ai_chat_specialty` FOREIGN KEY (`suggested_specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `fk_ai_chat_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_ai_chat_role` CHECK ((`role` in (_utf8mb4'USER',_utf8mb4'ASSISTANT')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- XVII. TRIGGERS
-- =============================================================

DELIMITER $$

CREATE TRIGGER `trg_supply_stock_update` AFTER INSERT ON `supply_transactions` FOR EACH ROW BEGIN
    UPDATE supplies
    SET current_stock = current_stock + NEW.quantity,
        updated_at    = NOW()
    WHERE id = NEW.supply_id;
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
