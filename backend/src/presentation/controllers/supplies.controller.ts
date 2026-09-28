import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CreateSupplyDto } from '../../application/dtos/supplies/create-supply.dto';
import { DistributeSupplyDto } from '../../application/dtos/supplies/distribute-supply.dto';
import { ImportSuppliesDto } from '../../application/dtos/supplies/import-supplies.dto';
import { ListSuppliesQueryDto } from '../../application/dtos/supplies/list-supplies-query.dto';
import { ListSupplyTransactionsQueryDto } from '../../application/dtos/supplies/list-supply-transactions-query.dto';
import { UpdateSupplyDto } from '../../application/dtos/supplies/update-supply.dto';
import { UNIT_LABEL_VI } from '../../application/errors/application-error';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreateSupplyUseCase } from '../../application/use-cases/supplies/create-supply.use-case';
import { DeleteSupplyUseCase } from '../../application/use-cases/supplies/delete-supply.use-case';
import { DistributeSupplyUseCase } from '../../application/use-cases/supplies/distribute-supply.use-case';
import { ImportSuppliesUseCase } from '../../application/use-cases/supplies/import-supplies.use-case';
import { ListSuppliesUseCase } from '../../application/use-cases/supplies/list-supplies.use-case';
import { ListSupplyTransactionsUseCase } from '../../application/use-cases/supplies/list-supply-transactions.use-case';
import { UpdateSupplyUseCase } from '../../application/use-cases/supplies/update-supply.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';

// Features 23-29 — Supply CRUD + stock movements. Admin-only.
@Controller('supplies')
@Roles(UserRole.ADMIN)
export class SuppliesController {
  constructor(
    private readonly listSuppliesUseCase: ListSuppliesUseCase,
    private readonly createSupplyUseCase: CreateSupplyUseCase,
    private readonly updateSupplyUseCase: UpdateSupplyUseCase,
    private readonly deleteSupplyUseCase: DeleteSupplyUseCase,
    private readonly listSupplyTransactionsUseCase: ListSupplyTransactionsUseCase,
    private readonly importSuppliesUseCase: ImportSuppliesUseCase,
    private readonly distributeSupplyUseCase: DistributeSupplyUseCase,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Get()
  list(@Query() query: ListSuppliesQueryDto) {
    return this.listSuppliesUseCase.execute({
      category: query.category,
      status: query.status,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post()
  @MsgCode(MSG.INFO_0069)
  create(@Body() dto: CreateSupplyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createSupplyUseCase.execute({
      categoryId: dto.categoryId,
      name: dto.name,
      unit: dto.unit,
      minStockLevel: dto.minStockLevel,
      description: dto.description,
      createdBy: user.sub,
    });
  }

  @Put(':id')
  @MsgCode(MSG.INFO_0070)
  update(@Param('id') id: string, @Body() dto: UpdateSupplyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateSupplyUseCase.execute({
      id,
      categoryId: dto.categoryId,
      name: dto.name,
      unit: dto.unit,
      minStockLevel: dto.minStockLevel,
      description: dto.description,
      isActive: dto.isActive,
      updatedBy: user.sub,
    });
  }

  @Get(':id/transactions')
  listTransactions(@Param('id') id: string, @Query() query: ListSupplyTransactionsQueryDto) {
    return this.listSupplyTransactionsUseCase.execute({
      supplyId: id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      type: query.type,
      page: query.page,
      limit: query.limit,
    });
  }

  // MSG.INFO_0071 has a `{current_stock}`/`{unit}` placeholder, which the
  // static @MsgCode decorator can't fill in (it never receives response
  // data) — build the response manually, same approach as
  // appointments.controller.ts's create(). Assumption: with a
  // multi-line import, the confirmation message reports the first line's
  // resulting stock; the full per-line stock breakdown is in the response
  // body for the FE to render precisely.
  @Post('import')
  async import(@Body() dto: ImportSuppliesDto, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.importSuppliesUseCase.execute({
      supplierId: dto.supplierId,
      items: dto.items,
      createdBy: user.sub,
    });
    const first = result.items[0];
    const message = this.messageCatalog.getMessage(MSG.INFO_0071, DEFAULT_LOCALE, {
      current_stock: first?.currentStock ?? 0,
      unit: first?.unit ? (UNIT_LABEL_VI[first.unit] ?? first.unit) : '',
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // MSG.INFO_0072 has `{quantity}`/`{unit}`/`{supply_name}`/`{room_code}`
  // placeholders — same reasoning as import() above. room_code isn't on the
  // response DTO, so roomName is used in its place (still human-readable).
  @Post('distribute')
  async distribute(
    @Body() dto: DistributeSupplyDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.distributeSupplyUseCase.execute({
      supplyId: dto.supplyId,
      roomId: dto.roomId,
      quantity: dto.quantity,
      createdBy: user.sub,
    });
    const message = this.messageCatalog.getMessage(MSG.INFO_0072, DEFAULT_LOCALE, {
      quantity: result.quantity,
      unit: UNIT_LABEL_VI[result.unit] ?? result.unit,
      supply_name: result.supplyName,
      room_code: result.roomName,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.deleteSupplyUseCase.execute({ id, deletedBy: user.sub });
    return null;
  }
}
