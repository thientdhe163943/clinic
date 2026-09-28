import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { AdminUserResponseDto } from '../../application/dtos/users/admin-user-response.dto';
import { CreateUserDto } from '../../application/dtos/users/create-user.dto';
import { ListUsersQueryDto } from '../../application/dtos/users/list-users-query.dto';
import { UpdateProfileRequestDto } from '../../application/dtos/users/update-profile.dto';
import { UpdateUserDto } from '../../application/dtos/users/update-user.dto';
import { UserProfileResponseDto } from '../../application/dtos/users/user-profile.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreateUserUseCase } from '../../application/use-cases/users/create-user.use-case';
import { GetMyProfileUseCase } from '../../application/use-cases/users/get-my-profile.use-case';
import { ListUsersUseCase, ListUsersResult } from '../../application/use-cases/users/list-users.use-case';
import { ResetUserPasswordUseCase } from '../../application/use-cases/users/reset-user-password.use-case';
import { ToggleUserStatusUseCase } from '../../application/use-cases/users/toggle-user-status.use-case';
import { UpdateMyProfileUseCase } from '../../application/use-cases/users/update-my-profile.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/users/update-user.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';

@Controller('users')
export class UsersController {
  constructor(
    private readonly getMyProfileUseCase: GetMyProfileUseCase,
    private readonly updateMyProfileUseCase: UpdateMyProfileUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly toggleUserStatusUseCase: ToggleUserStatusUseCase,
    private readonly resetUserPasswordUseCase: ResetUserPasswordUseCase,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  // ─── Own profile ────────────────────────────────────────────────────────────

  // "Controller" là nơi tiếp nhận request HTTP từ Frontend gửi lên — nó không
  // tự xử lý nghiệp vụ mà chỉ đóng vai trò "trạm trung chuyển": nhận request,
  // gọi đúng Use Case tương ứng để xử lý, rồi trả kết quả về cho Frontend.
  //
  // Endpoint này tương ứng với "GET /users/me" — khi người dùng bấm vào trang
  // "Hồ sơ cá nhân", Frontend sẽ gọi tới đúng đường dẫn này.
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileResponseDto> {
    // @CurrentUser(): tự động lấy thông tin người dùng ĐANG ĐĂNG NHẬP từ
    // token đăng nhập (JWT) đính kèm trong request — không lấy từ URL hay
    // form nhập, nên người dùng không thể giả mạo để xem hồ sơ người khác.
    // user.sub chính là userId của người đang đăng nhập.
    //
    // Sau khi có userId, giao lại toàn bộ việc xử lý cho GetMyProfileUseCase
    // (nơi chứa logic nghiệp vụ thật sự) — Controller chỉ chuyển tiếp kết quả.
    return this.getMyProfileUseCase.execute(user.sub);
  }

  @Put('me')
  @MsgCode(MSG.INFO_0012)
  updateMe(
    @Body() dto: UpdateProfileRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileResponseDto> {
    return this.updateMyProfileUseCase.execute({ userId: user.sub, ...dto });
  }

  // ─── Admin: User management ─────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN)
  listUsers(@Query() query: ListUsersQueryDto): Promise<ListUsersResult> {
    return this.listUsersUseCase.execute(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0007)
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminUserResponseDto> {
    return this.createUserUseCase.execute(dto, admin.sub);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0013)
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<AdminUserResponseDto> {
    return this.updateUserUseCase.execute(id, dto);
  }

  // MSG.INFO_0014/0015 ("Đã kích hoạt/vô hiệu hóa tài khoản {full_name}.")
  // depend on which way the toggle went, and both carry a `{full_name}`
  // placeholder — the static @MsgCode decorator can't express that, so the
  // response is built manually here (mirroring appointments.controller.ts's
  // `create`). ToggleUserStatusUseCase is a plain isActive boolean flip; it
  // doesn't distinguish a separate "unlock" action from reactivation (it just
  // clears `lockedAt`/`failedLoginCount` as a side effect of reactivating),
  // so MSG.INFO_0016 ("unlock") has no corresponding endpoint here.
  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  async toggleStatus(@Param('id') id: string, @Req() req: RequestWithTrace) {
    const result = await this.toggleUserStatusUseCase.execute(id);
    const msgCode = result.isActive ? MSG.INFO_0014 : MSG.INFO_0015;
    const message = this.messageCatalog.getMessage(msgCode, DEFAULT_LOCALE, { full_name: result.fullName });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Post(':id/reset-password')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0017)
  async resetPassword(@Param('id') id: string): Promise<void> {
    await this.resetUserPasswordUseCase.execute(id);
  }
}
