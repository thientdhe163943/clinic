import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CreatePatientRequestDto } from '../../application/dtos/patients/create-patient.dto';
import { PatientQueryDto } from '../../application/dtos/patients/patient-query.dto';
import { PatientResponseDto } from '../../application/dtos/patients/patient-response.dto';
import { UpdatePatientRequestDto } from '../../application/dtos/patients/update-patient.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreatePatientUseCase } from '../../application/use-cases/patients/create-patient.use-case';
import { GetPatientUseCase } from '../../application/use-cases/patients/get-patient.use-case';
import {
  ListPatientsUseCase,
  PatientListResponseDto,
} from '../../application/use-cases/patients/list-patients.use-case';
import { UpdatePatientUseCase } from '../../application/use-cases/patients/update-patient.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';

@Controller('patients')
export class PatientsController {
  constructor(
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly getPatientUseCase: GetPatientUseCase,
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly updatePatientUseCase: UpdatePatientUseCase,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  findMany(@Query() query: PatientQueryDto): Promise<PatientListResponseDto> {
    return this.listPatientsUseCase.execute(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR)
  findOne(@Param('id') id: string): Promise<PatientResponseDto> {
    return this.getPatientUseCase.execute(id);
  }

  // POST /patients — "Đăng ký hồ sơ bệnh nhân mới" (chỉ Admin/Lễ tân được
  // gọi). Sau khi tạo xong, trả về thông báo thành công có KÈM SỐ MÃ BỆNH
  // NHÂN vừa tạo (ví dụ "Tạo bệnh nhân BN202608050001 thành công") — vì lý
  // do đó không dùng decorator @MsgCode có sẵn (chỉ tạo được thông báo tĩnh,
  // không có chỗ để "chèn" mã bệnh nhân vào), mà phải tự ghép chuỗi thủ công
  // ở đây.
  //
  // MSG.INFO_0018 has a `{patient_code}` placeholder, which the static
  // @MsgCode decorator can't fill in (it never receives response data) —
  // build the response manually here.
  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @SkipAudit()
  async create(
    @Body() dto: CreatePatientRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.createPatientUseCase.execute({ ...dto, actorId: user.sub });
    const message = this.messageCatalog.getMessage(MSG.INFO_0018, DEFAULT_LOCALE, {
      patient_code: result.patientCode,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0005)
  @SkipAudit()
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PatientResponseDto> {
    return this.updatePatientUseCase.execute({ ...dto, id, actorId: user.sub });
  }
}
