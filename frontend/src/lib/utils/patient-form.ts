import { validateDateOfBirth, validateEmail, validateFullName, validateIdCard, validatePhone } from '@/lib/utils/identity-validation';
import type { ApiError } from '@/types/api';
import type { CreatePatientRequest } from '@/types/patients';

export interface FormErrors {
  [key: string]: string | undefined;
}

export function validateForm(form: CreatePatientRequest): FormErrors {
  const e: FormErrors = {};
  const fullNameError = validateFullName(form.fullName);
  if (fullNameError) e.fullName = fullNameError;
  const dobError = validateDateOfBirth(form.dateOfBirth);
  if (dobError) e.dateOfBirth = dobError;
  const phoneError = validatePhone(form.phone);
  if (phoneError) e.phone = phoneError;
  const emailError = validateEmail(form.email);
  if (emailError) e.email = emailError;
  const idCardError = validateIdCard(form.idCard);
  if (idCardError) e.idCard = idCardError;
  return e;
}

export function apiToFieldError(err: ApiError): FormErrors {
  const details = err.details as { field?: string; target?: string | string[] } | null;

  // Application-level ConflictError: details.field
  const field = details?.field;
  if (field === 'email') return { email: 'Email này đã được sử dụng' };
  if (field === 'phone') return { phone: 'Số điện thoại này đã được sử dụng' };
  if (field === 'idCard') return { idCard: 'CCCD/CMND này đã được sử dụng' };

  // Prisma P2002 fallback: details.target (index name string or field name array)
  const target = details?.target;
  const targetStr = Array.isArray(target) ? target.join(',') : (target ?? '');
  if (targetStr.includes('email')) return { email: 'Email này đã được sử dụng' };
  if (targetStr.includes('phone')) return { phone: 'Số điện thoại này đã được sử dụng' };
  if (targetStr.includes('id_card') || targetStr.includes('idCard')) return { idCard: 'CCCD/CMND này đã được sử dụng' };

  return {};
}
