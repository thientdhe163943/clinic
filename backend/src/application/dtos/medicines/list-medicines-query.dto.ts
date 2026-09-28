import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Deliberately does NOT extend PaginationDto — its `page = 1` default would
// make `page` always defined, breaking ListMedicinesUseCase's legacy
// (bare-array, prescribing-dropdown) vs. paginated (admin-management) mode
// switch, which keys off `page === undefined`.
export class ListMedicinesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
