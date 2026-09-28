import { Transform, Type } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../pagination.dto';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';

export class ListAppointmentsQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @IsOptional()
  @IsString()
  doctorId?: string;

  // Ignored for a PATIENT caller — ListAppointmentsUseCase always force-scopes
  // a patient to their own resolved patientId regardless of this value (IDOR
  // protection); only ADMIN/RECEPTIONIST/DOCTOR callers get this filter
  // applied as given.
  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsEnum(AppointmentStatus, { each: true })
  statuses?: AppointmentStatus[];

  @IsOptional()
  @IsString()
  search?: string;
}
