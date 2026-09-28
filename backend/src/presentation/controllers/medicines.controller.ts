import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateMedicineDto } from '../../application/dtos/medicines/create-medicine.dto';
import { ListMedicinesQueryDto } from '../../application/dtos/medicines/list-medicines-query.dto';
import { UpdateMedicineDto } from '../../application/dtos/medicines/update-medicine.dto';
import { CreateMedicineUseCase } from '../../application/use-cases/medicines/create-medicine.use-case';
import { DeleteMedicineUseCase } from '../../application/use-cases/medicines/delete-medicine.use-case';
import { ListMedicinesUseCase } from '../../application/use-cases/medicines/list-medicines.use-case';
import { UpdateMedicineUseCase } from '../../application/use-cases/medicines/update-medicine.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

// Features 70-73. List is Admin+Doctor (Doctor needs it for the prescribing
// dropdown, Feature 73's actor list); mutations are Admin-only.
@Controller('medicines')
export class MedicinesController {
  constructor(
    private readonly listMedicinesUseCase: ListMedicinesUseCase,
    private readonly createMedicineUseCase: CreateMedicineUseCase,
    private readonly updateMedicineUseCase: UpdateMedicineUseCase,
    private readonly deleteMedicineUseCase: DeleteMedicineUseCase,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  list(@Query() query: ListMedicinesQueryDto) {
    return this.listMedicinesUseCase.execute(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0076)
  create(@Body() dto: CreateMedicineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createMedicineUseCase.execute({ ...dto, createdBy: user.sub });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0077)
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateMedicineUseCase.execute({ id, ...dto, updatedBy: user.sub });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0078)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.deleteMedicineUseCase.execute({ id, deletedBy: user.sub });
    return null;
  }
}
