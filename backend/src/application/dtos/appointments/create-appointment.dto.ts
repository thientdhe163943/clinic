import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class CreateAppointmentRequestDto {
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @Type(() => Date)
  @IsDate()
  appointmentTime!: Date;

  @IsOptional()
  @IsString()
  note?: string;
}
