import { UserRole } from '../../domain/enums/user-role.enum';

export interface AuthenticatedUser {
  sub: string;
  email?: string;
  role: UserRole;
}
