import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { PaginationDto } from '../pagination.dto';

export class ListUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsIn(['active', 'inactive', 'locked'])
  status?: 'active' | 'inactive' | 'locked';
}
