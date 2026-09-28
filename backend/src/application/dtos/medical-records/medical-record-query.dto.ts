import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../pagination.dto';

export class MedicalRecordQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
