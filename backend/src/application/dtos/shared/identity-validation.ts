// Shared field rules for the 4 "identity" fields that recur across every
// patient/account DTO (register, guest-appointment, patients, profile,
// staff users) — kept in one place so the rule itself (10-digit VN phone,
// 12-digit CCCD, họ tên tối đa 100 ký tự — matches the `full_name`
// VARCHAR(100) column) can't drift between DTOs. Mirrors the equivalent
// validators on the frontend (see
// clinic_system_frontend/src/lib/utils/identity-validation.ts).
//
// PHONE_MESSAGE/ID_CARD_MESSAGE hold MSG codes, not literal text — resolved
// by MessageCodeValidationPipe (Phase 3, 2026-08-07 message-system plan).
import { MSG } from '../../../domain/value-objects/message-code.vo';

export const PHONE_REGEX = /^0\d{9}$/;
export const PHONE_MESSAGE = MSG.ERR_0096;

export const ID_CARD_REGEX = /^\d{12}$/;
export const ID_CARD_MESSAGE = MSG.ERR_0097;

export const FULL_NAME_MAX_LENGTH = 100;

// People commonly type CCCD grouped for readability ("0123 4567 8901") —
// strip all whitespace before @Matches(ID_CARD_REGEX) runs so the digits
// themselves are what gets validated, not the formatting. Applied via
// @Transform (class-transformer), which runs before class-validator's
// decorators — mirrors the frontend's sanitizeIdCard() in
// clinic_system_frontend/src/lib/utils/identity-validation.ts, which also
// cleans the value before it's ever sent here (defense in depth: a request
// bypassing the frontend must still be accepted/rejected consistently).
export function stripWhitespace(value: unknown): unknown {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : value;
}
