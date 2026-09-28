import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

export class AvailableDoctorsQueryDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @Type(() => Date)
  @IsDate()
  date!: Date;
}
