import { IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto {
  // Accepts either an email or a phone number.
  @IsNotEmpty()
  @IsString()
  username!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;
}
