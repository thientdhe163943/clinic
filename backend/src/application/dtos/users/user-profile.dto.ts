import { UserRole } from '../../../domain/enums/user-role.enum';

export class UserProfileResponseDto {
  id!: string;
  fullName!: string;
  email!: string | null;
  phone!: string;
  idCard!: string | null;
  role!: UserRole;
  mustChangePassword!: boolean;
  createdAt!: Date;
}
