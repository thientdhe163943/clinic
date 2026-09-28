import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AvailabilityCalendarQueryDto } from '../../application/dtos/appointments/availability-calendar-query.dto';
import { AvailableDoctorsQueryDto } from '../../application/dtos/appointments/available-doctors-query.dto';
import { CancelAppointmentRequestDto } from '../../application/dtos/appointments/cancel-appointment.dto';
import { CheckInAppointmentRequestDto } from '../../application/dtos/appointments/check-in-appointment.dto';
import { ConfirmCheckInPaymentRequestDto } from '../../application/dtos/appointments/confirm-checkin-payment.dto';
import { ConfirmGuestAppointmentOtpDto } from '../../application/dtos/appointments/confirm-guest-appointment-otp.dto';
import { CreateAppointmentRequestDto } from '../../application/dtos/appointments/create-appointment.dto';
import { CreateGuestAppointmentRequestDto } from '../../application/dtos/appointments/create-guest-appointment.dto';
import { ListAppointmentsQueryDto } from '../../application/dtos/appointments/list-appointments-query.dto';
import { RejectAppointmentRequestDto } from '../../application/dtos/appointments/reject-appointment.dto';
import { RequestGuestAppointmentOtpDto } from '../../application/dtos/appointments/request-guest-appointment-otp.dto';
import { UpdateAppointmentRequestDto } from '../../application/dtos/appointments/update-appointment.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CancelAppointmentUseCase } from '../../application/use-cases/appointments/cancel-appointment.use-case';
import { CheckInAppointmentUseCase } from '../../application/use-cases/appointments/check-in-appointment.use-case';
import { ConfirmAppointmentUseCase } from '../../application/use-cases/appointments/confirm-appointment.use-case';
import { ConfirmCheckInPaymentUseCase } from '../../application/use-cases/appointments/confirm-checkin-payment.use-case';
import { ConfirmGuestAppointmentOtpUseCase } from '../../application/use-cases/appointments/confirm-guest-appointment-otp.use-case';
import { CreateAppointmentUseCase } from '../../application/use-cases/appointments/create-appointment.use-case';
import { CreateGuestAppointmentUseCase } from '../../application/use-cases/appointments/create-guest-appointment.use-case';
import { FindAvailableDoctorsUseCase } from '../../application/use-cases/appointments/find-available-doctors.use-case';
import { GetAvailabilityCalendarUseCase } from '../../application/use-cases/appointments/get-availability-calendar.use-case';
import { ListAppointmentsUseCase } from '../../application/use-cases/appointments/list-appointments.use-case';
import { RejectAppointmentUseCase } from '../../application/use-cases/appointments/reject-appointment.use-case';
import { RequestGuestAppointmentOtpUseCase } from '../../application/use-cases/appointments/request-guest-appointment-otp.use-case';
import { UpdateAppointmentUseCase } from '../../application/use-cases/appointments/update-appointment.use-case';
import { AppointmentStatus } from '../../domain/enums/appointment-status.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { parseDurationMs, setAuthCookies } from '../../infrastructure/auth/cookie.util';
import { ClientIp } from '../decorators/client-ip.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { GuestBookingThrottlerGuard, PatientBookingThrottlerGuard } from '../guards/booking-throttler.guard';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { ApiResponse } from '../response/api-response';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly createGuestAppointmentUseCase: CreateGuestAppointmentUseCase,
    private readonly requestGuestAppointmentOtpUseCase: RequestGuestAppointmentOtpUseCase,
    private readonly confirmGuestAppointmentOtpUseCase: ConfirmGuestAppointmentOtpUseCase,
    private readonly listAppointmentsUseCase: ListAppointmentsUseCase,
    private readonly checkInAppointmentUseCase: CheckInAppointmentUseCase,
    private readonly confirmCheckInPaymentUseCase: ConfirmCheckInPaymentUseCase,
    private readonly cancelAppointmentUseCase: CancelAppointmentUseCase,
    private readonly updateAppointmentUseCase: UpdateAppointmentUseCase,
    private readonly confirmAppointmentUseCase: ConfirmAppointmentUseCase,
    private readonly rejectAppointmentUseCase: RejectAppointmentUseCase,
    private readonly findAvailableDoctorsUseCase: FindAvailableDoctorsUseCase,
    private readonly getAvailabilityCalendarUseCase: GetAvailabilityCalendarUseCase,
    private readonly configService: ConfigService,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.PATIENT)
  list(@Query() query: ListAppointmentsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.listAppointmentsUseCase.execute({ query, actorId: user.sub, actorRole: user.role });
  }

  // Feature 59 booking flow support: doctors filtered by the chosen
  // service's specialty and scheduled that day (Phần 4b). Public — the
  // guest-booking form (POST /appointments/guest, also @Public()) needs this
  // to render its doctor/slot pickers before the guest has any session at
  // all; no @CurrentUser() is used here so there's nothing role-specific to
  // check, and the data itself (which doctors/slots are open) isn't
  // sensitive.
  @Public()
  @Get('available-doctors')
  findAvailableDoctors(@Query() query: AvailableDoctorsQueryDto) {
    return this.findAvailableDoctorsUseCase.execute({ serviceId: query.serviceId, date: query.date });
  }

  // Feature 59 booking flow support: per-day availability for a whole month,
  // used to render the booking calendar grid (Phần 4a). Public for the same
  // reason as available-doctors above.
  @Public()
  @Get('availability-calendar')
  getAvailabilityCalendar(@Query() query: AvailabilityCalendarQueryDto) {
    return this.getAvailabilityCalendarUseCase.execute({ serviceId: query.serviceId, month: query.month });
  }


  // Receptionist-created appointments are auto-CONFIRMED (MSG.INFO_0034);
  // patient self-booked appointments stay PENDING (MSG.INFO_0004). Since the
  // success message depends on runtime data (who booked), it cannot be
  // expressed with a single static @MsgCode — the response is built manually
  // here, mirroring what ResponseTransformInterceptor does for the static case.
  // Version-up 0.2 item #7 proposal 1: PatientBookingThrottlerGuard only
  // actually throttles a PATIENT-booked request (RECEPTIONIST is skipIf'd —
  // see the guard itself), so this doesn't affect receptionist walk-in
  // booking throughput.
  @Post()
  @Roles(UserRole.RECEPTIONIST, UserRole.PATIENT)
  @UseGuards(PatientBookingThrottlerGuard)
  @SkipAudit()
  async create(
    @Body() dto: CreateAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.createAppointmentUseCase.execute({
      ...dto,
      bookedBy: user.sub,
      bookedByRole: user.role,
    });

    const msgCode = result.status === AppointmentStatus.CONFIRMED ? MSG.INFO_0034 : MSG.INFO_0004;
    const message = this.messageCatalog.getMessage(msgCode, DEFAULT_LOCALE);

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Feature 59 guest-booking variant: an unauthenticated visitor books an
  // appointment and gets an account created for them in the same call, then
  // is auto-logged-in (see CreateGuestAppointmentUseCase). No @Roles — there
  // is no authenticated actor yet, and @Public() bypasses JwtAuthGuard.
  @Public()
  @Post('guest')
  @UseGuards(GuestBookingThrottlerGuard)
  @SkipAudit()
  async createGuest(
    @Body() dto: CreateGuestAppointmentRequestDto,
    @ClientIp() ipAddress: string,
    @Req() req: RequestWithTrace,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, ...result } = await this.createGuestAppointmentUseCase.execute({
      ...dto,
      ipAddress,
      userAgent: req.headers['user-agent'] ?? null,
    });

    // secure derives from req.secure, not NODE_ENV — see auth.controller.ts's
    // setSessionCookies for why (production behind plain HTTP must not set
    // a Secure cookie, or the browser silently drops it).
    setAuthCookies(res, accessToken, refreshToken, {
      accessTokenMaxAgeMs: parseDurationMs(this.configService.get<string>('auth.jwtExpiresIn') ?? '15m'),
      refreshTokenMaxAgeMs: (this.configService.get<number>('auth.refreshTokenExpiresDays') ?? 7) * 86_400_000,
      secure: req.secure,
    });

    const msgCode = MSG.INFO_0004;
    const message = this.messageCatalog.getMessage(msgCode, DEFAULT_LOCALE);

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Version-up 0.2 item #7 proposal 3, step (a) of the new two-step
  // guest-booking flow: generates + emails an OTP and returns an opaque
  // token carrying the booking payload — no account/appointment is created
  // yet (see POST /appointments/guest/confirm below). The legacy one-step
  // POST /appointments/guest above is untouched and keeps working exactly as
  // before for callers not yet migrated to this flow.
  @Public()
  @Post('guest/otp')
  @UseGuards(GuestBookingThrottlerGuard)
  @SkipAudit()
  async requestGuestOtp(@Body() dto: RequestGuestAppointmentOtpDto, @Req() req: RequestWithTrace) {
    const result = await this.requestGuestAppointmentOtpUseCase.execute(dto);
    const message = this.messageCatalog.getMessage(MSG.INFO_0097, DEFAULT_LOCALE, { email: result.email });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Step (b): verifies the OTP against the token from POST
  // /appointments/guest/otp and, only then, actually creates the
  // account+appointment (delegates to CreateGuestAppointmentUseCase — see
  // ConfirmGuestAppointmentOtpUseCase) and auto-logs the guest in, same as
  // the legacy POST /appointments/guest.
  @Public()
  @Post('guest/confirm')
  @UseGuards(GuestBookingThrottlerGuard)
  @SkipAudit()
  async confirmGuestOtp(
    @Body() dto: ConfirmGuestAppointmentOtpDto,
    @ClientIp() ipAddress: string,
    @Req() req: RequestWithTrace,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, ...result } = await this.confirmGuestAppointmentOtpUseCase.execute({
      ...dto,
      ipAddress,
      userAgent: req.headers['user-agent'] ?? null,
    });

    setAuthCookies(res, accessToken, refreshToken, {
      accessTokenMaxAgeMs: parseDurationMs(this.configService.get<string>('auth.jwtExpiresIn') ?? '15m'),
      refreshTokenMaxAgeMs: (this.configService.get<number>('auth.refreshTokenExpiresDays') ?? 7) * 86_400_000,
      secure: req.secure,
    });

    const msgCode = MSG.INFO_0004;
    const message = this.messageCatalog.getMessage(msgCode, DEFAULT_LOCALE);

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Put(':id')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0036)
  @SkipAudit()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateAppointmentUseCase.execute({ ...dto, appointmentId: id, actorId: user.sub });
  }

  @Patch(':id/check-in')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0038)
  @SkipAudit()
  checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkInAppointmentUseCase.execute({ ...dto, appointmentId: id, actorId: user.sub });
  }

  // Payment-before-queue change (2026-08-21): second check-in step — collects
  // the exam fee (if any is still unpaid) and only then creates the Visit /
  // assigns the queue number.
  @Patch(':id/confirm-checkin-payment')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0100)
  @SkipAudit()
  confirmCheckInPayment(
    @Param('id') id: string,
    @Body() dto: ConfirmCheckInPaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.confirmCheckInPaymentUseCase.execute({ ...dto, appointmentId: id, actorId: user.sub });
  }

  @Patch(':id/cancel')
  @Roles(UserRole.PATIENT)
  @MsgCode(MSG.INFO_0037)
  @SkipAudit()
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cancelAppointmentUseCase.execute({
      appointmentId: id,
      reason: dto.reason,
      actorId: user.sub,
      actorRole: user.role,
    });
  }

  @Patch(':id/confirm')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0002)
  @SkipAudit()
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.confirmAppointmentUseCase.execute(id, user.sub);
  }

  @Patch(':id/reject')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0035)
  @SkipAudit()
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAppointmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rejectAppointmentUseCase.execute({ appointmentId: id, reason: dto.reason, actorId: user.sub });
  }
}
