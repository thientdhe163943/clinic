import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestGuestAppointmentOtpDto } from '../../dtos/appointments/request-guest-appointment-otp.dto';
import { ApplicationError, ConflictError } from '../../errors/application-error';
import { EMAIL_PORT, EmailPort } from '../../ports/email.port';
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from '../auth/otp.util';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { GuestBookingOtpPayload, GUEST_BOOKING_OTP_JWT_TYPE } from './guest-appointment-otp.payload';

export interface RequestGuestAppointmentOtpResult {
  otpToken: string;
  email: string;
  expiresInMinutes: number;
}

// Step (a) of the version-up 0.2 item #7 two-step guest-booking flow:
// generates an OTP, emails it, and packs the OTP hash + the entire booking
// payload into a short-lived signed JWT returned to the caller — no
// appointment (and no User/Patient account) is created yet. Step (b),
// ConfirmGuestAppointmentOtpUseCase, unpacks that same token and delegates to
// CreateGuestAppointmentUseCase, which re-validates everything (including
// this use case's own conflict pre-checks below) against then-current data.
//
// Deliberately does NOT use OtpTokenRepository/otp_tokens (unlike
// ForgotPasswordUseCase) — that table's schema requires a userId FK, and no
// User exists yet at this point in the guest flow. Carrying the payload in a
// signed JWT instead avoids adding a new table/migration for this feature.
@Injectable()
export class RequestGuestAppointmentOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: RequestGuestAppointmentOtpDto): Promise<RequestGuestAppointmentOtpResult> {
    // dateOfBirth arrives as a plain string (see CreateGuestAppointmentUseCase's
    // identical check for why @MaxDate can't be used on the DTO directly).
    if (new Date(input.dateOfBirth).getTime() > Date.now()) {
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    const email = input.email.trim();

    // Cheap fail-fast pre-checks so an OTP email is never sent for a request
    // that's guaranteed to fail at confirm time — CreateGuestAppointmentUseCase
    // re-runs the authoritative version of these same checks (plus phone/
    // idCard/slot conflicts, which are far more likely to change between
    // step (a) and (b), so are intentionally left to be re-checked there).
    const existingByEmail = await this.userRepository.findByEmail(email);
    if (existingByEmail) throw new ConflictError('Email');

    const otpCode = generateOtpCode();
    const otpHash = hashOtpCode(otpCode);

    const payload: GuestBookingOtpPayload = {
      typ: GUEST_BOOKING_OTP_JWT_TYPE,
      purpose: OtpPurpose.VERIFY_PHONE,
      otpHash,
      booking: {
        fullName: input.fullName,
        email,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        idCard: input.idCard,
        doctorId: input.doctorId,
        serviceId: input.serviceId,
        appointmentTime: input.appointmentTime.toISOString(),
        note: input.note,
      },
    };

    const otpToken = this.jwtService.sign(payload, { expiresIn: `${OTP_TTL_MINUTES}m` });

    await this.emailPort.send({
      to: email,
      subject: 'Mã OTP xác minh đặt lịch khám',
      body: `Mã OTP của bạn là ${otpCode}. Mã có hiệu lực trong ${OTP_TTL_MINUTES} phút. Vui lòng nhập mã này để hoàn tất đặt lịch khám.`,
    });

    return { otpToken, email, expiresInMinutes: OTP_TTL_MINUTES };
  }
}
