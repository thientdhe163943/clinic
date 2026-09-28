import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { CreateRoomRequestDto } from '../../application/dtos/rooms/create-room.dto';
import { UpdateRoomRequestDto } from '../../application/dtos/rooms/update-room.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreateRoomUseCase } from '../../application/use-cases/rooms/create-room.use-case';
import { ListRoomsUseCase } from '../../application/use-cases/rooms/list-rooms.use-case';
import { GetRoomByIdUseCase } from '../../application/use-cases/rooms/get-room.use-case';
import { UpdateRoomUseCase } from '../../application/use-cases/rooms/update-room.use-case';
import { ActivateRoomUseCase } from '../../application/use-cases/rooms/activate-room.use-case';
import { DeactivateRoomUseCase } from '../../application/use-cases/rooms/deactivate-room.use-case';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly listRoomsUseCase: ListRoomsUseCase,
    private readonly getRoomByIdUseCase: GetRoomByIdUseCase,
    private readonly createRoomUseCase: CreateRoomUseCase,
    private readonly updateRoomUseCase: UpdateRoomUseCase,
    private readonly activateRoomUseCase: ActivateRoomUseCase,
    private readonly deactivateRoomUseCase: DeactivateRoomUseCase,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Get()
  list() {
    return this.listRoomsUseCase.execute();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getRoomByIdUseCase.execute(id);
  }

  // MSG.INFO_0021 has a `{room_code}` placeholder — build the response
  // manually (see patients.controller.ts's `create` for the same idiom).
  @Post()
  async create(
    @Body() dto: CreateRoomRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.createRoomUseCase.execute({ ...dto, createdBy: user.sub });
    const message = this.messageCatalog.getMessage(MSG.INFO_0021, DEFAULT_LOCALE, { room_code: result.code });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Put(':id')
  @MsgCode(MSG.INFO_0022)
  update(@Param('id') id: string, @Body() dto: UpdateRoomRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateRoomUseCase.execute({ id, ...dto, updatedBy: user.sub });
  }

  // MSG.INFO_0023 has a `{room_code}` placeholder.
  @Patch(':id/activate')
  async activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.activateRoomUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0023, DEFAULT_LOCALE, { room_code: result.code });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // MSG.INFO_0024 has a `{room_code}` placeholder.
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.deactivateRoomUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0024, DEFAULT_LOCALE, { room_code: result.code });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }
}
