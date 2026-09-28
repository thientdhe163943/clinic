import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListPublicServicesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;
}
