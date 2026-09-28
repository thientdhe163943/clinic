import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../pagination.dto';

export class ListDoctorSpecialtyProfilesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
