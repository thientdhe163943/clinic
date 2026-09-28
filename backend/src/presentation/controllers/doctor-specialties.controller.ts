import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { CreateSpecialtyDto } from '../../application/dtos/doctor-specialties/create-specialty.dto';
import { UpdateSpecialtyDto } from '../../application/dtos/doctor-specialties/update-specialty.dto';
import { ListDoctorSpecialtyProfilesQueryDto } from '../../application/dtos/doctor-specialties/list-doctor-specialty-profiles-query.dto';
import { RejectDoctorSpecialtyUpdateDto } from '../../application/dtos/doctor-specialties/reject-doctor-specialty-update.dto';
import { UpdateDoctorSpecialtyDto } from '../../application/dtos/doctor-specialties/update-doctor-specialty.dto';
import { ApproveDoctorSpecialtyUpdateUseCase } from '../../application/use-cases/doctor-specialties/approve-doctor-specialty-update.use-case';
import { CreateSpecialtyUseCase } from '../../application/use-cases/doctor-specialties/create-specialty.use-case';
import { DeleteSpecialtyUseCase } from '../../application/use-cases/doctor-specialties/delete-specialty.use-case';
import { GetMyDoctorSpecialtyUseCase } from '../../application/use-cases/doctor-specialties/get-my-doctor-specialty.use-case';
import { ListDoctorSpecialtyProfilesUseCase } from '../../application/use-cases/doctor-specialties/list-doctor-specialty-profiles.use-case';
import { ListSpecialtiesUseCase } from '../../application/use-cases/doctor-specialties/list-specialties.use-case';
import { RejectDoctorSpecialtyUpdateUseCase } from '../../application/use-cases/doctor-specialties/reject-doctor-specialty-update.use-case';
import { UpdateDoctorSpecialtyProfileUseCase } from '../../application/use-cases/doctor-specialties/update-doctor-specialty-profile.use-case';
import { UpdateMyDoctorSpecialtyUseCase } from '../../application/use-cases/doctor-specialties/update-my-doctor-specialty.use-case';
import { UpdateSpecialtyUseCase } from '../../application/use-cases/doctor-specialties/update-specialty.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

@Controller('doctor-specialties')
export class DoctorSpecialtiesController {
  constructor(
    private readonly listSpecialtiesUseCase: ListSpecialtiesUseCase,
    private readonly createSpecialtyUseCase: CreateSpecialtyUseCase,
    private readonly updateSpecialtyUseCase: UpdateSpecialtyUseCase,
    private readonly deleteSpecialtyUseCase: DeleteSpecialtyUseCase,
    private readonly listDoctorSpecialtyProfilesUseCase: ListDoctorSpecialtyProfilesUseCase,
    private readonly getMyDoctorSpecialtyUseCase: GetMyDoctorSpecialtyUseCase,
    private readonly updateMyDoctorSpecialtyUseCase: UpdateMyDoctorSpecialtyUseCase,
    private readonly updateDoctorSpecialtyProfileUseCase: UpdateDoctorSpecialtyProfileUseCase,
    private readonly approveDoctorSpecialtyUpdateUseCase: ApproveDoctorSpecialtyUpdateUseCase,
    private readonly rejectDoctorSpecialtyUpdateUseCase: RejectDoctorSpecialtyUpdateUseCase,
  ) {}

  @Get('specialties')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.PATIENT)
  listSpecialties() {
    return this.listSpecialtiesUseCase.execute();
  }

  @Post('specialties')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0090)
  createSpecialty(@Body() dto: CreateSpecialtyDto) {
    return this.createSpecialtyUseCase.execute({ name: dto.name, description: dto.description });
  }

  @Put('specialties/:id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0091)
  updateSpecialty(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.updateSpecialtyUseCase.execute({ id, name: dto.name, description: dto.description });
  }

  @Delete('specialties/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @MsgCode(MSG.INFO_0092)
  async deleteSpecialty(@Param('id') id: string): Promise<void> {
    await this.deleteSpecialtyUseCase.execute(id);
  }

  // GET /doctor-specialties/admin/doctors — trang "Quản lý bác sĩ" của Admin:
  // xem danh sách toàn bộ bác sĩ kèm chuyên khoa, có tìm kiếm + phân trang.
  // Chỉ Admin mới gọi được (do @Roles(UserRole.ADMIN)).
  @Get('admin/doctors')
  @Roles(UserRole.ADMIN)
  listDoctorProfiles(@Query() query: ListDoctorSpecialtyProfilesQueryDto) {
    return this.listDoctorSpecialtyProfilesUseCase.execute(query);
  }

  // PUT /doctor-specialties/admin/doctors/:userId — Admin sửa TRỰC TIẾP hồ
  // sơ chuyên khoa của 1 bác sĩ (áp dụng ngay, không cần chờ duyệt — khác
  // với updateMe() bên dưới là do chính bác sĩ tự sửa).
  @Put('admin/doctors/:userId')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0030)
  updateDoctorProfile(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDoctorSpecialtyDto,
  ) {
    return this.updateDoctorSpecialtyProfileUseCase.execute(userId, user.sub, dto);
  }

  @Post('admin/doctors/:userId/approve')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0030)
  approveDoctorProfileUpdate(@Param('userId') userId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.approveDoctorSpecialtyUpdateUseCase.execute(userId, user.sub);
  }

  @Post('admin/doctors/:userId/reject')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0030)
  rejectDoctorProfileUpdate(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectDoctorSpecialtyUpdateDto,
  ) {
    return this.rejectDoctorSpecialtyUpdateUseCase.execute(userId, user.sub, dto);
  }

  // GET /doctor-specialties/me — Bác sĩ xem hồ sơ chuyên khoa của CHÍNH
  // MÌNH. Chỉ vai trò DOCTOR mới gọi được; userId lấy từ token đăng nhập
  // (user.sub), không truyền qua URL nên không thể xem hồ sơ của bác sĩ khác.
  @Get('me')
  @Roles(UserRole.DOCTOR)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.getMyDoctorSpecialtyUseCase.execute(user.sub);
  }

  // PUT /doctor-specialties/me — Bác sĩ TỰ NỘP yêu cầu cập nhật hồ sơ chuyên
  // khoa của mình. Lưu ý: thông tin gửi lên chỉ được lưu ở trạng thái "chờ
  // duyệt", CHƯA áp dụng ngay — phải có Admin duyệt (xem
  // ApproveDoctorSpecialtyUpdateUseCase) thì mới chính thức có hiệu lực.
  @Put('me')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0030)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateDoctorSpecialtyDto) {
    return this.updateMyDoctorSpecialtyUseCase.execute(user.sub, dto);
  }
}
