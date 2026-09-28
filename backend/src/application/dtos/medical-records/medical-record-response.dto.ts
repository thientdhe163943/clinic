import {
  MedicalRecordDetail,
  MedicalRecordListItem,
} from '../../../domain/repositories/medical-record.repository';

export interface MedicalRecordListItemDto extends MedicalRecordListItem {}

export interface MedicalRecordDetailDto extends MedicalRecordDetail {}

export function toMedicalRecordListItemDto(item: MedicalRecordListItem): MedicalRecordListItemDto {
  return item;
}

export function toMedicalRecordDetailDto(detail: MedicalRecordDetail): MedicalRecordDetailDto {
  return detail;
}
