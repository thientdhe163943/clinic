import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class DistributeSupplyDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0123 })
  supplyId: string;

  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0124 })
  roomId: string;

  // Positivity is enforced in DistributeSupplyUseCase via InvalidQuantityError
  // (MSG_ERR_0050) rather than a class-validator decorator — see the same
  // note in import-supplies.dto.ts.
  @Type(() => Number)
  @IsInt()
  quantity: number;
}
