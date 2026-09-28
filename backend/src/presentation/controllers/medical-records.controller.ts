import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { MedicalRecordQueryDto } from '../../application/dtos/medical-records/medical-record-query.dto';
import { MedicalRecordDetailDto } from '../../application/dtos/medical-records/medical-record-response.dto';
import { PrintMedicalRecordResponseDto } from '../../application/dtos/medical-records/print-medical-record-response.dto';
import { UpdateMedicalRecordRequestDto } from '../../application/dtos/medical-records/update-medical-record.dto';
import {
  ListMedicalRecordsUseCase,
  MedicalRecordListResponseDto,
} from '../../application/use-cases/medical-records/list-medical-records.use-case';
import { GetMedicalRecordUseCase } from '../../application/use-cases/medical-records/get-medical-record.use-case';
import { PrintMedicalRecordUseCase } from '../../application/use-cases/medical-records/print-medical-record.use-case';
import { UpdateMedicalRecordUseCase } from '../../application/use-cases/medical-records/update-medical-record.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

@Controller('medical-records')
export class MedicalRecordsController {
  constructor(
    private readonly listMedicalRecordsUseCase: ListMedicalRecordsUseCase,
    private readonly getMedicalRecordUseCase: GetMedicalRecordUseCase,
    private readonly updateMedicalRecordUseCase: UpdateMedicalRecordUseCase,
    private readonly printMedicalRecordUseCase: PrintMedicalRecordUseCase,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  findMany(
    @Query() query: MedicalRecordQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MedicalRecordListResponseDto> {
    return this.listMedicalRecordsUseCase.execute(Object.assign(query, { actorId: user.sub, actorRole: user.role }));
  }

  // GET /medical-records/me — Bệnh nhân xem bệnh án CỦA CHÍNH MÌNH (không
  // truyền patientId qua URL, tự suy ra từ tài khoản đang đăng nhập).
  @Get('me')
  @Roles(UserRole.PATIENT)
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<MedicalRecordDetailDto> {
    return this.getMedicalRecordUseCase.executeMine(user.sub);
  }

  // GET /medical-records/:patientId — Xem bệnh án của 1 bệnh nhân cụ thể
  // (dùng bởi Admin/Lễ tân/Bác sĩ, và cả Bệnh nhân nếu patientId trùng với
  // chính mình). Việc "ai được xem của ai" được kiểm tra kỹ bên trong
  // GetMedicalRecordUseCase.ensureCanView() — Controller này KHÔNG tự kiểm
  // tra quyền chi tiết, chỉ chuyển tiếp actorId/actorRole xuống use case xử lý.
  @Get(':patientId')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT)
  findOne(
    @Param('patientId') patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MedicalRecordDetailDto> {
    return this.getMedicalRecordUseCase.execute({ patientId, actorId: user.sub, actorRole: user.role });
  }

  // PUT /medical-records/:patientId — Bác sĩ ghi/cập nhật bệnh án. Chỉ vai
  // trò DOCTOR mới gọi được; use case bên dưới còn kiểm tra thêm điều kiện
  // "bác sĩ này có đang khám bệnh nhân này không" (xem
  // UpdateMedicalRecordUseCase).
  @Put(':patientId')
  @Roles(UserRole.DOCTOR)
  @SkipAudit()
  update(
    @Param('patientId') patientId: string,
    @Body() dto: UpdateMedicalRecordRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MedicalRecordDetailDto> {
    return this.updateMedicalRecordUseCase.execute({ ...dto, patientId, actorId: user.sub, actorRole: user.role });
  }

  // Feature 66: prints a consolidated medical record, JSON-only (no PDF
  // generation). visitIds is a comma-separated query string; omitted/empty
  // means "include all visits".
  @Get(':patientId/print')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  print(
    @Param('patientId') patientId: string,
    @Query('visitIds') visitIds: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PrintMedicalRecordResponseDto> {
    const parsedVisitIds = visitIds
      ? visitIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : undefined;

    return this.printMedicalRecordUseCase.execute({
      patientId,
      visitIds: parsedVisitIds,
      actorId: user.sub,
      actorRole: user.role,
    });
  }
}
