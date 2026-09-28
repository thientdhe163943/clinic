import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfirmGuestAppointmentOtpDto } from '../../dtos/appointments/confirm-guest-appointment-otp.dto';
import { InvalidOtpError } from '../../errors/application-error';
import { hashOtpCode } from '../auth/otp.util';
import { CreateGuestAppointmentUseCase, CreateGuestAppointmentResult } from './create-guest-appointment.use-case';
import { GuestBookingOtpPayload, GUEST_BOOKING_OTP_JWT_TYPE } from './guest-appointment-otp.payload';

export interface ConfirmGuestAppointmentOtpInput extends ConfirmGuestAppointmentOtpDto {
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Step (b) of the version-up 0.2 item #7 two-step guest-booking flow:
// verifies the OTP the guest typed in against the token minted by
// RequestGuestAppointmentOtpUseCase, then delegates the actual account +
// appointment creation to CreateGuestAppointmentUseCase (reused as-is — every
// business rule/anti-spam check that use case enforces, e.g. #2/#4 above,
// applies here automatically since this literally calls the same execute()).
@Injectable()
export class ConfirmGuestAppointmentOtpUseCase {
  constructor(
    private readonly createGuestAppointmentUseCase: CreateGuestAppointmentUseCase,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: ConfirmGuestAppointmentOtpInput): Promise<CreateGuestAppointmentResult> {
    let payload: GuestBookingOtpPayload;
    try {
      payload = this.jwtService.verify<GuestBookingOtpPayload>(input.otpToken);
    } catch {
      // Covers both an expired token (TokenExpiredError) and a
      // tampered/garbage one (JsonWebTokenError) — both surface to the guest
      // as the same "OTP không hợp lệ hoặc đã hết hạn" message.
      throw new InvalidOtpError();
    }

    if (payload.typ !== GUEST_BOOKING_OTP_JWT_TYPE || !payload.booking || !payload.otpHash) {
      throw new InvalidOtpError();
    }

    if (hashOtpCode(input.otpCode) !== payload.otpHash) {
      throw new InvalidOtpError();
    }

    const { booking } = payload;

    return this.createGuestAppointmentUseCase.execute({
      fullName: booking.fullName,
      email: booking.email,
      phone: booking.phone,
      dateOfBirth: booking.dateOfBirth,
      gender: booking.gender,
      idCard: booking.idCard,
      doctorId: booking.doctorId,
      serviceId: booking.serviceId,
      appointmentTime: new Date(booking.appointmentTime),
      note: booking.note,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}
