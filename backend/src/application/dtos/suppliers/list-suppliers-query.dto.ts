import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Deliberately does NOT extend PaginationDto — see the same note in
// list-medicines-query.dto.ts (its `page = 1` default would break the
// legacy-vs-paginated mode switch in ListSuppliersUseCase).
export class ListSuppliersQueryDto {
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
