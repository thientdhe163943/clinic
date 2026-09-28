import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

// One row of a structured lab-test result — only meaningful when the CLS
// room is category LAB (see ClsRoomCategory); X-quang/Siêu âm rooms just use
// `summary` free text as before.
export class LabResultRowDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  result!: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  normalRange?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class EnterClsResultDto {
  // Holds the "KL" conclusion for every category (the only field for LAB
  // besides `rows`; for X-quang/Siêu âm it's the conclusion shown apart from
  // the descriptive `findings` text below).
  @IsString()
  @MinLength(1)
  summary: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabResultRowDto)
  rows?: LabResultRowDto[];

  // Descriptive findings ("KẾT QUẢ") — only meaningful for XRAY/ULTRASOUND.
  @IsOptional()
  @IsString()
  findings?: string;

  // Two-step save/lock (added so a KTV can save progress repeatedly while
  // still IN_PROGRESS without immediately and irreversibly locking the
  // result). false/omitted: persist the data, order stays IN_PROGRESS and
  // stays editable. true: same persist, plus transition the order to
  // COMPLETED — from that point on, further calls are rejected
  // (ClsResultAlreadyConfirmedError).
  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}
