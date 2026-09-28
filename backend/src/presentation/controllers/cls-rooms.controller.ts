import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateClsRoomDto, DeactivateClsRoomDto, UpdateClsRoomDto } from '../../application/dtos/cls-rooms/cls-room.dto';
import { ActivateClsRoomUseCase } from '../../application/use-cases/cls-rooms/activate-cls-room.use-case';
import { CreateClsRoomUseCase } from '../../application/use-cases/cls-rooms/create-cls-room.use-case';
import { DeactivateClsRoomUseCase } from '../../application/use-cases/cls-rooms/deactivate-cls-room.use-case';
import { ListClsRoomsUseCase } from '../../application/use-cases/cls-rooms/list-cls-rooms.use-case';
import { UpdateClsRoomUseCase } from '../../application/use-cases/cls-rooms/update-cls-room.use-case';
import { ClsRoomCategory } from '../../domain/enums/cls-room-category.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../guards/authenticated-user.type';

@Controller('rooms/cls')
@Roles(UserRole.ADMIN)
export class ClsRoomsController {
  constructor(
    private readonly listRooms: ListClsRoomsUseCase,
    private readonly createRoom: CreateClsRoomUseCase,
    private readonly updateRoom: UpdateClsRoomUseCase,
    private readonly activateRoom: ActivateClsRoomUseCase,
    private readonly deactivateRoom: DeactivateClsRoomUseCase,
  ) {}

  @Get()
  list(@Query('status') status?: 'ACTIVE' | 'INACTIVE', @Query('category') category?: ClsRoomCategory) {
    return this.listRooms.execute(status, category);
  }

  @Post()
  @MsgCode(MSG.INFO_0093)
  create(@Body() dto: CreateClsRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createRoom.execute({ ...dto, createdBy: user.sub });
  }

  @Put(':id')
  @MsgCode(MSG.INFO_0094)
  update(@Param('id') id: string, @Body() dto: UpdateClsRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateRoom.execute({ ...dto, id, updatedBy: user.sub });
  }

  @Patch(':id/activate')
  @MsgCode(MSG.INFO_0095)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.activateRoom.execute(id, user.sub);
  }

  @Patch(':id/deactivate')
  @MsgCode(MSG.INFO_0096)
  deactivate(@Param('id') id: string, @Body() dto: DeactivateClsRoomDto, @CurrentUser() user: AuthenticatedUser) {
    return this.deactivateRoom.execute(id, user.sub, dto.confirm);
  }
}
