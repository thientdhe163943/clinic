import { UserRole } from '../../../domain/enums/user-role.enum';

export interface AuthUserDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  role!: UserRole;
  mustChangePassword!: boolean;
  user!: AuthUserDto;
}

// What the HTTP response body actually contains: tokens are sent as httpOnly
// cookies (see infrastructure/auth/cookie.util.ts), never in the JSON body.
export class AuthSessionDto {
  role!: UserRole;
  mustChangePassword!: boolean;
  user!: AuthUserDto;
}
