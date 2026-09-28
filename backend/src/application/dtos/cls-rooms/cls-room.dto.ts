import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';

export class CreateClsRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  techniqueType!: string;

  // Xét nghiệm / X-quang / Siêu âm — required so every CLS room is grouped
  // under a real specialty (see docs on ClsRoomCategory).
  @IsEnum(ClsRoomCategory)
  clsCategory!: ClsRoomCategory;

  @IsOptional()
  @IsString()
  description?: string;

  // Chuyên khoa (Specialty) this CLS room belongs to (e.g. "Chẩn đoán hình
  // ảnh" / "Xét nghiệm"), in addition to clsCategory — for room-picker
  // filtering. `undefined` = leave unchanged on update, `null` = explicitly
  // clear back to unset.
  @IsOptional()
  @IsString()
  specialtyId?: string | null;
}

export class UpdateClsRoomDto extends CreateClsRoomDto {}

export class DeactivateClsRoomDto {
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
