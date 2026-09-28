import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { ListVisitsQueryDto } from '../../application/dtos/visits/list-visits-query.dto';
import { CreateExaminationResultDto } from '../../application/dtos/visits/create-examination-result.dto';
import { UpdateExaminationResultDto } from '../../application/dtos/visits/update-examination-result.dto';
import { UpsertVitalSignsDto } from '../../application/dtos/visits/vital-signs.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { ROOM_REPOSITORY, RoomRepository } from '../../domain/repositories/room.repository';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { VisitStatus } from '../../domain/enums/visit-status.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { ApiResponse } from '../response/api-response';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ListVisitsUseCase } from '../../application/use-cases/visits/list-visits.use-case';
import { ListNurseQueueUseCase } from '../../application/use-cases/visits/list-nurse-queue.use-case';
import { GetVisitQueueContextUseCase } from '../../application/use-cases/visits/get-visit-queue-context.use-case';
import { CallPatientUseCase } from '../../application/use-cases/visits/call-patient.use-case';
import { StartVisitUseCase } from '../../application/use-cases/visits/start-visit.use-case';
import { HoldForResultsUseCase } from '../../application/use-cases/visits/hold-for-results.use-case';
import { MarkNoShowUseCase } from '../../application/use-cases/visits/mark-no-show.use-case';
import { CreateExaminationResultUseCase } from '../../application/use-cases/visits/create-examination-result.use-case';
import { UpdateExaminationResultUseCase } from '../../application/use-cases/visits/update-examination-result.use-case';
import { UpsertVitalSignsUseCase } from '../../application/use-cases/visits/upsert-vital-signs.use-case';
import { GetVitalSignsUseCase } from '../../application/use-cases/visits/get-vital-signs.use-case';
import { CompleteVisitUseCase } from '../../application/use-cases/visits/complete-visit.use-case';
import { GetVisitResultUseCase } from '../../application/use-cases/visits/get-visit-result.use-case';
import { PrintExaminationAdmissionUseCase } from '../../application/use-cases/visits/print-examination-admission.use-case';
import { PrintAllClsOrdersUseCase } from '../../application/use-cases/cls-orders/print-all-cls-orders.use-case';

