import { IsNotEmpty, IsString } from 'class-validator';

export class CancelAppointmentRequestDto {
  @IsNotEmpty()
  @IsString()
  reason!: string;
}
