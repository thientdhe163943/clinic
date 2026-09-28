import { RequestGuestAppointmentOtpUseCase } from './request-guest-appointment-otp.use-case';
import { RequestGuestAppointmentOtpDto } from '../../dtos/appointments/request-guest-appointment-otp.dto';
import { ApplicationError, ConflictError } from '../../errors/application-error';
import { GUEST_BOOKING_OTP_JWT_TYPE, GuestBookingOtpPayload } from './guest-appointment-otp.payload';

function buildInput(overrides: Partial<RequestGuestAppointmentOtpDto> = {}): RequestGuestAppointmentOtpDto {
  return {
    fullName: 'Nguyen Van A',
    email: 'guest@example.com',
    phone: '0900000000',
    dateOfBirth: '1990-01-01',
    appointmentTime: new Date(Date.UTC(2999, 0, 15, 9, 0)),
    ...overrides,
  } as RequestGuestAppointmentOtpDto;
}

function buildUseCase(overrides?: { findByEmail?: jest.Mock }) {
  const userRepository = { findByEmail: overrides?.findByEmail ?? jest.fn().mockResolvedValue(null) };
  const patientRepository = {};
  const emailPort = { send: jest.fn().mockResolvedValue(undefined) };
  const jwtService = { sign: jest.fn().mockReturnValue('signed-otp-token') };

  const useCase = new RequestGuestAppointmentOtpUseCase(
    userRepository as never,
    patientRepository as never,
    emailPort as never,
    jwtService as never,
  );

  return { useCase, userRepository, emailPort, jwtService };
}

describe('RequestGuestAppointmentOtpUseCase', () => {
  it('sends an OTP email and returns a signed booking token (happy path)', async () => {
    const { useCase, emailPort, jwtService } = buildUseCase();

    const result = await useCase.execute(buildInput());

    expect(result).toEqual({ otpToken: 'signed-otp-token', email: 'guest@example.com', expiresInMinutes: 5 });
    expect(emailPort.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'guest@example.com' }),
    );

    const [signedPayload] = jwtService.sign.mock.calls[0] as [GuestBookingOtpPayload, unknown];
    expect(signedPayload.typ).toBe(GUEST_BOOKING_OTP_JWT_TYPE);
    expect(signedPayload.booking.email).toBe('guest@example.com');
    expect(signedPayload.booking.appointmentTime).toBe(new Date(Date.UTC(2999, 0, 15, 9, 0)).toISOString());
    // The raw OTP must never appear in the signed payload — only its hash.
    expect(signedPayload.otpHash).toHaveLength(64);
  });

  it('rejects when the email is already registered (alternative flow)', async () => {
    const { useCase, emailPort } = buildUseCase({ findByEmail: jest.fn().mockResolvedValue({ id: 'user-1' }) });

    await expect(useCase.execute(buildInput())).rejects.toBeInstanceOf(ConflictError);
    expect(emailPort.send).not.toHaveBeenCalled();
  });

  it('rejects a future dateOfBirth (alternative flow)', async () => {
    const { useCase, emailPort } = buildUseCase();

    await expect(useCase.execute(buildInput({ dateOfBirth: '2999-01-01' }))).rejects.toBeInstanceOf(
      ApplicationError,
    );
    expect(emailPort.send).not.toHaveBeenCalled();
  });
});