@Controller('visits')
export class VisitsController {
  constructor(
    private readonly listVisitsUseCase: ListVisitsUseCase,
    private readonly listNurseQueueUseCase: ListNurseQueueUseCase,
    private readonly getVisitQueueContextUseCase: GetVisitQueueContextUseCase,
    private readonly callPatientUseCase: CallPatientUseCase,
    private readonly startVisitUseCase: StartVisitUseCase,
    private readonly holdForResultsUseCase: HoldForResultsUseCase,
    private readonly markNoShowUseCase: MarkNoShowUseCase,
    private readonly createExaminationResultUseCase: CreateExaminationResultUseCase,
    private readonly updateExaminationResultUseCase: UpdateExaminationResultUseCase,
    private readonly upsertVitalSignsUseCase: UpsertVitalSignsUseCase,
    private readonly getVitalSignsUseCase: GetVitalSignsUseCase,
    private readonly completeVisitUseCase: CompleteVisitUseCase,
    private readonly getVisitResultUseCase: GetVisitResultUseCase,
    private readonly printExaminationAdmissionUseCase: PrintExaminationAdmissionUseCase,
    private readonly printAllClsOrdersUseCase: PrintAllClsOrdersUseCase,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  // Feature 15 — List visits for doctor (scoped to own queue + current shift's room).
  // RECEPTIONIST added for version-up 0.2 #4 (reception overview board) —
  // read-only, no queue-action endpoint below grants RECEPTIONIST.
  @Get()
  @Roles(UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
  list(@Query() query: ListVisitsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const doctorId = user.role === UserRole.DOCTOR ? user.sub : query.doctorId;
    return this.listVisitsUseCase.execute({ ...query, doctorId, actorId: user.sub, actorRole: user.role });
  }

  // Nurse queue scoped to the room assigned in today's (or an explicitly
  // requested) work schedule shift.
  @Get('nurse-queue')
  @Roles(UserRole.NURSE)
  nurseQueue(
    @Query('status') status: string | undefined,
    @Query() query: ListVisitsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const statusFilter = status && (Object.values(VisitStatus) as string[]).includes(status)
      ? (status as VisitStatus)
      : undefined;
    return this.listNurseQueueUseCase.execute(user.sub, statusFilter, query.date, query.shift);
  }

  // Which room/shift the caller is currently staffing, so the queue screen
  // can show "Phòng X · Ca sáng" and a proper "not on shift" empty state.
  // RECEPTIONIST added for version-up 0.2 #4 — read-only.
  @Get('queue-context')
  @Roles(UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
  getQueueContext(@Query() query: ListVisitsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.getVisitQueueContextUseCase.execute(user.sub, user.role, query.date, query.shift);
  }

  // Feature 16 — Call patient into exam room, Waiting/NoShow -> Called.
  // INFO_0044 has `{patient_name}`/`{room_code}` placeholders — the static
  // @MsgCode decorator can't fill those in (it never sees response data), so
  // build the response manually here, same approach as
  // AppointmentsController.create.
  @Patch(':id/call')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @SkipAudit()
  async callPatient(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.callPatientUseCase.execute(id, user.sub);
    const room = await this.roomRepository.findById(result.roomId);
    const message = this.messageCatalog.getMessage(MSG.INFO_0044, DEFAULT_LOCALE, {
      patient_name: result.patientName,
      room_code: room?.roomCode ?? '',
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Feature 16b — Start exam, Called/AwaitingResults -> InProgress (INFO_0045, `{patient_name}`)
  @Patch(':id/start')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @SkipAudit()
  async startVisit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.startVisitUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0045, DEFAULT_LOCALE, {
      patient_name: result.patientName,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Feature 17b — Hold for CLS results, InProgress -> AwaitingResults (INFO_0080, `{patient_name}`)
  @Patch(':id/hold-for-results')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @SkipAudit()
  async holdForResults(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.holdForResultsUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0080, DEFAULT_LOCALE, {
      patient_name: result.patientName,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Feature 16 A1 — Mark absent after call; NoShow only once called_count >= 3 (INFO_0081, `{patient_name}`)
  @Patch(':id/no-show')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  @SkipAudit()
  async markNoShow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.markNoShowUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0081, DEFAULT_LOCALE, {
      patient_name: result.patientName,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Vital signs — doctor records during the "Khám sơ bộ" step, before ordering CLS
  @Post(':id/vitals')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0089)
  @SkipAudit()
  upsertVitals(
    @Param('id') id: string,
    @Body() dto: UpsertVitalSignsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.upsertVitalSignsUseCase.execute({ ...dto, visitId: id, actorId: user.sub });
  }

  @Get(':id/vitals')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  getVitals(@Param('id') id: string) {
    return this.getVitalSignsUseCase.execute(id);
  }

  // Feature 19 — Save examination result (INFO_0052)
  @Post(':id/result')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0052)
  @SkipAudit()
  createResult(
    @Param('id') id: string,
    @Body() dto: CreateExaminationResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createExaminationResultUseCase.execute({ ...dto, visitId: id, actorId: user.sub });
  }

  // Feature 19 — Update examination result (INFO_0053)
  @Patch(':id/result')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0053)
  @SkipAudit()
  updateResult(
    @Param('id') id: string,
    @Body() dto: UpdateExaminationResultDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateExaminationResultUseCase.execute({ ...dto, visitId: id, actorId: user.sub });
  }

  // Feature 19 — Complete visit (INFO_0046, `{patient_name}`)
  @Patch(':id/complete')
  @Roles(UserRole.DOCTOR)
  @SkipAudit()
  async completeVisit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.completeVisitUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0046, DEFAULT_LOCALE, {
      patient_name: result.patientName,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Print combined CLS order PDF for all orders in this visit (grouped by room)
  @Get(':id/cls-orders/print')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.NURSE)
  async printAllClsOrders(
    @Param('id') visitId: string,
    @Query('diagnosis') diagnosis: string | undefined,
    @Res() res: Response,
  ) {
    const pdf = await this.printAllClsOrdersUseCase.execute(visitId, diagnosis);
    if (!pdf) {
      res.status(404).json({ message: 'Không có phiếu CLS nào cho lượt khám này' });
      return;
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cls-orders-${visitId}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  // Feature 19 — Get examination result by visitId
  @Get(':id/result')
  @Roles(UserRole.DOCTOR, UserRole.NURSE)
  getResult(@Param('id') id: string) {
    return this.getVisitResultUseCase.execute(id);
  }

  // "Phieu kham benh" admission slip — printed by the receptionist right
  // after check-in. Already includes the queue number (STT) in its own
  // content, so this is the only printed slip at check-in — a separate
  // queue-ticket PDF used to exist but was never wired to any UI button and
  // was removed as dead code.
  @Get(':id/admission/print')
  @Roles(UserRole.RECEPTIONIST)
  async printExaminationAdmission(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const pdf = await this.printExaminationAdmissionUseCase.execute(id, user.sub);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="admission-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
