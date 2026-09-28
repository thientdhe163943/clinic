import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateSupplierDto } from '../../application/dtos/suppliers/create-supplier.dto';
import { ListSuppliersQueryDto } from '../../application/dtos/suppliers/list-suppliers-query.dto';
import { UpdateSupplierDto } from '../../application/dtos/suppliers/update-supplier.dto';
import { CreateSupplierUseCase } from '../../application/use-cases/suppliers/create-supplier.use-case';
import { DeleteSupplierUseCase } from '../../application/use-cases/suppliers/delete-supplier.use-case';
import { ListSuppliersUseCase } from '../../application/use-cases/suppliers/list-suppliers.use-case';
import { UpdateSupplierUseCase } from '../../application/use-cases/suppliers/update-supplier.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

// Features 74-77 — Admin-only.
@Controller('suppliers')
@Roles(UserRole.ADMIN)
export class SuppliersController {
  constructor(
    private readonly listSuppliersUseCase: ListSuppliersUseCase,
    private readonly createSupplierUseCase: CreateSupplierUseCase,
    private readonly updateSupplierUseCase: UpdateSupplierUseCase,
    private readonly deleteSupplierUseCase: DeleteSupplierUseCase,
  ) {}

  @Get()
  list(@Query() query: ListSuppliersQueryDto) {
    return this.listSuppliersUseCase.execute(query);
  }

  @Post()
  @MsgCode(MSG.INFO_0066)
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createSupplierUseCase.execute({ ...dto, createdBy: user.sub });
  }

  @Put(':id')
  @MsgCode(MSG.INFO_0067)
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateSupplierUseCase.execute({ id, ...dto, updatedBy: user.sub });
  }

  @Delete(':id')
  @MsgCode(MSG.INFO_0068)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.deleteSupplierUseCase.execute({ id, deletedBy: user.sub });
    return null;
  }
}
