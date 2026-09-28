import { ConfirmGuestAppointmentOtpUseCase } from './confirm-guest-appointment-otp.use-case';
import { InvalidOtpError } from '../../errors/application-error';
import { hashOtpCode } from '../auth/otp.util';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { GUEST_BOOKING_OTP_JWT_TYPE, GuestBookingOtpPayload } from './guest-appointment-otp.payload';

function buildPayload(overrides: Partial<GuestBookingOtpPayload> = {}): GuestBookingOtpPayload {
  return {
    typ: GUEST_BOOKING_OTP_JWT_TYPE,
    purpose: OtpPurpose.VERIFY_PHONE,
    otpHash: hashOtpCode('123456'),
    booking: {
      fullName: 'Nguyen Van A',
      email: 'guest@example.com',
      phone: '0900000000',
      dateOfBirth: '1990-01-01',
      appointmentTime: new Date(Date.UTC(2999, 0, 15, 9, 0)).toISOString(),
    },
    ...overrides,
  };
}

function buildUseCase(overrides?: { verify?: jest.Mock; execute?: jest.Mock }) {
  const createGuestAppointmentUseCase = {
    execute: overrides?.execute ?? jest.fn().mockResolvedValue({ appointment: { id: 'appointment-1' } }),
  };
  const jwtService = {
    verify: overrides?.verify ?? jest.fn().mockReturnValue(buildPayload()),
  };

  const useCase = new ConfirmGuestAppointmentOtpUseCase(
    createGuestAppointmentUseCase as never,
    jwtService as never,
  );

  return { useCase, createGuestAppointmentUseCase, jwtService };
}

describe('ConfirmGuestAppointmentOtpUseCase', () => {
  it('creates the appointment via CreateGuestAppointmentUseCase once the OTP matches (happy path)', async () => {
    const { useCase, createGuestAppointmentUseCase } = buildUseCase();

    await useCase.execute({ otpToken: 'valid-token', otpCode: '123456' });

    expect(createGuestAppointmentUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'guest@example.com',
        phone: '0900000000',
        appointmentTime: new Date(Date.UTC(2999, 0, 15, 9, 0)),
      }),
    );
  });

  it('rejects a wrong OTP code without creating anything (alternative flow)', async () => {
    const { useCase, createGuestAppointmentUseCase } = buildUseCase();

    await expect(useCase.execute({ otpToken: 'valid-token', otpCode: '000000' })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
    expect(createGuestAppointmentUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects an expired/tampered token (alternative flow)', async () => {
    const { useCase, createGuestAppointmentUseCase } = buildUseCase({
      verify: jest.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      }),
    });

    await expect(useCase.execute({ otpToken: 'expired-token', otpCode: '123456' })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
    expect(createGuestAppointmentUseCase.execute).not.toHaveBeenCalled();
  });

  it('rejects a token minted for a different purpose (alternative flow)', async () => {
    const { useCase, createGuestAppointmentUseCase } = buildUseCase({
      verify: jest.fn().mockReturnValue({ ...buildPayload(), typ: 'something_else' }),
    });

    await expect(useCase.execute({ otpToken: 'valid-token', otpCode: '123456' })).rejects.toBeInstanceOf(
      InvalidOtpError,
    );
    expect(createGuestAppointmentUseCase.execute).not.toHaveBeenCalled();
  });
});
