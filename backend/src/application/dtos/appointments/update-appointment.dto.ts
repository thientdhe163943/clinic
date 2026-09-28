import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class UpdateAppointmentRequestDto {
  // string | null | undefined: undefined (field omitted) means "leave
  // unchanged"; null is an explicit "clear back to unassigned" — the two
  // must stay distinguishable, so this can't collapse to plain `?: string`.
  @IsOptional()
  @IsString()
  doctorId?: string | null;

  @IsOptional()
  @IsString()
  serviceId?: string | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  appointmentTime?: Date;

  @IsOptional()
  @IsString()
  note?: string | null;
}
