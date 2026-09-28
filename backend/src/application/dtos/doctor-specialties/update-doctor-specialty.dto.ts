import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class UpdateDoctorSpecialtyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(191)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  specialtyId: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  subspecialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  degree?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  certification?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUrl({ require_protocol: true }, { each: true })
  @MaxLength(500, { each: true })
  certificationFileUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  yearsExperience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  biography?: string;

  @IsOptional()
  @IsString()
  // require_tld: false — internal file servers/CDNs (e.g. http://cdn/x,
  // http://localhost/x) are valid avatar sources here and were rejected by
  // the stricter default, while the frontend's check never enforced a TLD —
  // this was a real FE/BE validation mismatch, not a security boundary.
  @IsUrl({ require_protocol: true, require_tld: false }, { message: MSG.ERR_0102 })
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  avatarUrl?: string;
}
