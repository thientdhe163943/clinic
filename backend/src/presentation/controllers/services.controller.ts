import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CreateServiceDto } from '../../application/dtos/services/create-service.dto';
import { UpdateServiceDto } from '../../application/dtos/services/update-service.dto';
import { PaginationDto } from '../../application/dtos/pagination.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateServiceUseCase } from '../../application/use-cases/services/create-service.use-case';
import { DeleteServiceUseCase } from '../../application/use-cases/services/delete-service.use-case';
import { ListServicesUseCase } from '../../application/use-cases/services/list-services.use-case';
import { UpdateServiceUseCase } from '../../application/use-cases/services/update-service.use-case';
import { ClsRoomCategory } from '../../domain/enums/cls-room-category.enum';
import { ServiceType } from '../../domain/enums/service-type.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

class ListServicesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  type?: ServiceType;

  @IsOptional()
  @IsEnum(ClsRoomCategory)
  clsCategory?: ClsRoomCategory;
}

@Controller('services')
export class ServicesController {
  constructor(
    private readonly listServicesUseCase: ListServicesUseCase,
    private readonly createServiceUseCase: CreateServiceUseCase,
    private readonly updateServiceUseCase: UpdateServiceUseCase,
    private readonly deleteServiceUseCase: DeleteServiceUseCase,
  ) {}

  // Public — the guest-booking form needs the service dropdown before the
  // guest has any session (see appointments.controller.ts's
  // available-doctors/availability-calendar for the same reasoning).
  @Public()
  @Get()
  list(@Query() query: ListServicesQueryDto) {
    return this.listServicesUseCase.execute({
      search: query.search,
      type: query.type,
      clsCategory: query.clsCategory,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0025)
  @SkipAudit()
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createServiceUseCase.execute({
      name: dto.name,
      specialtyId: dto.specialtyId,
      type: dto.type,
      clsCategory: dto.clsCategory,
      price: dto.price,
      description: dto.description,
      createdBy: user.sub,
    });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0026)
  @SkipAudit()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateServiceUseCase.execute({
      id,
      name: dto.name,
      specialtyId: dto.specialtyId,
      type: dto.type,
      clsCategory: dto.clsCategory,
      price: dto.price,
      description: dto.description,
      isActive: dto.isActive,
      updatedBy: user.sub,
    });
  }

  // Was `@HttpCode(HttpStatus.NO_CONTENT)` (204), which can't carry a JSON
  // body — the frontend's `unwrapResult()` (see services.ts) always reads
  // `response.data.{data,message}`, so a bare 204 would already break it in
  // practice. Switched to the standard 200 + `return null` pattern used by
  // every other delete endpoint in this codebase (see e.g.
  // medicines.controller.ts, suppliers.controller.ts,
  // supply-categories.controller.ts) so @MsgCode can attach a message.
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0027)
  @SkipAudit()
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.deleteServiceUseCase.execute({ id, deletedBy: user.sub });
    return null;
  }
}
