import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class AvailabilityCalendarQueryDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: MSG.ERR_0098 })
  month!: string;
}
