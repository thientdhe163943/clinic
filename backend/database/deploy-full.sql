-- =====================================================================
-- !!! CẢNH BÁO — FILE GHI ĐÈ TOÀN BỘ DATABASE !!!
-- =====================================================================
-- File này gộp nguyên văn schema.sql + seed.sql thành 1 bản để chạy 1 lần.
--
-- CHỈ được chạy file này khi RDS là một database HOÀN TOÀN TRỐNG/MỚI TẠO.
-- KHÔNG được chạy lên một RDS đã có dữ liệu thật (bệnh nhân/lịch hẹn/hóa
-- đơn thật) — hậu quả nếu chạy nhầm:
--   - Nếu các bảng đã tồn tại: CREATE TABLE sẽ lỗi ngay (dừng giữa chừng,
--     có thể để lại DB ở trạng thái nửa vời).
--   - Nếu chỉ lỗi phần CREATE TABLE bị bỏ qua rồi chạy tiếp INSERT: hàng
--     loạt dữ liệu DEMO/GIẢ (bệnh nhân "Nguyễn Văn An", lịch hẹn mẫu...)
--     sẽ bị chèn lẫn vào dữ liệu thật.
--
-- Theo đúng quy ước gốc của 2 file nguồn (xem comment đầu mỗi phần bên
-- dưới): schema.sql ghi rõ "AWS/production: already applied — this file
-- is not re-run against it"; seed.sql ghi rõ "Never applied to
-- AWS/production — that database already has its own real data". File
-- gộp này được tạo theo yêu cầu riêng, đi ngược lại 2 cảnh báo đó — người
-- chạy file này tự chịu trách nhiệm xác nhận RDS đang trống trước khi chạy.
--
-- Nội dung: PHẦN 1 = database/schema.sql (cấu trúc bảng, trigger, constraint)
--           PHẦN 2 = database/seed.sql (dữ liệu mẫu: user/patient/appointment demo)
-- Sinh tự động bằng cách nối 2 file gốc, không chỉnh sửa nội dung bên trong.
-- =====================================================================

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
-- =============================================================
-- Clinic Management System — synthetic fixture data for LOCAL DEV ONLY.
-- Never applied to AWS/production — that database already has its own real
-- data, seeded separately (see database/migrations/ history in git log for
-- how it got there before this consolidation).
-- Password hash: bcrypt của "Password@123"
--
-- Deliberately has no `USE <db>` statement — both real invocation paths
-- already select the target database themselves (docker-entrypoint-initdb.d
-- via MYSQL_DATABASE, `npm run db:seed` via the `mysql ... clinic <` CLI
-- arg), so hardcoding one here would silently redirect anyone testing this
-- file against a differently-named database back to `clinic`.
-- =============================================================

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================
-- app_messages (seed trước, không có FK)
-- Mỗi message_code có 2 bản dịch: vi (mặc định) và en
-- =============================================================
INSERT INTO app_messages (id, message_code, locale, message) VALUES
-- INFO
('am000001-0000-0000-0000-000000000001', 'MSG_INFO_0001', 'vi', 'Đăng nhập thành công.'),
('am000001-0000-0000-0000-000000000002', 'MSG_INFO_0002', 'vi', 'Lịch hẹn đã được xác nhận.'),
('am000001-0000-0000-0000-000000000004', 'MSG_INFO_0004', 'vi', 'Đặt lịch hẹn thành công.'),
('am000001-0000-0000-0000-000000000005', 'MSG_INFO_0005', 'vi', 'Hồ sơ bệnh nhân đã được cập nhật.'),
('am000001-0000-0000-0000-000000000006', 'MSG_INFO_0006', 'vi', 'Đã ghi nhận thanh toán.'),
('am000001-0000-0000-0000-000000000007', 'MSG_INFO_0007', 'vi', 'Tài khoản đã được tạo thành công.'),
('am000001-0000-0000-0000-000000000008', 'MSG_INFO_0008', 'vi', 'Mật khẩu đã được thay đổi thành công.'),
-- WARN
('am000001-0000-0000-0000-000000000058', 'MSG_INFO_0009', 'vi', 'Đăng xuất thành công.'),
-- ERR (nghiệp vụ)
('am000001-0000-0000-0000-000000000014', 'MSG_ERR_0002',  'vi', 'Tài khoản đã bị khóa do đăng nhập sai quá 5 lần.'),
('am000001-0000-0000-0000-000000000017', 'MSG_ERR_0005',  'vi', 'Mã OTP không hợp lệ hoặc đã hết hạn.'),
-- ERR (common — dùng bởi GlobalExceptionFilter cho lỗi chung)
('am000001-0000-0000-0000-000000000035', 'MSG_ERR_0006',  'vi', 'Dữ liệu nhập không hợp lệ. Vui lòng kiểm tra lại thông tin đã nhập.'),
('am000001-0000-0000-0000-000000000036', 'MSG_ERR_0007',  'vi', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'),
('am000001-0000-0000-0000-000000000037', 'MSG_ERR_0008',  'vi', 'Bạn không có quyền thực hiện hành động này.'),
('am000001-0000-0000-0000-000000000038', 'MSG_ERR_0009',  'vi', 'Không tìm thấy {resource}.'),
('am000001-0000-0000-0000-000000000039', 'MSG_ERR_0010',  'vi', '{resource} đã tồn tại hoặc bị xung đột.'),
('am000001-0000-0000-0000-000000000040', 'MSG_ERR_0011',  'vi', 'Lỗi hệ thống. Vui lòng thử lại sau.'),
('am000001-0000-0000-0000-000000000041', 'MSG_ERR_0012',  'vi', 'Email hoặc mật khẩu không đúng.'),
('am000001-0000-0000-0000-000000000049', 'MSG_ERR_0013',  'vi', 'Mật khẩu mới phải có tối thiểu 8 ký tự, gồm chữ và số.'),
('am000001-0000-0000-0000-000000000050', 'MSG_ERR_0014',  'vi', 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.'),
('am000001-0000-0000-0000-000000000051', 'MSG_ERR_0015',  'vi', 'Mật khẩu mới không được trùng với mật khẩu cũ.'),

-- =============================================================
-- app_messages — phần mở rộng (121 mã mới: MSG_INFO_0010-0079,
-- MSG_WARN_0005-0014, MSG_ERR_0017-0055), theo docs/system_messages.md
-- =============================================================
('am000002-0000-0000-0000-000000000001', 'MSG_INFO_0010', 'vi', 'Mã OTP đã được gửi đến {email}. Mã có hiệu lực trong 10 phút.'),
('am000002-0000-0000-0000-000000000002', 'MSG_INFO_0011', 'vi', 'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.'),
('am000002-0000-0000-0000-000000000003', 'MSG_INFO_0012', 'vi', 'Hồ sơ cá nhân đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000004', 'MSG_INFO_0013', 'vi', 'Cập nhật tài khoản thành công.'),
('am000002-0000-0000-0000-000000000005', 'MSG_INFO_0014', 'vi', 'Đã kích hoạt tài khoản {full_name}.'),
('am000002-0000-0000-0000-000000000006', 'MSG_INFO_0015', 'vi', 'Đã vô hiệu hóa tài khoản {full_name}.'),
('am000002-0000-0000-0000-000000000007', 'MSG_INFO_0016', 'vi', 'Đã mở khóa tài khoản {full_name}.'),
('am000002-0000-0000-0000-000000000008', 'MSG_INFO_0017', 'vi', 'Đặt lại mật khẩu thành công. Người dùng cần đổi mật khẩu khi đăng nhập lần tới.'),
('am000002-0000-0000-0000-000000000009', 'MSG_INFO_0018', 'vi', 'Hồ sơ bệnh nhân đã được tạo thành công. Mã hồ sơ: {patient_code}.'),
('am000002-0000-0000-0000-000000000012', 'MSG_INFO_0021', 'vi', 'Phòng {room_code} đã được tạo thành công.'),
('am000002-0000-0000-0000-000000000013', 'MSG_INFO_0022', 'vi', 'Thông tin phòng đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000014', 'MSG_INFO_0023', 'vi', 'Phòng {room_code} đã được kích hoạt.'),
('am000002-0000-0000-0000-000000000015', 'MSG_INFO_0024', 'vi', 'Phòng {room_code} đã được vô hiệu hóa.'),
('am000002-0000-0000-0000-000000000016', 'MSG_INFO_0025', 'vi', 'Dịch vụ đã được thêm thành công.'),
('am000002-0000-0000-0000-000000000017', 'MSG_INFO_0026', 'vi', 'Dịch vụ đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000018', 'MSG_INFO_0027', 'vi', 'Dịch vụ đã được xóa thành công.'),
('am000002-0000-0000-0000-000000000021', 'MSG_INFO_0030', 'vi', 'Hồ sơ chuyên môn bác sĩ đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000022', 'MSG_INFO_0031', 'vi', 'Lịch làm việc đã được tạo thành công.'),
('am000002-0000-0000-0000-000000000023', 'MSG_INFO_0032', 'vi', 'Lịch làm việc đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000024', 'MSG_INFO_0033', 'vi', 'Lịch làm việc đã được xóa.'),
('am000002-0000-0000-0000-000000000025', 'MSG_INFO_0034', 'vi', 'Lịch hẹn đã được tạo và xác nhận thành công.'),
('am000002-0000-0000-0000-000000000026', 'MSG_INFO_0035', 'vi', 'Đã từ chối lịch hẹn. Thông báo đã gửi đến bệnh nhân.'),
('am000002-0000-0000-0000-000000000027', 'MSG_INFO_0036', 'vi', 'Lịch hẹn đã được cập nhật thành công.'),
('am000002-0000-0000-0000-000000000028', 'MSG_INFO_0037', 'vi', 'Lịch hẹn đã được hủy. Thông báo đã gửi đến bệnh nhân và bác sĩ.'),
('am000002-0000-0000-0000-000000000029', 'MSG_INFO_0038', 'vi', 'Check-in thành công. Vui lòng thu phí khám để bệnh nhân vào hàng chờ khám.'),
('am000002-0000-0000-0000-000000000035', 'MSG_INFO_0044', 'vi', 'Đã gọi bệnh nhân {patient_name} vào phòng {room_code}.'),
('am000002-0000-0000-0000-000000000036', 'MSG_INFO_0045', 'vi', 'Bắt đầu khám bệnh nhân {patient_name}.'),
('am000002-0000-0000-0000-000000000037', 'MSG_INFO_0046', 'vi', 'Đã hoàn thành khám bệnh nhân {patient_name}.'),
('am000002-0000-0000-0000-000000000038', 'MSG_INFO_0047', 'vi', 'Phiếu chỉ định CLS đã được tạo thành công.'),
('am000002-0000-0000-0000-000000000039', 'MSG_INFO_0048', 'vi', 'Đã gọi bệnh nhân vào phòng {room_code}.'),
('am000002-0000-0000-0000-000000000040', 'MSG_INFO_0049', 'vi', 'Kết quả CLS đã được cập nhật.'),
('am000002-0000-0000-0000-000000000042', 'MSG_INFO_0051', 'vi', 'File đính kèm đã được tải lên thành công.'),
('am000002-0000-0000-0000-000000000043', 'MSG_INFO_0052', 'vi', 'Kết quả khám đã được lưu thành công.'),
('am000002-0000-0000-0000-000000000044', 'MSG_INFO_0053', 'vi', 'Kết quả khám đã được cập nhật.'),
('am000002-0000-0000-0000-000000000046', 'MSG_INFO_0055', 'vi', 'Đơn thuốc đã được tạo và lưu thành công.'),
('am000002-0000-0000-0000-000000000051', 'MSG_INFO_0060', 'vi', 'Hóa đơn {invoice_code} đã được tạo thành công.'),
('am000002-0000-0000-0000-000000000054', 'MSG_INFO_0063', 'vi', 'Danh mục vật tư đã được tạo thành công.'),
('am000002-0000-0000-0000-000000000055', 'MSG_INFO_0064', 'vi', 'Danh mục vật tư đã được cập nhật.'),
('am000002-0000-0000-0000-000000000056', 'MSG_INFO_0065', 'vi', 'Danh mục vật tư đã được xóa.'),
('am000002-0000-0000-0000-000000000057', 'MSG_INFO_0066', 'vi', 'Nhà cung cấp đã được thêm thành công.'),
('am000002-0000-0000-0000-000000000058', 'MSG_INFO_0067', 'vi', 'Thông tin nhà cung cấp đã được cập nhật.'),
('am000002-0000-0000-0000-000000000059', 'MSG_INFO_0068', 'vi', 'Nhà cung cấp đã được xóa.'),
('am000002-0000-0000-0000-000000000060', 'MSG_INFO_0069', 'vi', 'Vật tư đã được thêm thành công.'),
('am000002-0000-0000-0000-000000000061', 'MSG_INFO_0070', 'vi', 'Thông tin vật tư đã được cập nhật.'),
('am000002-0000-0000-0000-000000000062', 'MSG_INFO_0071', 'vi', 'Nhập kho thành công. Tồn kho hiện tại: {current_stock} {unit}.'),
('am000002-0000-0000-0000-000000000063', 'MSG_INFO_0072', 'vi', 'Đã phân phối {quantity} {unit} {supply_name} cho phòng {room_code}.'),
('am000002-0000-0000-0000-000000000067', 'MSG_INFO_0076', 'vi', 'Thuốc đã được thêm vào danh mục thành công.'),
('am000002-0000-0000-0000-000000000068', 'MSG_INFO_0077', 'vi', 'Thông tin thuốc đã được cập nhật.'),
('am000002-0000-0000-0000-000000000069', 'MSG_INFO_0078', 'vi', 'Thuốc đã được xóa khỏi danh mục.'),
('am000003-0000-0000-0000-000000000001', 'MSG_INFO_0080', 'vi', 'Đã tạm rời phòng khám, chờ kết quả CLS cho bệnh nhân {patient_name}.'),
('am000003-0000-0000-0000-000000000002', 'MSG_INFO_0081', 'vi', 'Đã ghi nhận bệnh nhân {patient_name} vắng mặt.'),
('am000003-0000-0000-0000-000000000006', 'MSG_INFO_0083', 'vi', 'Đã đánh dấu thông báo là đã đọc.'),
('am000003-0000-0000-0000-000000000007', 'MSG_INFO_0084', 'vi', 'Đã đánh dấu tất cả thông báo là đã đọc.'),
('am000003-0000-0000-0000-000000000010', 'MSG_INFO_0087', 'vi', 'Đã tạo lịch làm việc hàng loạt.'),
('am000003-0000-0000-0000-000000000011', 'MSG_INFO_0088', 'vi', 'Đã cập nhật phiếu chỉ định CLS.'),
('am000003-0000-0000-0000-000000000012', 'MSG_INFO_0089', 'vi', 'Đã lưu chỉ số sinh hiệu.'),
('586ac785-edcc-41d9-ad51-d9bbe20eaae7', 'MSG_INFO_0090', 'vi', 'Chuyên khoa đã được tạo thành công.'),
('6b9ce439-448e-4f6d-995b-29a128fdd263', 'MSG_INFO_0091', 'vi', 'Chuyên khoa đã được cập nhật thành công.'),
('363f6931-fbe0-4f88-baa4-a90777a70baf', 'MSG_INFO_0092', 'vi', 'Chuyên khoa đã được xóa thành công.'),
('ca31c349-94f5-4fd9-a0cf-bfee1cfe4095', 'MSG_INFO_0093', 'vi', 'Phòng CLS đã được tạo thành công.'),
('6768f4d5-275c-4d93-a33a-770822acec2e', 'MSG_INFO_0094', 'vi', 'Phòng CLS đã được cập nhật thành công.'),
('9062df34-e7e1-4d10-bf59-909583d6b3ca', 'MSG_INFO_0095', 'vi', 'Phòng CLS đã được kích hoạt.'),
('14c20110-a283-436a-9057-8a99ae0264b0', 'MSG_INFO_0096', 'vi', 'Phòng CLS đã được vô hiệu hóa.'),
('7a1b2c3d-4e5f-4071-9701-000000000097', 'MSG_INFO_0097', 'vi', 'Mã OTP xác minh đặt lịch đã được gửi đến {email}. Mã có hiệu lực trong 5 phút.'),
('7a1b2c3d-4e5f-4071-9701-000000000098', 'MSG_INFO_0098', 'vi', 'Đã phân công bác sĩ thay thế cho ca vắng mặt.'),
('7a1b2c3d-4e5f-4071-9701-000000000099', 'MSG_INFO_0099', 'vi', 'Đã trích xuất dữ liệu từ ảnh (OCR). Vui lòng kiểm tra và chỉnh sửa trước khi lưu kết quả.'),
('7a1b2c3d-4e5f-4071-9701-000000000100', 'MSG_INFO_0100', 'vi', 'Xác nhận thanh toán thành công. Bệnh nhân đang vào hàng chờ khám.'),
('7a1b2c3d-4e5f-4071-9701-000000000101', 'MSG_INFO_0101', 'vi', 'Kết quả CLS đã được kết thúc và xác nhận.'),
('afd56fc4-3009-45f4-8e7c-f304489747eb', 'MSG_WARN_0001', 'vi', 'Vui lòng nhập đầy đủ Email/SĐT/CCCD và mật khẩu.'),
('d4a6792f-0921-491d-9cd4-a5d0f6330972', 'MSG_WARN_0002', 'vi', 'Vui lòng nhập đầy đủ các trường trong form đăng ký.'),
('0412fff9-9816-49a5-b0dd-da561048ce6e', 'MSG_WARN_0003', 'vi', 'Thông tin không hợp lệ.'),
('917ef57f-ea95-421c-9524-5b8084385a70', 'MSG_WARN_0004', 'vi', 'Mật khẩu và xác nhận mật khẩu không khớp.'),
('b0f8f78f-2b1d-4171-8d9c-eee715b5046b', 'MSG_WARN_0005', 'vi', 'Vui lòng nhập Họ tên, Số điện thoại và Ngày sinh.'),
('e7711a01-4edf-4943-b6fe-3474bd19b857', 'MSG_WARN_0006', 'vi', 'Vui lòng kiểm tra lại thông tin đặt lịch.'),
('4675385a-27dc-479f-8b0e-1535bd0c5677', 'MSG_WARN_0007', 'vi', 'Vui lòng kiểm tra lại thông tin.'),
('679c851a-cc6d-4c5d-8f3f-7e0776f06320', 'MSG_WARN_0008', 'vi', 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.'),
('260cf412-c95e-4002-a30a-839a7e37f411', 'MSG_WARN_0009', 'vi', 'Vui lòng chỉ định Bác sĩ trước khi tiếp tục.'),
('7503c357-6ffd-4d7d-b749-3533cd27cf68', 'MSG_WARN_0010', 'vi', 'Tải ảnh lên thất bại. Vui lòng thử lại.'),
('c079f20c-27f6-452e-a104-7ef70f3a80d2', 'MSG_WARN_0011', 'vi', 'Chỉ bác sĩ phụ trách mới được cập nhật thông tin lâm sàng.'),
('5177b2e2-8863-4507-b136-bd83aa60d629', 'MSG_WARN_0012', 'vi', 'Vui lòng chọn chuyên môn phòng CLS.'),
('b5fca22c-3f70-45ce-882b-15a221e3e133', 'MSG_WARN_0013', 'vi', 'Vui lòng chọn vật tư cho tất cả các dòng.'),
('am000002-0000-0000-0000-000000000092', 'MSG_ERR_0028', 'vi', 'Không thể xóa dịch vụ đang được dùng trong lịch hẹn hoặc hóa đơn.'),
('am000002-0000-0000-0000-000000000095', 'MSG_ERR_0031', 'vi', 'Nhân viên này đã có lịch trực ca {shift} ngày {date}. Không thể tạo thêm.'),
('am000002-0000-0000-0000-000000000096', 'MSG_ERR_0032', 'vi', 'Không thể xóa lịch làm việc đang có lịch hẹn liên kết.'),
('am000002-0000-0000-0000-000000000097', 'MSG_ERR_0033', 'vi', 'Bác sĩ này không có lịch trực trong khung giờ đã chọn. Vui lòng chọn khung giờ khác.'),
('am000002-0000-0000-0000-000000000098', 'MSG_ERR_0034', 'vi', 'Vui lòng nhập lý do hủy lịch hẹn.'),
('am000002-0000-0000-0000-000000000099', 'MSG_ERR_0035', 'vi', 'Không thể hủy lịch hẹn đang ở trạng thái Check-in hoặc Đang khám.'),
('am000002-0000-0000-0000-000000000100', 'MSG_ERR_0036', 'vi', 'Chỉ có thể cập nhật lịch hẹn ở trạng thái Chờ xác nhận hoặc Đã xác nhận.'),
('am000002-0000-0000-0000-000000000101', 'MSG_ERR_0037', 'vi', 'Bác sĩ đã có lịch hẹn khác trong khung giờ này. Vui lòng chọn giờ khác.'),
('am000002-0000-0000-0000-000000000102', 'MSG_ERR_0038', 'vi', 'Vui lòng nhập lý do từ chối trước khi xác nhận.'),
('am000002-0000-0000-0000-000000000108', 'MSG_ERR_0044', 'vi', 'Lịch hẹn này đã có hóa đơn. Không thể tạo thêm.'),
('am000002-0000-0000-0000-000000000109', 'MSG_ERR_0045', 'vi', 'Chỉ có thể tạo hóa đơn cho lịch hẹn đã check-in.'),
('am000002-0000-0000-0000-000000000110', 'MSG_ERR_0046', 'vi', 'Tên danh mục này đã tồn tại. Vui lòng đặt tên khác.'),
('am000002-0000-0000-0000-000000000111', 'MSG_ERR_0047', 'vi', 'Không thể xóa danh mục đang có vật tư. Hãy di chuyển hoặc xóa vật tư trước.'),
('am000002-0000-0000-0000-000000000112', 'MSG_ERR_0048', 'vi', 'Tên nhà cung cấp này đã tồn tại. Vui lòng đặt tên khác.'),
('am000002-0000-0000-0000-000000000113', 'MSG_ERR_0049', 'vi', 'Tồn kho không đủ. Hiện có: {current_stock} {unit}, yêu cầu: {quantity} {unit}.'),
('am000002-0000-0000-0000-000000000114', 'MSG_ERR_0050', 'vi', 'Số lượng phải lớn hơn 0.'),
('am000002-0000-0000-0000-000000000115', 'MSG_ERR_0051', 'vi', 'Tên thuốc này đã tồn tại trong danh mục. Vui lòng kiểm tra lại.'),
('am000002-0000-0000-0000-000000000116', 'MSG_ERR_0052', 'vi', 'Không thể xóa thuốc đang được sử dụng trong đơn thuốc của bệnh nhân.'),
('am000002-0000-0000-0000-000000000240', 'MSG_ERR_0057', 'vi', 'Dịch vụ này chưa được gán chuyên khoa.'),
('am000003-0000-0000-0000-000000000004', 'MSG_ERR_0058', 'vi', 'Phòng này đã được gán cho nhân viên khác trong ca {shift} ngày {date}.'),
('am000003-0000-0000-0000-000000000005', 'MSG_ERR_0059', 'vi', 'Chưa có phiếu chỉ định CLS nào cho lượt khám này.'),
('am000004-0000-0000-0000-000000000007', 'MSG_ERR_0061', 'vi', 'Khoảng ngày không hợp lệ (ngày kết thúc phải sau ngày bắt đầu).'),
('am000003-0000-0000-0000-000000000013', 'MSG_ERR_0062', 'vi', 'Khung giờ này đã ở trong quá khứ, vui lòng chọn khung giờ khác.'),
('am000003-0000-0000-0000-000000000014', 'MSG_ERR_0063', 'vi', 'Chỉ có thể check-in đúng ngày hẹn khám.'),
('am000003-0000-0000-0000-000000000015', 'MSG_ERR_0064', 'vi', 'Phòng khám đang có bệnh nhân đang được khám.'),
('am000003-0000-0000-0000-000000000016', 'MSG_ERR_0065', 'vi', 'Vui lòng nhập phiếu kết quả khám trước khi hoàn tất.'),
('am000003-0000-0000-0000-000000000117', 'MSG_ERR_0066', 'vi', 'Mật khẩu mới và xác nhận mật khẩu không khớp.'),
('am000003-0000-0000-0000-000000000119', 'MSG_ERR_0067', 'vi', 'Không thể xóa vật tư còn tồn kho. Vui lòng phân phối hết hoặc điều chỉnh tồn kho về 0 trước.'),
('am000003-0000-0000-0000-000000000120', 'MSG_ERR_0068', 'vi', 'Không thể xóa vật tư đã có lịch sử giao dịch.'),
('am000003-0000-0000-0000-000000000123', 'MSG_ERR_0069', 'vi', 'Không thể xóa nhà cung cấp còn gắn với lô vật tư đã nhập.'),
('am000003-0000-0000-0000-000000000125', 'MSG_ERR_0070', 'vi', 'Phòng khám nghỉ trưa từ 12:00 đến 13:00, vui lòng chọn khung giờ khác.'),
('am000004-0000-0000-0000-000000000001', 'MSG_ERR_0071', 'vi', 'Dịch vụ CLS phải chọn loại phòng thực hiện.'),
('am000004-0000-0000-0000-000000000003', 'MSG_ERR_0072', 'vi', 'Dịch vụ khám không được gán loại phòng CLS.'),
('am000004-0000-0000-0000-000000000005', 'MSG_ERR_0073', 'vi', 'Dịch vụ CLS không khớp với loại phòng đã chọn.'),
('am000004-0000-0000-0000-000000000009', 'MSG_ERR_0074', 'vi', 'Dịch vụ này không phải dịch vụ khám, không thể dùng để đặt/sửa lịch hẹn.'),
('am000004-0000-0000-0000-000000000011', 'MSG_ERR_0075', 'vi', 'Lịch hẹn chưa được xác nhận, không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000012', 'MSG_ERR_0076', 'vi', 'Lịch hẹn không ở trạng thái chờ xác nhận, không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000013', 'MSG_ERR_0077', 'vi', 'Bệnh nhân chưa được tiếp đón (check-in), không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000014', 'MSG_ERR_0078', 'vi', 'Lượt khám không ở trạng thái chờ, không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000015', 'MSG_ERR_0079', 'vi', 'Lượt khám không ở trạng thái đang khám, không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000016', 'MSG_ERR_0080', 'vi', 'Không thể gọi bệnh nhân ở trạng thái hiện tại của lượt khám.'),
('am000004-0000-0000-0000-000000000017', 'MSG_ERR_0081', 'vi', 'Không thể bắt đầu khám ở trạng thái hiện tại của lượt khám.'),
('am000004-0000-0000-0000-000000000018', 'MSG_ERR_0082', 'vi', 'Không thể tạm giữ lượt khám ở trạng thái hiện tại.'),
('am000004-0000-0000-0000-000000000019', 'MSG_ERR_0083', 'vi', 'Lượt khám chưa được gọi, không thể thực hiện thao tác này.'),
('am000004-0000-0000-0000-000000000020', 'MSG_ERR_0084', 'vi', 'Không thể in phiếu số thứ tự ở trạng thái hiện tại của lượt khám.'),
('am000004-0000-0000-0000-000000000021', 'MSG_ERR_0085', 'vi', 'Phiếu chỉ định CLS không ở trạng thái chờ thực hiện.'),
('am000004-0000-0000-0000-000000000022', 'MSG_ERR_0086', 'vi', 'Phiếu chỉ định CLS không ở trạng thái đang thực hiện.'),
('am000004-0000-0000-0000-000000000023', 'MSG_ERR_0087', 'vi', 'Phòng CLS đang bận, vui lòng thử lại sau.'),
('am000004-0000-0000-0000-000000000024', 'MSG_ERR_0088', 'vi', 'Lượt khám còn phiếu chỉ định CLS chưa hoàn thành.'),
('am000004-0000-0000-0000-000000000025', 'MSG_ERR_0089', 'vi', 'Kết quả khám cho lượt khám này đã tồn tại.'),
('am000004-0000-0000-0000-000000000026', 'MSG_ERR_0090', 'vi', 'Mã tra cứu đã hết hạn.'),
('am000004-0000-0000-0000-000000000027', 'MSG_ERR_0091', 'vi', 'Đơn thuốc cho lượt khám này đã tồn tại.'),
('am000004-0000-0000-0000-000000000028', 'MSG_ERR_0092', 'vi', 'Hóa đơn này đã được thanh toán, không thể thực hiện lại thao tác.'),
('am000004-0000-0000-0000-000000000029', 'MSG_ERR_0093', 'vi', 'Dịch vụ tóm tắt AI hiện không khả dụng. Vui lòng thử lại sau.'),
('am000004-0000-0000-0000-000000000030', 'MSG_ERR_0094', 'vi', 'Đã vượt giới hạn số lần gọi AI, vui lòng thử lại sau ít phút.'),
('b8c218e9-549a-48cd-a0e1-22a10bb7d146', 'MSG_ERR_0095', 'vi', 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau ít phút.'),
('744a9a0d-2157-4455-9022-7eabd32760c4', 'MSG_ERR_0096', 'vi', 'Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số và bắt đầu bằng số 0 (VD: 0912345678).'),
('e6e62cae-9dc6-46f7-914b-a35616ddc43d', 'MSG_ERR_0097', 'vi', 'Số CCCD/CMND không hợp lệ. Vui lòng nhập đúng 12 chữ số.'),
('54e187fc-df0a-4728-969f-d1cb4bc98554', 'MSG_ERR_0098', 'vi', 'Định dạng tháng không hợp lệ (VD: 2026-08).'),
('dd673557-7dd6-4a50-9ec7-f27b5f0f6cfe', 'MSG_ERR_0099', 'vi', 'Ngày sinh không được ở tương lai.'),
('caf822d8-9a26-4a92-b7ed-1af9417ce98b', 'MSG_ERR_0100', 'vi', 'Vui lòng nhập tên chuyên khoa.'),
('8f50b666-0ebc-4f44-96cb-0a81278fdd93', 'MSG_ERR_0101', 'vi', 'Tên chuyên khoa tối đa 100 ký tự.'),
('6f0c2679-83c6-4ba7-8cc3-792c0436fc57', 'MSG_ERR_0102', 'vi', 'Ảnh đại diện phải là đường dẫn URL hợp lệ.'),
('8716a0a3-bcfe-4219-8206-799e68d64560', 'MSG_ERR_0103', 'vi', 'Vui lòng nhập tên thuốc.'),
('936fc7df-8b4f-41b3-95fd-1f374ccb8a2d', 'MSG_ERR_0104', 'vi', 'Tên thuốc tối đa 150 ký tự.'),
('ec851c74-558d-4c17-996e-3a426f16db49', 'MSG_ERR_0105', 'vi', 'Vui lòng nhập hoạt chất.'),
('430a6ff8-e434-4c1f-9e67-b46af856ffc5', 'MSG_ERR_0106', 'vi', 'Hoạt chất tối đa 200 ký tự.'),
('f044138b-bdf0-4782-9304-505fb153fb08', 'MSG_ERR_0107', 'vi', 'Vui lòng nhập dạng bào chế.'),
('f9531e25-c3d8-411a-bcaf-4b212114d3df', 'MSG_ERR_0108', 'vi', 'Dạng bào chế tối đa 50 ký tự.'),
('32473ce7-a37d-4b45-9957-498cb9f8c86a', 'MSG_ERR_0109', 'vi', 'Đơn vị tính không hợp lệ.'),
('66e3fc41-68d7-4967-a515-7df82638b50d', 'MSG_ERR_0110', 'vi', 'Giá phải là số dương.'),
('8c6d533e-b24b-4d11-b673-1b4746e6a151', 'MSG_ERR_0111', 'vi', 'Vui lòng nhập tên dịch vụ.'),
('52efc02e-1be9-465c-bf53-5a9d24740eb0', 'MSG_ERR_0112', 'vi', 'Tên dịch vụ tối đa 50 ký tự.'),
('2462a07f-7d63-4351-b030-e0e0f080d8b1', 'MSG_ERR_0113', 'vi', 'Loại dịch vụ không hợp lệ (chỉ chấp nhận "Khám bệnh" hoặc "CLS (Cận lâm sàng)").'),
('e6c193c9-ef72-404a-ba80-fcf4e8e2932b', 'MSG_ERR_0114', 'vi', 'Nhóm CLS không hợp lệ (chỉ chấp nhận "Xét nghiệm", "X-quang", "Siêu âm" hoặc "Chụp điện tim").'),
('17ab0cea-5928-4186-89f6-c563a87dd293', 'MSG_ERR_0115', 'vi', 'Vui lòng nhập tên nhà cung cấp.'),
('14382b8b-0b67-4d4d-9d97-4f4387c3263f', 'MSG_ERR_0116', 'vi', 'Tên nhà cung cấp tối đa 150 ký tự.'),
('bbbded7b-b675-4890-8811-a73761620184', 'MSG_ERR_0117', 'vi', 'Số điện thoại không hợp lệ (VD: 0912345678).'),
('608d4562-3132-4b92-aac6-c5b3fce63a69', 'MSG_ERR_0118', 'vi', 'Email không hợp lệ.'),
('757d1a70-68b8-4774-9524-306545bab5ce', 'MSG_ERR_0119', 'vi', 'Vui lòng nhập tên vật tư.'),
('be1d22d9-2ce6-4f4c-8d08-cb29d276972c', 'MSG_ERR_0120', 'vi', 'Tên vật tư tối đa 150 ký tự.'),
('da2a9e69-7edf-484d-85b0-64b150b59d77', 'MSG_ERR_0121', 'vi', 'Vui lòng chọn danh mục vật tư.'),
('b42b3ad7-c74d-4f94-97d6-55025425aafd', 'MSG_ERR_0122', 'vi', 'Mức tồn kho tối thiểu không được âm.'),
('51c56fd2-a2ed-4729-b43b-a057da2f042a', 'MSG_ERR_0123', 'vi', 'Vui lòng chọn vật tư.'),
('3162d83a-e507-4aea-b221-219305596ba9', 'MSG_ERR_0124', 'vi', 'Vui lòng chọn phòng.'),
('0fdc7762-8c48-4c39-99de-2026f31e3e04', 'MSG_ERR_0125', 'vi', 'Giá nhập không được âm.'),
('c916c853-1331-47ca-a1f5-457166a6b742', 'MSG_ERR_0126', 'vi', 'Vui lòng chọn nhà cung cấp.'),
('c0907b93-3410-4dba-94bd-8067700175e7', 'MSG_ERR_0127', 'vi', 'Vui lòng nhập ít nhất một dòng vật tư để nhập kho.'),
('a1586f9b-db97-47b1-8e6d-96880472f70b', 'MSG_ERR_0128', 'vi', 'Trạng thái tồn kho không hợp lệ (chỉ chấp nhận "Sắp hết" hoặc "Bình thường").'),
('e923fb2c-ecaf-4e03-8771-be2a5a6e37b3', 'MSG_ERR_0129', 'vi', 'Loại giao dịch không hợp lệ (chỉ chấp nhận "Nhập kho" hoặc "Phân phối").'),
('98ad9d1e-391f-43ad-95a1-dc1e9518869b', 'MSG_ERR_0130', 'vi', 'Vui lòng nhập tên danh mục vật tư.'),
('aaacc391-21a9-423a-9626-842b2476eab5', 'MSG_ERR_0131', 'vi', 'Tên danh mục vật tư tối đa 100 ký tự.'),
('a15e0fd9-0f7f-497e-befd-b861be500eec', 'MSG_ERR_0132', 'vi', 'Vai trò không hợp lệ.'),
('937183a4-cffc-46b1-8188-6a7d75ac8594', 'MSG_ERR_0133', 'vi', 'Chỉ chấp nhận ảnh JPG, PNG hoặc PDF.'),
('4e87996c-5f18-4607-b365-4709dc508e0e', 'MSG_ERR_0134', 'vi', 'Không có tệp nào được tải lên.'),
('4ace8864-1ce4-4f57-a914-b07e97a0f4f9', 'MSG_ERR_0135', 'vi', 'Chỉ có thể đính kèm tệp sau khi đã lưu kết quả khám.'),
('dc958280-96cc-4a2b-818c-1a3e3ebde9dd', 'MSG_ERR_0136', 'vi', 'Chỉ chấp nhận ảnh PNG, JPEG, WEBP hoặc GIF.'),
('f3a6f2b1-3f0e-4c7d-9b1a-6e2c8d5a7b4e', 'MSG_ERR_0137', 'vi', 'Mật khẩu hiện tại không đúng.'),
('7a1b2c3d-4e5f-4071-9701-000000000138', 'MSG_ERR_0138', 'vi', 'Bạn đã đặt lịch quá nhiều lần trong thời gian ngắn, vui lòng thử lại sau.'),
('7a1b2c3d-4e5f-4071-9701-000000000139', 'MSG_ERR_0139', 'vi', 'Bạn đang có {count} lịch hẹn chưa hoàn tất, vui lòng hoàn tất hoặc hủy bớt trước khi đặt lịch mới.'),
('7a1b2c3d-4e5f-4071-9701-000000000140', 'MSG_ERR_0140', 'vi', 'Bác sĩ thay thế không hợp lệ (không phải tài khoản bác sĩ).'),
('7a1b2c3d-4e5f-4071-9701-000000000141', 'MSG_ERR_0141', 'vi', 'Bác sĩ thay thế phải khác bác sĩ hiện đang phụ trách ca này.'),
('7a1b2c3d-4e5f-4071-9701-000000000142', 'MSG_ERR_0142', 'vi', 'Lý do vắng mặt tối đa 255 ký tự.'),
-- ERR_0143-0145: version-up 0.2 item #10 payment-split gates.
('7a1b2c3d-4e5f-4071-9701-000000000143', 'MSG_ERR_0143', 'vi', 'Bệnh nhân chưa đóng phí khám. Vui lòng thu tiền tại quầy lễ tân trước khi bắt đầu khám.'),
('7a1b2c3d-4e5f-4071-9701-000000000144', 'MSG_ERR_0144', 'vi', 'Bệnh nhân chưa đóng phí dịch vụ này. Vui lòng thu tiền tại quầy lễ tân trước khi thực hiện.'),
('7a1b2c3d-4e5f-4071-9701-000000000145', 'MSG_ERR_0145', 'vi', 'Danh sách dòng thu tiền không hợp lệ.'),
-- ERR_0146: payment-before-queue change (2026-08-21) — check-in is now a
-- 2-step flow; idempotency guard for the confirm-payment step.
('7a1b2c3d-4e5f-4071-9701-000000000146', 'MSG_ERR_0146', 'vi', 'Lịch hẹn này đã vào hàng chờ khám trước đó.'),
-- ERR_0147: CLS result lock (2026-08-21) — a result can no longer be
-- edited once the order reaches COMPLETED (first save).
('7a1b2c3d-4e5f-4071-9701-000000000147', 'MSG_ERR_0147', 'vi', 'Kết quả CLS đã được xác nhận, không thể chỉnh sửa.'),
-- ERR_0148: :id/result-print used to return a raw hardcoded message instead
-- of going through the message catalog like every other error.
('7a1b2c3d-4e5f-4071-9701-000000000148', 'MSG_ERR_0148', 'vi', 'Chưa có kết quả CLS để in.');

-- =============================================================
-- users
-- =============================================================
-- NOTE (2026-07-22): the plaintext behind these existing bcrypt hashes is
-- not documented anywhere in this repo (scripts/check-admin-passwords.js is
-- a brute-force guesser, not a source of truth), so they are left as-is
-- rather than guessed by hand. Staff hashes below should be regenerated to
-- bcrypt(DEFAULT_STAFF_PASSWORD) — see src/domain/value-objects/password-policy.vo.ts —
-- the next time someone can safely re-hash and verify a demo login.
INSERT INTO users (id, full_name, email, phone, password_hash, role, is_active, must_change_password) VALUES
('u0000001-0000-0000-0000-000000000001', 'Nguyễn Văn Admin',     'admin@aucophuha.vn',       '0900000001', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'ADMIN',        1, 0),
('u0000001-0000-0000-0000-000000000002', 'Trần Thị Lễ Tân',      'reception@aucophuha.vn',   '0900000002', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'RECEPTIONIST', 1, 0),
('u0000001-0000-0000-0000-000000000003', 'Lê Văn Sơn',           'dr.son@aucophuha.vn',      '0900000003', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'DOCTOR',       1, 0),
('u0000001-0000-0000-0000-000000000004', 'Phạm Thị Hoa',         'dr.hoa@aucophuha.vn',      '0900000004', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'DOCTOR',       1, 0),
('u0000001-0000-0000-0000-000000000005', 'Điều Dưỡng Nguyễn Mai','nurse.mai@aucophuha.vn',   '0900000005', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'NURSE',        1, 0),
('u0000001-0000-0000-0000-000000000006', 'KTV Trần Đức',         'lab.duc@aucophuha.vn',     '0900000006', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'LAB_TECH',     1, 0),
('u0000001-0000-0000-0000-000000000007', 'Nguyễn Văn An',        'patient@clinic.vn',     '0912345001', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'PATIENT',      1, 0),
('u0000001-0000-0000-0000-000000000011', 'Đặng Minh Admin',      'admin.demo@aucophuha.vn',  '0900000011', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'ADMIN',        1, 0),
('u0000001-0000-0000-0000-000000000009', 'Võ Thị Lễ Tân',        'reception.demo@aucophuha.vn', '0900000009', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'RECEPTIONIST', 1, 0),
('u0000001-0000-0000-0000-000000000010', 'Bùi Thị Minh Anh',     'patient.demo@clinic.vn','0912345010', '$2b$10$dDjB1vRuAn48FibkRVPWEu6HY4dqFzvQ2dJsRMxm1fnsO.wRfRT9i', 'PATIENT',      1, 0);

-- created_by self-reference update
UPDATE users SET created_by = 'u0000001-0000-0000-0000-000000000001';

-- =============================================================
-- specialties
-- =============================================================
-- 7 clinical specialties + 2 CLS specialties (Chẩn đoán hình ảnh covers
-- X-quang/Siêu âm rooms, Xét nghiệm covers lab rooms) — matches the real
-- department structure, not an arbitrary list. See
-- database/migrations/20260801_normalize_specialty_service_room_data.sql
-- and 20260801_add_imaging_lab_specialties_and_rooms.sql for the live-DB
-- migration this mirrors.
INSERT INTO specialties (id, name, description) VALUES
('sp000001-0000-0000-0000-000000000001', 'Chuyên khoa Nội',          'Khám và điều trị các bệnh lý nội khoa tổng quát'),
('sp000002-0000-0000-0000-000000000001', 'Tai Mũi Họng',             NULL),
('sp000002-0000-0000-0000-000000000002', 'Sản phụ khoa',             NULL),
('sp000002-0000-0000-0000-000000000003', 'Thăm dò chức năng',        NULL),
('sp000002-0000-0000-0000-000000000004', 'Chuyên khoa ngoại',        NULL),
('sp000002-0000-0000-0000-000000000005', 'Chuyên khoa mắt',          NULL),
('sp000002-0000-0000-0000-000000000006', 'Chuyên khoa Răng Hàm Mặt', NULL),
('sp000003-0000-0000-0000-000000000001', 'Chẩn đoán hình ảnh',       'Phòng X-quang, siêu âm'),
('sp000003-0000-0000-0000-000000000002', 'Xét nghiệm',               'Phòng xét nghiệm cận lâm sàng');

-- =============================================================
-- doctor_profiles
-- =============================================================
-- Phạm Thị Hoa was seeded under "Nhi khoa", which no longer exists as a
-- specialty (see the normalization above) — reassigned to Chuyên khoa Nội,
-- same as the equivalent real-roster remap.
INSERT INTO doctor_profiles (id, user_id, specialty_id, degree, years_experience, biography) VALUES
('dp000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'sp000001-0000-0000-0000-000000000001', 'Thạc sĩ Y khoa', 10, 'Bác sĩ chuyên khoa Nội với 10 năm kinh nghiệm.'),
('dp000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 'sp000001-0000-0000-0000-000000000001', 'Bác sĩ CKI',     7,  'Bác sĩ chuyên khoa Nội với 7 năm kinh nghiệm.');

-- =============================================================
-- rooms
-- =============================================================
-- Full real production set (16 rooms) — extracted from live RDS 2026-08-02
-- before the instance was deleted (cost reasons). Replaces the earlier
-- minimal fixture 1:1 where ids match (PK-01/PK-02/CLS-01/CLS-02/OP-01/AD-01)
-- and adds the rest (PK-03..PK-10, CLS-03, CLS-04) so this file alone is a
-- complete restore point.
INSERT IGNORE INTO rooms (id, room_code, name, type, specialty_id, cls_category, description, is_active, created_by) VALUES
('r0000001-0000-0000-0000-000000000001', 'PK-01', 'Phòng khám Nội 1', 'EXAMINATION', 'sp000001-0000-0000-0000-000000000001', NULL, 'Phòng khám nội khoa tổng quát số 1', 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000001-0000-0000-0000-000000000002', 'PK-02', 'Phòng khám Nội 2', 'EXAMINATION', 'sp000001-0000-0000-0000-000000000001', NULL, 'Phòng khám nhi khoa', 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000001-0000-0000-0000-000000000003', 'CLS-01', 'Phòng Xét nghiệm', 'CLS', 'sp000003-0000-0000-0000-000000000002', 'LAB', 'Phòng thực hiện xét nghiệm máu và sinh hóa cơ bản', 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000001-0000-0000-0000-000000000004', 'CLS-02', 'Phòng Siêu âm', 'CLS', 'sp000003-0000-0000-0000-000000000001', 'ULTRASOUND', 'Phòng siêu âm tổng quát', 1, 'u0000001-0000-0000-0000-000000000001'),
('f01956e2-70b3-454a-9165-c57654b9533b', 'CLS-03', 'Phòng X-quang', 'CLS', 'sp000003-0000-0000-0000-000000000001', 'XRAY', NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000002-0000-0000-0000-000000000001', 'CLS-04', 'Phòng Điện tim', 'CLS', 'sp000002-0000-0000-0000-000000000003', 'ECG', '', 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000001-0000-0000-0000-000000000006', 'AD-01', 'Phòng hành chính', 'ADMIN', NULL, NULL, 'Phòng quản lý và điều hành', 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000001', 'PK-03', 'Phòng khám Ngoại', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000004', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000002', 'PK-04', 'Phòng khám Tai Mũi Họng', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000001', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000003', 'PK-05', 'Phòng khám Sản', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000002', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000004', 'PK-06', 'Phòng Thăm dò chức năng', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000003', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000005', 'PK-07', 'Phòng khám Mắt', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000005', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000006', 'PK-08', 'Phòng khám Răng Hàm Mặt', 'EXAMINATION', 'sp000002-0000-0000-0000-000000000006', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000007', 'PK-09', 'Phòng Cấp cứu', 'EXAMINATION', 'sp000001-0000-0000-0000-000000000001', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('r0000003-0000-0000-0000-000000000008', 'PK-10', 'Phòng Nội soi tiêu hóa', 'EXAMINATION', 'sp000001-0000-0000-0000-000000000001', NULL, NULL, 1, 'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- services
-- =============================================================
-- Full real production set (11 services) — same 2026-08-02 extraction. IDs
-- differ from an earlier fictional placeholder for "Khám Ngoại tổng quát" /
-- "Chụp Xquang" / "Chụp điện tim" (the real ones were created independently
-- during specialty normalization) — this block fully replaces that fixture
-- rather than appending, since services.name is UNIQUE and the names collide.
INSERT IGNORE INTO services (id, service_code, name, specialty_id, type, cls_category, price, description, is_active, created_by) VALUES
('sv000001-0000-0000-0000-000000000001', NULL, 'Khám Nội tổng quát', 'sp000001-0000-0000-0000-000000000001', 'EXAMINATION', NULL, 150000, 'Khám và tư vấn nội khoa tổng quát', 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000004', NULL, 'Khám Ngoại tổng quát', 'sp000002-0000-0000-0000-000000000004', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000001', NULL, 'Khám Tai Mũi Họng', 'sp000002-0000-0000-0000-000000000001', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000002', NULL, 'Khám Sản phụ khoa', 'sp000002-0000-0000-0000-000000000002', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000003', NULL, 'Khám Thăm dò chức năng', 'sp000002-0000-0000-0000-000000000003', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000005', NULL, 'Khám Mắt', 'sp000002-0000-0000-0000-000000000005', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000006', NULL, 'Khám Răng Hàm Mặt', 'sp000002-0000-0000-0000-000000000006', 'EXAMINATION', NULL, 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000001-0000-0000-0000-000000000003', NULL, 'Xét nghiệm', NULL, 'CLS', 'LAB', 250000, 'CBC và sinh hóa máu cơ bản', 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000001-0000-0000-0000-000000000004', NULL, 'Siêu âm', NULL, 'CLS', 'ULTRASOUND', 300000, 'Siêu âm các cơ quan ổ bụng', 1, 'u0000001-0000-0000-0000-000000000001'),
('48f915e9-c86e-4b89-acbd-4ca3b3e34410', NULL, 'Chụp Xquang', NULL, 'CLS', 'XRAY', 200000, NULL, 1, 'u0000001-0000-0000-0000-000000000001'),
('sv000002-0000-0000-0000-000000000007', NULL, 'Chụp điện tim', NULL, 'CLS', 'ECG', 150000, NULL, 1, 'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- work_schedules
-- =============================================================
INSERT INTO work_schedules (id, user_id, room_id, work_date, shift, created_by) VALUES
('ws000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'r0000001-0000-0000-0000-000000000001', CURDATE(), 'MORNING',   'u0000001-0000-0000-0000-000000000001'),
('ws000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000003', 'r0000001-0000-0000-0000-000000000001', CURDATE(), 'AFTERNOON', 'u0000001-0000-0000-0000-000000000001'),
('ws000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000004', 'r0000001-0000-0000-0000-000000000002', CURDATE(), 'MORNING',   'u0000001-0000-0000-0000-000000000001'),
('ws000001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000006', 'r0000001-0000-0000-0000-000000000003', CURDATE(), 'FULL_DAY',  'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- patients
-- =============================================================
INSERT INTO patients (id, patient_code, full_name, date_of_birth, gender, phone, id_card, address, notification_consent, created_by) VALUES
('pt000001-0000-0000-0000-000000000001', 'BN-20240101-0001', 'Nguyễn Văn An',    '1985-03-15', 'MALE',   '0912345001', '079085001234', '12 Lê Lợi, Q.1, TP.HCM',       1, 'u0000001-0000-0000-0000-000000000002'),
('pt000001-0000-0000-0000-000000000002', 'BN-20240101-0002', 'Trần Thị Bình',    '1990-07-22', 'FEMALE', '0912345002', '079090002345', '45 Nguyễn Huệ, Q.1, TP.HCM',   1, 'u0000001-0000-0000-0000-000000000002'),
('pt000001-0000-0000-0000-000000000003', 'BN-20240101-0003', 'Lê Minh Cường',    '1978-11-05', 'MALE',   '0912345003', '079078003456', '78 Trần Hưng Đạo, Q.5, TP.HCM', 0, 'u0000001-0000-0000-0000-000000000002'),
('pt000001-0000-0000-0000-000000000004', 'BN-20240101-0004', 'Phạm Thị Dung',    '2015-06-18', 'FEMALE', '0912345004', '079015004321', '23 Cách Mạng Tháng 8, Q.3',     1, 'u0000001-0000-0000-0000-000000000002'),
('pt000001-0000-0000-0000-000000000005', 'BN-20240101-0005', 'Hoàng Văn Em',     '1965-09-30', 'MALE',   '0912345005', '079065005678', '56 Võ Văn Tần, Q.3, TP.HCM',    0, 'u0000001-0000-0000-0000-000000000002'),
('pt000001-0000-0000-0000-000000000010', 'BN-20240618-0010', 'Bùi Thị Minh Anh', '1992-02-14', 'FEMALE', '0912345010', '079092010010', '88 Nguyễn Thị Minh Khai, Q.3, TP.HCM', 1, 'u0000001-0000-0000-0000-000000000009');

-- Liên kết tài khoản tự đăng ký (PATIENT) với hồ sơ bệnh nhân có sẵn theo SĐT (Feature 91)
UPDATE patients SET user_id = 'u0000001-0000-0000-0000-000000000007' WHERE id = 'pt000001-0000-0000-0000-000000000001';
UPDATE patients SET user_id = 'u0000001-0000-0000-0000-000000000010' WHERE id = 'pt000001-0000-0000-0000-000000000010';

-- =============================================================
-- medical_records
-- =============================================================
INSERT INTO medical_records (
    id,
    patient_id,
    medical_history,
    clinical_note,
    diagnosis_summary,
    treatment_summary,
    follow_up_note,
    created_by,
    updated_by
) VALUES
(
    'mr000001-0000-0000-0000-000000000001',
    'pt000001-0000-0000-0000-000000000001',
    'Tăng huyết áp 5 năm, đang dùng Amlodipine 5mg mỗi sáng. Tiền sử viêm dạ dày tái phát, chưa ghi nhận phẫu thuật lớn.',
    'Bệnh nhân tỉnh, tiếp xúc tốt. Mạch 78 lần/phút, huyết áp 130/80 mmHg, nhiệt độ 36.8°C. Đau âm ỉ vùng thượng vị, không nôn, không sốt.',
    'Viêm dạ dày cấp mức độ nhẹ trên nền tiền sử tăng huyết áp đã kiểm soát.',
    'Điều trị nội khoa bằng thuốc ức chế bơm proton, giảm đau khi cần và tư vấn chế độ ăn mềm, hạn chế cà phê, rượu bia, thức ăn cay nóng.',
    'Tái khám sau 14 ngày hoặc sớm hơn nếu đau bụng tăng, nôn ra máu, đi ngoài phân đen, chóng mặt hoặc mệt nhiều.',
    'u0000001-0000-0000-0000-000000000003',
    'u0000001-0000-0000-0000-000000000003'
),
(
    'mr000001-0000-0000-0000-000000000002',
    'pt000001-0000-0000-0000-000000000002',
    'Không ghi nhận bệnh mạn tính. Có tiền sử đau nửa đầu khi căng thẳng, tự hết sau nghỉ ngơi.',
    'Sinh hiệu ổn định. Bệnh nhân than mệt, đau đầu âm ỉ vùng thái dương, không yếu liệt, không nôn ói.',
    'Đau đầu căng cơ, theo dõi thiếu ngủ và stress công việc.',
    'Tư vấn nghỉ ngơi, uống đủ nước, dùng thuốc giảm đau thông thường khi cần và theo dõi triệu chứng thần kinh bất thường.',
    'Tái khám sau 7 ngày nếu đau đầu kéo dài, nhìn mờ, nôn ói hoặc xuất hiện yếu liệt.',
    'u0000001-0000-0000-0000-000000000003',
    'u0000001-0000-0000-0000-000000000003'
),
(
    'mr000001-0000-0000-0000-000000000003',
    'pt000001-0000-0000-0000-000000000003',
    'Tiền sử viêm dạ dày tái phát 2 năm, thường đau tăng khi ăn cay hoặc uống cà phê. Chưa ghi nhận dị ứng thuốc nặng.',
    'Đau thượng vị mức độ vừa, ấn đau vùng thượng vị, không có dấu hiệu xuất huyết tiêu hóa. Sinh hiệu ổn định.',
    'Viêm dạ dày cấp tính, chưa ghi nhận biến chứng. Kết quả xét nghiệm máu trong giới hạn bình thường.',
    'Điều trị nội khoa với Omeprazole, Paracetamol khi đau; hướng dẫn ăn nhẹ, chia nhỏ bữa, tránh rượu bia và thức ăn kích thích.',
    'Tái khám sau 2 tuần để đánh giá đáp ứng điều trị; đi khám ngay nếu đau tăng, nôn ra máu hoặc đi ngoài phân đen.',
    'u0000001-0000-0000-0000-000000000003',
    'u0000001-0000-0000-0000-000000000003'
),
(
    'mr000001-0000-0000-0000-000000000010',
    'pt000001-0000-0000-0000-000000000010',
    'Viêm mũi dị ứng theo mùa 3 năm, thỉnh thoảng tái phát khi thời tiết thay đổi. Không ghi nhận bệnh mạn tính khác.',
    'Bệnh nhân tỉnh, tiếp xúc tốt. Nghẹt mũi, hắt hơi nhiều, đau rát họng nhẹ, phổi thông khí tốt, không khó thở.',
    'Viêm mũi họng cấp trên nền cơ địa dị ứng, chưa ghi nhận dấu hiệu nhiễm khuẩn nặng.',
    'Điều trị triệu chứng, vệ sinh mũi bằng nước muối sinh lý, dùng thuốc kháng histamine buổi tối và uống đủ nước.',
    'Theo dõi 5-7 ngày; tái khám nếu sốt cao, khó thở, đau họng tăng hoặc triệu chứng kéo dài trên 1 tuần.',
    'u0000001-0000-0000-0000-000000000003',
    'u0000001-0000-0000-0000-000000000003'
);

-- =============================================================
-- patient_allergies
-- =============================================================
INSERT INTO patient_allergies (id, patient_id, allergen, severity, description, created_by) VALUES
('pa000001-0000-0000-0000-000000000001', 'pt000001-0000-0000-0000-000000000001', 'Penicillin',  'SEVERE',   'Dị ứng nặng, nổi mề đay toàn thân',   'u0000001-0000-0000-0000-000000000003'),
('pa000001-0000-0000-0000-000000000002', 'pt000001-0000-0000-0000-000000000002', 'Aspirin',     'MODERATE', 'Đau bụng khi dùng Aspirin',             'u0000001-0000-0000-0000-000000000003'),
('pa000001-0000-0000-0000-000000000003', 'pt000001-0000-0000-0000-000000000003', 'Sulfonamide', 'MILD',     'Phát ban nhẹ khi dùng Sulfonamide',     'u0000001-0000-0000-0000-000000000003'),
('pa000001-0000-0000-0000-000000000010', 'pt000001-0000-0000-0000-000000000010', 'Phấn hoa',    'MODERATE', 'Hắt hơi, ngứa mũi và chảy nước mắt khi tiếp xúc nhiều với phấn hoa', 'u0000001-0000-0000-0000-000000000003');

-- =============================================================
-- medicines
-- =============================================================
INSERT INTO medicines (id, name, active_ingredient, dosage_form, unit, price, contraindications, created_by) VALUES
('md000001-0000-0000-0000-000000000001', 'Paracetamol 500mg',  'Paracetamol',       'Viên nén',  'VIEN', 2000,  'Suy gan nặng, dị ứng paracetamol',     'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000002', 'Amoxicillin 500mg',  'Amoxicillin',       'Viên nang', 'VIEN', 5000,  'Dị ứng Penicillin',                     'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000003', 'Ibuprofen 400mg',    'Ibuprofen',         'Viên nén',  'VIEN', 3000,  'Loét dạ dày, suy thận',                 'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000004', 'Omeprazole 20mg',    'Omeprazole',        'Viên nang', 'VIEN', 8000,  'Không dùng chung với Clopidogrel',      'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000005', 'Vitamin C 500mg',    'Ascorbic Acid',     'Viên sủi',  'VIEN', 1500,  NULL,                                    'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000006', 'Metformin 500mg',    'Metformin HCl',     'Viên nén',  'VIEN', 4000,  'Suy thận, suy gan, nhiễm toan lactic',  'u0000001-0000-0000-0000-000000000001'),
('md000001-0000-0000-0000-000000000007', 'Cetirizine 10mg',    'Cetirizine HCl',    'Viên nén',  'VIEN', 3500,  'Mẫn cảm với Hydroxyzine',               'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- medicine_interactions
-- =============================================================
INSERT INTO medicine_interactions (id, medicine_a_id, medicine_b_id, severity, description, created_by) VALUES
('mi000001-0000-0000-0000-000000000001', 'md000001-0000-0000-0000-000000000003', 'md000001-0000-0000-0000-000000000004', 'MILD',     'Ibuprofen có thể giảm hiệu quả của Omeprazole', 'u0000001-0000-0000-0000-000000000001'),
('mi000001-0000-0000-0000-000000000002', 'md000001-0000-0000-0000-000000000002', 'md000001-0000-0000-0000-000000000006', 'MODERATE', 'Amoxicillin có thể tăng tác dụng của Metformin', 'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- appointments
-- =============================================================
INSERT INTO appointments (id, patient_id, doctor_id, service_id, room_id, schedule_id, appointment_time, status, booked_by) VALUES
('ap000001-0000-0000-0000-000000000001', 'pt000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001', 'ws000001-0000-0000-0000-000000000001', DATE_ADD(NOW(), INTERVAL 1 DAY),  'CONFIRMED',  'u0000001-0000-0000-0000-000000000002'),
('ap000001-0000-0000-0000-000000000002', 'pt000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001', 'ws000001-0000-0000-0000-000000000001', DATE_ADD(NOW(), INTERVAL 1 DAY),  'PENDING',    'u0000001-0000-0000-0000-000000000002'),
('ap000001-0000-0000-0000-000000000003', 'pt000001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000004', 'sv000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000002', 'ws000001-0000-0000-0000-000000000003', DATE_ADD(NOW(), INTERVAL 1 DAY),  'CONFIRMED',  'u0000001-0000-0000-0000-000000000002'),
('ap000001-0000-0000-0000-000000000004', 'pt000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001', 'ws000001-0000-0000-0000-000000000002', DATE_SUB(NOW(), INTERVAL 1 DAY),  'COMPLETED',  'u0000001-0000-0000-0000-000000000002'),
('ap000001-0000-0000-0000-000000000005', 'pt000001-0000-0000-0000-000000000005', 'u0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000001', NULL,                                  NULL,                                  DATE_ADD(NOW(), INTERVAL 3 DAY),  'PENDING',  'u0000001-0000-0000-0000-000000000002'),
('ap000001-0000-0000-0000-000000000010', 'pt000001-0000-0000-0000-000000000010', 'u0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001', 'ws000001-0000-0000-0000-000000000002', DATE_SUB(NOW(), INTERVAL 3 DAY), 'COMPLETED', 'u0000001-0000-0000-0000-000000000009');

-- INSERT above uses PENDING, not CANCELLED: inserting CANCELLED directly
-- violates chk_appt_cancel (requires cancel_reason/cancelled_by/cancelled_at
-- to be set), which this UPDATE only sets afterward. Transition the status
-- here, atomically with the other cancel fields.
UPDATE appointments
SET status        = 'CANCELLED',
    cancel_reason = 'Bệnh nhân bận công việc đột xuất',
    cancelled_by  = 'u0000001-0000-0000-0000-000000000002',
    cancelled_at  = NOW()
WHERE id = 'ap000001-0000-0000-0000-000000000005';

-- =============================================================
-- appointment_history
-- =============================================================
INSERT INTO appointment_history (id, appointment_id, old_status, new_status, changed_by) VALUES
('ah000001-0000-0000-0000-000000000001', 'ap000001-0000-0000-0000-000000000001', NULL,        'PENDING',   'u0000001-0000-0000-0000-000000000002'),
('ah000001-0000-0000-0000-000000000002', 'ap000001-0000-0000-0000-000000000001', 'PENDING',   'CONFIRMED', 'u0000001-0000-0000-0000-000000000002'),
('ah000001-0000-0000-0000-000000000003', 'ap000001-0000-0000-0000-000000000004', NULL,        'PENDING',   'u0000001-0000-0000-0000-000000000002'),
('ah000001-0000-0000-0000-000000000004', 'ap000001-0000-0000-0000-000000000004', 'PENDING',   'CONFIRMED', 'u0000001-0000-0000-0000-000000000002'),
('ah000001-0000-0000-0000-000000000005', 'ap000001-0000-0000-0000-000000000004', 'CONFIRMED', 'CHECKED_IN','u0000001-0000-0000-0000-000000000002'),
('ah000001-0000-0000-0000-000000000006', 'ap000001-0000-0000-0000-000000000004', 'CHECKED_IN','COMPLETED', 'u0000001-0000-0000-0000-000000000003'),
('ah000001-0000-0000-0000-000000000010', 'ap000001-0000-0000-0000-000000000010', NULL,        'PENDING',   'u0000001-0000-0000-0000-000000000009'),
('ah000001-0000-0000-0000-000000000011', 'ap000001-0000-0000-0000-000000000010', 'PENDING',   'CONFIRMED', 'u0000001-0000-0000-0000-000000000009'),
('ah000001-0000-0000-0000-000000000012', 'ap000001-0000-0000-0000-000000000010', 'CONFIRMED', 'CHECKED_IN','u0000001-0000-0000-0000-000000000009'),
('ah000001-0000-0000-0000-000000000013', 'ap000001-0000-0000-0000-000000000010', 'CHECKED_IN','COMPLETED', 'u0000001-0000-0000-0000-000000000003');

-- =============================================================
-- visits (từ appointment COMPLETED)
-- =============================================================
INSERT INTO visits (id, appointment_id, patient_id, doctor_id, room_id, queue_number, status, called_at, started_at, completed_at) VALUES
('vi000001-0000-0000-0000-000000000001', 'ap000001-0000-0000-0000-000000000004', 'pt000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000003', 'r0000001-0000-0000-0000-000000000001', 'PK01-001', 'COMPLETED',
 DATE_SUB(NOW(), INTERVAL 23 HOUR),
 DATE_SUB(NOW(), INTERVAL 22 HOUR),
 DATE_SUB(NOW(), INTERVAL 21 HOUR)),
('vi000001-0000-0000-0000-000000000010', 'ap000001-0000-0000-0000-000000000010', 'pt000001-0000-0000-0000-000000000010', 'u0000001-0000-0000-0000-000000000003', 'r0000001-0000-0000-0000-000000000001', 'PK01-002', 'COMPLETED',
 DATE_SUB(NOW(), INTERVAL 3 DAY),
 DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 20 MINUTE),
 DATE_ADD(DATE_SUB(NOW(), INTERVAL 3 DAY), INTERVAL 55 MINUTE));

-- =============================================================
-- examination_results
-- =============================================================
INSERT INTO examination_results (id, visit_id, diagnosis, clinical_note, treatment_result, follow_up_date, access_code, access_code_expires_at, created_by) VALUES
('er000001-0000-0000-0000-000000000001', 'vi000001-0000-0000-0000-000000000001',
 'Viêm dạ dày cấp tính',
 'Bệnh nhân đau thượng vị, buồn nôn. Ấn đau vùng thượng vị. Không có dấu hiệu xuất huyết tiêu hóa.',
 'Điều trị nội khoa, uống thuốc đều đặn, ăn nhẹ, tránh thức ăn cay nóng.',
 DATE_ADD(CURDATE(), INTERVAL 14 DAY),
 'KQ-LC-001234',
 DATE_ADD(NOW(), INTERVAL 30 DAY),
 'u0000001-0000-0000-0000-000000000003'),
('er000001-0000-0000-0000-000000000010', 'vi000001-0000-0000-0000-000000000010',
 'Viêm mũi họng cấp trên nền cơ địa dị ứng',
 'Niêm mạc mũi sung huyết nhẹ, họng đỏ nhẹ, không giả mạc. Phổi thông khí đều, không ran. Sinh hiệu ổn định.',
 'Điều trị triệu chứng, vệ sinh mũi bằng nước muối sinh lý, dùng kháng histamine buổi tối và theo dõi tại nhà.',
 DATE_ADD(CURDATE(), INTERVAL 7 DAY),
 'KQ-LC-001010',
 DATE_ADD(NOW(), INTERVAL 30 DAY),
 'u0000001-0000-0000-0000-000000000003');

-- =============================================================
-- cls_orders
-- =============================================================
INSERT INTO cls_orders (id, visit_id, cls_room_id, service_id, note, status, created_by) VALUES
('co000001-0000-0000-0000-000000000001', 'vi000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000003', 'Kiểm tra công thức máu và sinh hóa cơ bản', 'COMPLETED', 'u0000001-0000-0000-0000-000000000003'),
('co000001-0000-0000-0000-000000000010', 'vi000001-0000-0000-0000-000000000010', 'r0000001-0000-0000-0000-000000000003', 'sv000001-0000-0000-0000-000000000003', 'Công thức máu để loại trừ nhiễm khuẩn cấp', 'COMPLETED', 'u0000001-0000-0000-0000-000000000003');

-- =============================================================
-- cls_results
-- =============================================================
INSERT INTO cls_results (id, cls_order_id, result_data, summary, created_by) VALUES
('cr000001-0000-0000-0000-000000000001', 'co000001-0000-0000-0000-000000000001',
 '{"WBC": 8.5, "RBC": 4.8, "HGB": 14.2, "HCT": 42.1, "PLT": 250, "glucose": 5.2, "creatinine": 85, "ALT": 32, "AST": 28}',
 'Kết quả trong giới hạn bình thường. Không phát hiện bất thường đáng kể.',
 'u0000001-0000-0000-0000-000000000006'),
('cr000001-0000-0000-0000-000000000010', 'co000001-0000-0000-0000-000000000010',
 '{"WBC": 7.2, "RBC": 4.5, "HGB": 13.1, "HCT": 39.8, "PLT": 275, "NEU_percent": 58, "LYM_percent": 34}',
 'Công thức máu trong giới hạn bình thường, chưa gợi ý nhiễm khuẩn cấp.',
 'u0000001-0000-0000-0000-000000000006');

-- =============================================================
-- prescriptions
-- =============================================================
INSERT INTO prescriptions (id, visit_id, note, created_by) VALUES
('pr000001-0000-0000-0000-000000000001', 'vi000001-0000-0000-0000-000000000001', 'Uống thuốc đúng giờ, sau bữa ăn. Tái khám sau 2 tuần nếu không thuyên giảm.', 'u0000001-0000-0000-0000-000000000003'),
('pr000001-0000-0000-0000-000000000010', 'vi000001-0000-0000-0000-000000000010', 'Uống thuốc theo hướng dẫn, rửa mũi mỗi ngày và tránh bụi/phấn hoa trong thời gian điều trị.', 'u0000001-0000-0000-0000-000000000003');

-- =============================================================
-- prescription_items
-- =============================================================
INSERT INTO prescription_items (id, prescription_id, medicine_id, dosage, frequency, duration_days, instruction, sort_order) VALUES
('pi000001-0000-0000-0000-000000000001', 'pr000001-0000-0000-0000-000000000001', 'md000001-0000-0000-0000-000000000004', '20mg', '1 lần/ngày', 14, 'Uống trước ăn 30 phút, buổi sáng', 1),
('pi000001-0000-0000-0000-000000000002', 'pr000001-0000-0000-0000-000000000001', 'md000001-0000-0000-0000-000000000001', '500mg','3 lần/ngày', 5,  'Uống sau ăn khi đau', 2),
('pi000001-0000-0000-0000-000000000010', 'pr000001-0000-0000-0000-000000000010', 'md000001-0000-0000-0000-000000000007', '10mg', '1 lần/ngày', 7, 'Uống buổi tối sau ăn, tránh lái xe nếu buồn ngủ', 1),
('pi000001-0000-0000-0000-000000000011', 'pr000001-0000-0000-0000-000000000010', 'md000001-0000-0000-0000-000000000005', '500mg', '1 lần/ngày', 7, 'Uống sau ăn sáng', 2);

-- =============================================================
-- invoices
-- =============================================================
INSERT INTO invoices (id, appointment_id, patient_id, invoice_code, subtotal, discount, total, amount_due, payment_status, payment_method, paid_at, created_by) VALUES
('inv00001-0000-0000-0000-000000000001', 'ap000001-0000-0000-0000-000000000004', 'pt000001-0000-0000-0000-000000000003',
 'INV-20240101-0001', 650000, 0, 650000, 650000, 'PAID', 'CASH', DATE_SUB(NOW(), INTERVAL 20 HOUR), 'u0000001-0000-0000-0000-000000000002');

-- =============================================================
-- invoice_items
-- =============================================================
INSERT INTO invoice_items (id, invoice_id, item_type, service_ref_id, cls_ref_id, medicine_ref_id, name, unit_price, quantity, amount) VALUES
('ii000001-0000-0000-0000-000000000001', 'inv00001-0000-0000-0000-000000000001', 'SERVICE', 'sv000001-0000-0000-0000-000000000001', NULL, NULL, 'Khám Nội tổng quát',     150000, 1, 150000),
('ii000001-0000-0000-0000-000000000002', 'inv00001-0000-0000-0000-000000000001', 'CLS',     NULL, 'co000001-0000-0000-0000-000000000001', NULL, 'Xét nghiệm máu toàn bộ', 250000, 1, 250000),
('ii000001-0000-0000-0000-000000000003', 'inv00001-0000-0000-0000-000000000001', 'MEDICINE',NULL, NULL, 'pi000001-0000-0000-0000-000000000001',        'Omeprazole 20mg',        8000,  14, 112000),
('ii000001-0000-0000-0000-000000000004', 'inv00001-0000-0000-0000-000000000001', 'MEDICINE',NULL, NULL, 'pi000001-0000-0000-0000-000000000002',        'Paracetamol 500mg',      2000,  15, 30000);

-- Kiểm tra tổng: 150000 + 250000 + 112000 + 30000 = 542000 != 650000
-- Cần update subtotal/total/amount_due cho đúng (amount_due = total)
UPDATE invoices SET subtotal = 542000, total = 542000, amount_due = 542000
WHERE id = 'inv00001-0000-0000-0000-000000000001';

-- =============================================================
-- supply_categories
-- =============================================================
INSERT INTO supply_categories (id, name, description, created_by) VALUES
('sc000001-0000-0000-0000-000000000001', 'Vật tư tiêu hao',   'Kim tiêm, bông, gạc, găng tay...', 'u0000001-0000-0000-0000-000000000001'),
('sc000001-0000-0000-0000-000000000002', 'Thiết bị y tế',     'Máy đo huyết áp, nhiệt kế...',     'u0000001-0000-0000-0000-000000000001'),
('sc000001-0000-0000-0000-000000000003', 'Hóa chất xét nghiệm','Reagent, hóa chất phân tích...',   'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- suppliers
-- =============================================================
INSERT INTO suppliers (id, name, phone, email, address, created_by) VALUES
('sup00001-0000-0000-0000-000000000001', 'Công ty TNHH Medipharco',    '02838001234', 'order@medipharco.vn',  '123 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM', 'u0000001-0000-0000-0000-000000000001'),
('sup00001-0000-0000-0000-000000000002', 'Công ty CP Thiết Bị Y Tế VN','02839005678', 'sales@meddevice.vn',   '456 Hoàng Văn Thụ, Q.Phú Nhuận, TP.HCM',  'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- supplies
-- =============================================================
INSERT INTO supplies (id, category_id, name, unit, current_stock, min_stock_level, created_by) VALUES
('sy000001-0000-0000-0000-000000000001', 'sc000001-0000-0000-0000-000000000001', 'Kim tiêm 5ml',       'CAI',  500, 100, 'u0000001-0000-0000-0000-000000000001'),
('sy000001-0000-0000-0000-000000000002', 'sc000001-0000-0000-0000-000000000001', 'Găng tay cao su M',  'KHAC', 300, 50,  'u0000001-0000-0000-0000-000000000001'),
('sy000001-0000-0000-0000-000000000003', 'sc000001-0000-0000-0000-000000000001', 'Gạc vô trùng 10x10', 'KHAC', 1000,200, 'u0000001-0000-0000-0000-000000000001'),
('sy000001-0000-0000-0000-000000000004', 'sc000001-0000-0000-0000-000000000003', 'Reagent CBC',        'BO',   20,  5,   'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- supply_imports
-- =============================================================
INSERT INTO supply_imports (id, supplier_id, import_date, total_value, note, created_by) VALUES
('si000001-0000-0000-0000-000000000001', 'sup00001-0000-0000-0000-000000000001', CURDATE(), 15000000, 'Nhập vật tư tháng này', 'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- supply_import_items
-- =============================================================
INSERT INTO supply_import_items (id, import_id, supply_id, quantity, unit_price, expiry_date) VALUES
('sii00001-0000-0000-0000-000000000001', 'si000001-0000-0000-0000-000000000001', 'sy000001-0000-0000-0000-000000000001', 500, 5000,  DATE_ADD(CURDATE(), INTERVAL 2 YEAR)),
('sii00001-0000-0000-0000-000000000002', 'si000001-0000-0000-0000-000000000001', 'sy000001-0000-0000-0000-000000000002', 300, 8000,  DATE_ADD(CURDATE(), INTERVAL 1 YEAR)),
('sii00001-0000-0000-0000-000000000003', 'si000001-0000-0000-0000-000000000001', 'sy000001-0000-0000-0000-000000000003', 1000,2000,  DATE_ADD(CURDATE(), INTERVAL 3 YEAR));

-- =============================================================
-- supply_transactions (IMPORT — trigger sẽ update current_stock)
-- =============================================================
INSERT INTO supply_transactions (id, supply_id, transaction_type, quantity, import_id, created_by) VALUES
('st000001-0000-0000-0000-000000000001', 'sy000001-0000-0000-0000-000000000001', 'IMPORT', 500, 'si000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001'),
('st000001-0000-0000-0000-000000000002', 'sy000001-0000-0000-0000-000000000002', 'IMPORT', 300, 'si000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001'),
('st000001-0000-0000-0000-000000000003', 'sy000001-0000-0000-0000-000000000003', 'IMPORT', 1000,'si000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001');

-- DISTRIBUTE to room
INSERT INTO supply_transactions (id, supply_id, transaction_type, quantity, room_id, note, created_by) VALUES
('st000001-0000-0000-0000-000000000004', 'sy000001-0000-0000-0000-000000000001', 'DISTRIBUTE', -50, 'r0000001-0000-0000-0000-000000000001', 'Cấp phát cho phòng PK-01', 'u0000001-0000-0000-0000-000000000001'),
('st000001-0000-0000-0000-000000000005', 'sy000001-0000-0000-0000-000000000002', 'DISTRIBUTE', -20, 'r0000001-0000-0000-0000-000000000001', 'Cấp phát cho phòng PK-01', 'u0000001-0000-0000-0000-000000000001');

-- =============================================================
-- notification_logs
-- =============================================================
INSERT INTO notification_logs (id, user_id, recipient, channel, type, subject, body, status, sent_at) VALUES
('nl000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000002', 'reception@gmail.com', 'EMAIL', 'TEMP_PASSWORD',
 'Tài khoản hệ thống Clinic',
 'Xin chào, tài khoản của bạn đã được tạo. Mật khẩu tạm thời: TempPass@123',
 'SENT', DATE_SUB(NOW(), INTERVAL 7 DAY)),
('nl000001-0000-0000-0000-000000000002', NULL, '0912345001', 'SMS', 'APPOINTMENT_CONFIRMED',
 NULL,
 'Lich hen cua ban ngay mai luc 08:00 da duoc xac nhan. Ma lich hen: AP-001.',
 'SENT', DATE_SUB(NOW(), INTERVAL 1 DAY));

-- =============================================================
-- system_logs
-- =============================================================
INSERT INTO system_logs (id, user_id, action, module, target_id, detail, ip_address) VALUES
('sl000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'LOGIN',  'USER',        NULL,                                          '{"device": "Chrome/Windows"}', '127.0.0.1'),
('sl000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000001', 'CREATE', 'USER',        'u0000001-0000-0000-0000-000000000002',         '{"role": "RECEPTIONIST"}',    '127.0.0.1'),
('sl000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000002', 'LOGIN',  'USER',        NULL,                                          '{"device": "Firefox/MacOS"}',  '192.168.1.10'),
('sl000001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000002', 'CREATE', 'PATIENT',     'pt000001-0000-0000-0000-000000000001',         '{"patient_code": "BN-20240101-0001"}', '192.168.1.10'),
('sl000001-0000-0000-0000-000000000005', 'u0000001-0000-0000-0000-000000000003', 'CREATE', 'VISIT',       'vi000001-0000-0000-0000-000000000001',         '{"appointment_id": "ap000001-0000-0000-0000-000000000004"}', '192.168.1.20'),
('sl000001-0000-0000-0000-000000000006', 'u0000001-0000-0000-0000-000000000002', 'UPDATE', 'APPOINTMENT', 'ap000001-0000-0000-0000-000000000005',         '{"field": "status", "old": "PENDING", "new": "CANCELLED"}', '192.168.1.10');

-- =============================================================
-- REAL PRODUCTION DATA BACKUP (extracted 2026-08-02)
-- =============================================================
-- The clinic's actual staff roster, medicine/supply catalog, and their
-- specialty/room assignments — captured from clinic-system-db right before
-- that RDS instance was deleted (AWS free tier had run out, avoiding
-- ongoing cost). This is real data (real names, real license numbers from
-- the clinic's professional-practice certificate list), not a dev fixture
-- — kept here, clearly separated from the synthetic fixtures above, so a
-- future restore of the RDS instance can reproduce the actual production
-- state from this file alone (see rooms/services above too — those blocks
-- were already updated in place to the real 16-room/11-service set).
-- Login password for every account below is 'Staff@123' (the system's
-- standard admin-created-staff temp password, must_change_password=1).

-- users: 23 real staff (16 doctors, 4 lab techs, 3 nurses)
INSERT IGNORE INTO users (id, full_name, email, phone, password_hash, id_card, role, specialty_id, is_active, must_change_password) VALUES
('u0000002-0000-0000-0000-000000000001', 'Bùi Minh Tiến', 'buiminhtien@aucophuha.vn', '0900001001', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000017', 'Bùi Thị Thu Ngân', 'buithithungan@aucophuha.vn', '0900001017', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000022', 'Đinh Thị Ngân', 'dinhthingan@aucophuha.vn', '0900001022', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'NURSE', 'sp000002-0000-0000-0000-000000000002', 1, 1),
('u0000002-0000-0000-0000-000000000006', 'Đỗ Quang Thúy', 'doquangthuy@aucophuha.vn', '0900001006', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000002-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000008', 'Đoàn Hồng Minh', 'doanhongminh@aucophuha.vn', '0900001008', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000002-0000-0000-0000-000000000002', 1, 1),
('u0000002-0000-0000-0000-000000000010', 'Hà Văn Lực', 'havanluc@aucophuha.vn', '0900001010', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000009', 'Khuất Hữu Thanh', 'khuathuuthanh@aucophuha.vn', '0900001009', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000003-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000002', 'Lê Hữu Toàn', 'lehuutoan@aucophuha.vn', '0900001002', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000012', 'Lê Thị Lộc', 'lethiloc@aucophuha.vn', '0900001012', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000003-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000011', 'Lê Thị Minh Ngọc', 'lethiminhngoc@aucophuha.vn', '0900001011', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000013', 'Lê Thị Thanh Thể', 'lethithanhthe@aucophuha.vn', '0900001013', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'LAB_TECH', 'sp000003-0000-0000-0000-000000000002', 1, 1),
('u0000002-0000-0000-0000-000000000016', 'Ngô Tiến Đạt', 'ngotiendat@aucophuha.vn', '0900001016', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'LAB_TECH', 'sp000003-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000020', 'Nguyễn Khánh Huyền', 'nguyenkhanhhuyen@aucophuha.vn', '0900001020', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'LAB_TECH', 'sp000003-0000-0000-0000-000000000002', 1, 1),
('u0000002-0000-0000-0000-000000000023', 'Nguyễn Quang Huy', 'nguyenquanghuy@aucophuha.vn', '0900001023', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000002-0000-0000-0000-000000000004', 1, 1),
('u0000002-0000-0000-0000-000000000014', 'Nguyễn Thị Duyên', 'nguyenthiduyen@aucophuha.vn', '0900001014', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000021', 'Nguyễn Thị Hương Thảo', 'nguyenthihuongthao@aucophuha.vn', '0900001021', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'NURSE', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000018', 'Nguyễn Trọng Hiếu', 'nguyentronghieu@aucophuha.vn', '0900001018', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000007', 'Phan Thị Chinh', 'phanthichinh@aucophuha.vn', '0900001007', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000002-0000-0000-0000-000000000005', 1, 1),
('u0000002-0000-0000-0000-000000000003', 'Phùng Đức Thành', 'phungducthanh@aucophuha.vn', '0900001003', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000002-0000-0000-0000-000000000004', 1, 1),
('u0000002-0000-0000-0000-000000000015', 'Tống Anh Tuấn', 'tonganhtuan@aucophuha.vn', '0900001015', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'LAB_TECH', 'sp000003-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000004', 'Trần Thị Liêm', 'tranthiliem@aucophuha.vn', '0900001004', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000019', 'Trần Thị Tú Linh', 'tranthitulinh@aucophuha.vn', '0900001019', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'NURSE', 'sp000001-0000-0000-0000-000000000001', 1, 1),
('u0000002-0000-0000-0000-000000000005', 'Từ Thị Hoa', 'tuthihoa@aucophuha.vn', '0900001005', '$2b$10$hogmXNPVe7stz5N4hZJl3euIyaEEhnPTl9hwkOUn6lTN4XEqPoOvK', NULL, 'DOCTOR', 'sp000001-0000-0000-0000-000000000001', 1, 1);

-- doctor_profiles: 16 real doctors (certification = số CCHN từ danh sách hành nghề)
INSERT IGNORE INTO doctor_profiles (id, user_id, specialty_id, subspecialty, degree, certification, years_experience, biography) VALUES
('dp000002-0000-0000-0000-000000000001', 'u0000002-0000-0000-0000-000000000001', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa', 'Bác sĩ', 'Số CCHN: 000169/PT-CCHN', NULL, 'Trưởng phòng khám.'),
('dp000002-0000-0000-0000-000000000002', 'u0000002-0000-0000-0000-000000000002', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh Nội khoa', 'Bác sĩ CKI', 'Số CCHN: 001761/PT-CCHN', NULL, 'Phụ trách Phòng Nội.'),
('dp000002-0000-0000-0000-000000000003', 'u0000002-0000-0000-0000-000000000003', 'sp000002-0000-0000-0000-000000000004', 'Khám, chữa bệnh CK Ngoại', 'Bác sĩ CKI', 'Số CCHN: 000168/PT-CCHN', NULL, 'Phụ trách Phòng Ngoại.'),
('dp000002-0000-0000-0000-000000000004', 'u0000002-0000-0000-0000-000000000004', 'sp000001-0000-0000-0000-000000000001', 'Khám, chữa bệnh đa khoa', 'Thạc sĩ Y học', 'Số CCHN: 000909/PT-CCHN', NULL, 'Phụ trách Phòng Nội.'),
('dp000002-0000-0000-0000-000000000005', 'u0000002-0000-0000-0000-000000000005', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa', 'Bác sĩ CKI', 'Số CCHN: 0002690/PT-CCHN', NULL, 'Phụ trách Phòng Nội.'),
('dp000002-0000-0000-0000-000000000006', 'u0000002-0000-0000-0000-000000000006', 'sp000002-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh CK Tai Mũi Họng', 'Bác sĩ CKI', 'Số CCHN: 000862/PT-CCHN', NULL, 'Phụ trách Phòng Tai Mũi Họng.'),
('dp000002-0000-0000-0000-000000000007', 'u0000002-0000-0000-0000-000000000007', 'sp000002-0000-0000-0000-000000000005', 'Khám bệnh, chữa bệnh chuyên ngành Nhãn khoa', 'Bác sĩ CKI', 'Số CCHN: 0002504/PT-CCHN', NULL, 'Phụ trách Phòng Mắt.'),
('dp000002-0000-0000-0000-000000000008', 'u0000002-0000-0000-0000-000000000008', 'sp000002-0000-0000-0000-000000000002', 'Khám bệnh, chữa bệnh chuyên khoa Sản phụ khoa', 'Bác sĩ', 'Số CCHN: 002154/PT-CCHN', NULL, 'Phụ trách Phòng Sản.'),
('dp000002-0000-0000-0000-000000000009', 'u0000002-0000-0000-0000-000000000009', 'sp000003-0000-0000-0000-000000000001', 'Chuyên khoa chẩn đoán hình ảnh', 'Bác sĩ CKI', 'Số CCHN: 0028226/BYT-CCHN', NULL, 'Phụ trách Chẩn đoán hình ảnh.'),
('dp000002-0000-0000-0000-000000000010', 'u0000002-0000-0000-0000-000000000010', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa', 'Bác sĩ', 'Số CCHN: 0001985/LCH-CCHN', NULL, 'Phụ trách phòng Nội soi tiêu hóa.'),
('dp000002-0000-0000-0000-000000000011', 'u0000002-0000-0000-0000-000000000011', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa', 'Bác sĩ CKI', 'Số CCHN: 0004881/PT-CCHN', NULL, 'Làm việc bán thời gian tại phòng khám: Thứ 7, Chủ nhật 07:00-17:30 (đăng ký hành nghề tại cơ sở khác các ngày trong tuần, 07:00-17:00 T2-T6).'),
('dp000002-0000-0000-0000-000000000012', 'u0000002-0000-0000-0000-000000000012', 'sp000003-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa; Thực hiện kỹ thuật siêu âm tổng quát; Khám, chữa bệnh chuyên khoa Chẩn đoán hình ảnh', 'Bác sĩ', 'Số CCHN: 0005195/PT-CCHN', NULL, NULL),
('dp000002-0000-0000-0000-000000000013', 'u0000002-0000-0000-0000-000000000014', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh đa khoa', 'Bác sĩ', 'Số CCHN: 0007688/PT-CCHN', NULL, 'Phụ trách phòng Cấp cứu.'),
('dp000002-0000-0000-0000-000000000014', 'u0000002-0000-0000-0000-000000000017', 'sp000001-0000-0000-0000-000000000001', 'Phát hiện và xử trí các bệnh thông thường, xử trí ban đầu một số trường hợp cấp cứu tại cộng đồng', 'Bác sĩ', 'Số CCHN: 0007032/HD-CCHN', NULL, NULL),
('dp000002-0000-0000-0000-000000000015', 'u0000002-0000-0000-0000-000000000018', 'sp000001-0000-0000-0000-000000000001', 'Khám bệnh, chữa bệnh Hồi sức; gây mê hồi sức', 'Bác sĩ CKI', 'Số CCHN: 001659/PT-CCHN', NULL, 'Làm việc bán thời gian: Thứ 4, Thứ 7 07:00-17:30 (đăng ký hành nghề tại cơ sở khác các ngày còn lại).'),
('dp000002-0000-0000-0000-000000000016', 'u0000002-0000-0000-0000-000000000023', 'sp000002-0000-0000-0000-000000000004', 'Khám bệnh, chữa bệnh ngoại khoa', 'Bác sĩ CKI', 'Số CCHN: 001741/PT-CCHN', NULL, 'Phụ trách Phòng Ngoại.');

-- supplies: 18 common medical supplies added 2026-08-01/02
INSERT IGNORE INTO supplies (id, category_id, name, unit, current_stock, min_stock_level, created_by) VALUES
('sy000002-0000-0000-0000-000000000002', 'sc000001-0000-0000-0000-000000000001', 'Băng dính y tế', 'CAI', 0, 20, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000003', 'sc000001-0000-0000-0000-000000000001', 'Băng gạc cuộn', 'CAI', 0, 20, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000006', 'sc000001-0000-0000-0000-000000000001', 'Bơm tiêm 10ml', 'CAI', 0, 100, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000007', 'sc000001-0000-0000-0000-000000000001', 'Bơm tiêm 5ml', 'CAI', 0, 100, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000001', 'sc000001-0000-0000-0000-000000000001', 'Bông y tế', 'HOP', 0, 20, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000004', 'sc000001-0000-0000-0000-000000000001', 'Cồn 70 độ sát trùng', 'CHAI', 0, 10, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000012', 'sc000001-0000-0000-0000-000000000001', 'Dây truyền dịch', 'BO', 0, 50, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000005', 'sc000001-0000-0000-0000-000000000001', 'Dung dịch Povidine sát trùng', 'CHAI', 0, 10, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000013', 'sc000001-0000-0000-0000-000000000001', 'Dung dịch sát khuẩn tay nhanh', 'CHAI', 0, 10, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000009', 'sc000001-0000-0000-0000-000000000001', 'Găng tay y tế size L', 'KHAC', 0, 100, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000008', 'sc000001-0000-0000-0000-000000000001', 'Găng tay y tế size S', 'KHAC', 0, 100, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000010', 'sc000001-0000-0000-0000-000000000001', 'Khẩu trang y tế', 'HOP', 0, 20, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000011', 'sc000001-0000-0000-0000-000000000001', 'Kim luồn tĩnh mạch', 'CAI', 0, 50, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000016', 'sc000001-0000-0000-0000-000000000002', 'Máy đo huyết áp', 'CAI', 0, 2, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000015', 'sc000001-0000-0000-0000-000000000002', 'Nhiệt kế điện tử', 'CAI', 0, 5, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000014', 'sc000001-0000-0000-0000-000000000002', 'Ống nghe y tế', 'CAI', 0, 2, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000017', 'sc000001-0000-0000-0000-000000000003', 'Ống nghiệm xét nghiệm máu (EDTA)', 'HOP', 0, 20, 'u0000001-0000-0000-0000-000000000001'),
('sy000002-0000-0000-0000-000000000018', 'sc000001-0000-0000-0000-000000000003', 'Que test đường huyết nhanh', 'HOP', 0, 10, 'u0000001-0000-0000-0000-000000000001');

-- medicines: 27 common medicines added 2026-08-01/02 (draft approved by clinic 2026-08-02)
INSERT IGNORE INTO medicines (id, name, active_ingredient, dosage_form, unit, price, contraindications, created_by) VALUES
('md000002-0000-0000-0000-000000000023', 'Alpha Chymotrypsin 4200 đơn vị', 'Alpha Chymotrypsin', 'Viên nén', 'VIEN', 1500, 'Rối loạn đông máu', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000009', 'Amlodipine 5mg', 'Amlodipine', 'Viên nén', 'VIEN', 3000, 'Hạ huyết áp nặng, sốc tim', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000017', 'Antacid nhôm-magie', 'Nhôm hydroxit, Magie hydroxit', 'Gói hỗn dịch', 'GOI', 3500, 'Suy thận nặng', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000018', 'Atorvastatin 10mg', 'Atorvastatin', 'Viên nén', 'VIEN', 4000, 'Bệnh gan hoạt động, phụ nữ có thai', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000002', 'Azithromycin 250mg', 'Azithromycin', 'Viên nén', 'VIEN', 8000, 'Suy gan nặng', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000022', 'Betahistine 16mg', 'Betahistine', 'Viên nén', 'VIEN', 2500, 'U tủy thượng thận (Pheochromocytoma)', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000025', 'Betamethasone + Clotrimazole kem', 'Betamethasone, Clotrimazole', 'Tuýp kem bôi', 'TUYP', 30000, 'Nhiễm virus/nấm da chưa xác định', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000015', 'Bromhexine 8mg', 'Bromhexine HCl', 'Viên nén', 'VIEN', 1500, 'Loét dạ dày tá tràng', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000026', 'Calci + Vitamin D3', 'Calci carbonat, Cholecalciferol', 'Viên sủi', 'VIEN', 2500, 'Tăng calci máu, sỏi thận calci', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000012', 'Cefuroxime 500mg', 'Cefuroxime axetil', 'Viên nén', 'VIEN', 12000, 'Dị ứng Cephalosporin', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000001', 'Cephalexin 500mg', 'Cephalexin', 'Viên nang', 'VIEN', 4500, 'Dị ứng Cephalosporin', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000014', 'Dextromethorphan 15mg', 'Dextromethorphan', 'Viên nén', 'VIEN', 1500, 'Đang dùng thuốc ức chế MAO', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000010', 'Diclofenac gel', 'Diclofenac', 'Tuýp gel bôi', 'TUYP', 25000, 'Vết thương hở', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000003', 'Domperidone 10mg', 'Domperidone', 'Viên nén', 'VIEN', 2000, 'Xuất huyết tiêu hóa, bệnh tim nặng', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000013', 'Doxycycline 100mg', 'Doxycycline', 'Viên nang', 'VIEN', 3000, 'Phụ nữ có thai, trẻ dưới 8 tuổi', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000016', 'Esomeprazole 40mg', 'Esomeprazole', 'Viên nang', 'VIEN', 9000, 'Dùng chung với Rilpivirine', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000020', 'Gliclazide 80mg', 'Gliclazide', 'Viên nén', 'VIEN', 3000, 'Đái tháo đường type 1, suy thận nặng', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000004', 'Loperamide 2mg', 'Loperamide', 'Viên nang', 'VIEN', 2500, 'Tiêu chảy nhiễm khuẩn có sốt', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000006', 'Loratadine 10mg', 'Loratadine', 'Viên nén', 'VIEN', 3000, NULL, 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000019', 'Losartan 50mg', 'Losartan Kali', 'Viên nén', 'VIEN', 3500, 'Phụ nữ có thai', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000024', 'Natri Clorid 0.9% nhỏ mắt', 'Natri Clorid', 'Chai nhỏ mắt', 'CHAI', 8000, NULL, 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000005', 'Oresol (ORS)', 'Muối bù nước điện giải', 'Gói bột pha', 'GOI', 3000, 'Tắc ruột', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000011', 'Povidone-iodine 10%', 'Povidone-iodine', 'Chai dung dịch', 'CHAI', 20000, 'Cường giáp, dị ứng iod', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000021', 'Prednisolone 5mg', 'Prednisolone', 'Viên nén', 'VIEN', 1000, 'Nhiễm nấm toàn thân, loét dạ dày tiến triển', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000007', 'Salbutamol xịt', 'Salbutamol', 'Bình xịt định liều', 'LO', 45000, 'Rối loạn nhịp tim', 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000008', 'Vitamin 3B', 'Vitamin B1, B6, B12', 'Viên nén', 'VIEN', 2000, NULL, 'u0000001-0000-0000-0000-000000000001'),
('md000002-0000-0000-0000-000000000027', 'Vitamin D3 1000IU', 'Cholecalciferol', 'Viên nang', 'VIEN', 2000, 'Tăng calci máu', 'u0000001-0000-0000-0000-000000000001');

SET FOREIGN_KEY_CHECKS = 1;
