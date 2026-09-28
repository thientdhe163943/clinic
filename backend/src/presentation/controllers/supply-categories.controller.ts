import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CreateSupplyCategoryDto } from '../../application/dtos/supply-categories/create-supply-category.dto';
import { UpdateSupplyCategoryDto } from '../../application/dtos/supply-categories/update-supply-category.dto';
import { CreateSupplyCategoryUseCase } from '../../application/use-cases/supply-categories/create-supply-category.use-case';
import { DeleteSupplyCategoryUseCase } from '../../application/use-cases/supply-categories/delete-supply-category.use-case';
import { ListSupplyCategoriesUseCase } from '../../application/use-cases/supply-categories/list-supply-categories.use-case';
import { UpdateSupplyCategoryUseCase } from '../../application/use-cases/supply-categories/update-supply-category.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

// Features 78-81 — SupplyCategory CRUD. Admin-only (the Supply module as a
// whole is Admin-only per docs/features/sprint4/12_medical_supply.md).
@Controller('supply-categories')
@Roles(UserRole.ADMIN)
export class SupplyCategoriesController {
  constructor(
    private readonly listSupplyCategoriesUseCase: ListSupplyCategoriesUseCase,
    private readonly createSupplyCategoryUseCase: CreateSupplyCategoryUseCase,
    private readonly updateSupplyCategoryUseCase: UpdateSupplyCategoryUseCase,
    private readonly deleteSupplyCategoryUseCase: DeleteSupplyCategoryUseCase,
  ) {}

  @Get()
  list() {
    return this.listSupplyCategoriesUseCase.execute();
  }

  @Post()
  @MsgCode(MSG.INFO_0063)
  create(@Body() dto: CreateSupplyCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createSupplyCategoryUseCase.execute({
      name: dto.name,
      description: dto.description,
      createdBy: user.sub,
    });
  }

  @Put(':id')
  @MsgCode(MSG.INFO_0064)
  update(@Param('id') id: string, @Body() dto: UpdateSupplyCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateSupplyCategoryUseCase.execute({
      id,
      name: dto.name,
      description: dto.description,
      updatedBy: user.sub,
    });
  }

  @Delete(':id')
  @MsgCode(MSG.INFO_0065)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.deleteSupplyCategoryUseCase.execute({ id, deletedBy: user.sub });
    return null;
  }
}
