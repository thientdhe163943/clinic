import { AppointmentTrustService } from './appointment-trust.service';
import { TooManyPendingAppointmentsError } from '../errors/application-error';

function buildService(overrides?: {
  countActiveByPatient?: jest.Mock;
  countNoShowsSince?: jest.Mock;
  configValues?: Record<string, number>;
}) {
  const appointmentRepository = {
    countActiveByPatient: overrides?.countActiveByPatient ?? jest.fn().mockResolvedValue(0),
  };
  const visitRepository = {
    countNoShowsSince: overrides?.countNoShowsSince ?? jest.fn().mockResolvedValue(0),
  };
  const configService = {
    get: jest.fn((key: string) => overrides?.configValues?.[key]),
  };

  const service = new AppointmentTrustService(
    appointmentRepository as never,
    visitRepository as never,
    configService as never,
  );
  return { service, appointmentRepository, visitRepository, configService };
}

describe('AppointmentTrustService', () => {
  describe('assertPendingLimitNotExceeded', () => {
    it('does not throw when the patient is under the configured limit', async () => {
      const { service, appointmentRepository } = buildService({
        countActiveByPatient: jest.fn().mockResolvedValue(2),
        configValues: { 'booking.maxPendingAppointmentsPerPatient': 3 },
      });

      await expect(service.assertPendingLimitNotExceeded('patient-1')).resolves.toBeUndefined();
      expect(appointmentRepository.countActiveByPatient).toHaveBeenCalledWith('patient-1', expect.any(Date));
    });

    it('throws TooManyPendingAppointmentsError once the limit is reached (alternative flow)', async () => {
      const { service } = buildService({
        countActiveByPatient: jest.fn().mockResolvedValue(3),
        configValues: { 'booking.maxPendingAppointmentsPerPatient': 3 },
      });

      await expect(service.assertPendingLimitNotExceeded('patient-1')).rejects.toBeInstanceOf(
        TooManyPendingAppointmentsError,
      );
    });

    it('falls back to the default limit (3) when config is unset', async () => {
      const { service } = buildService({ countActiveByPatient: jest.fn().mockResolvedValue(3) });

      await expect(service.assertPendingLimitNotExceeded('patient-1')).rejects.toBeInstanceOf(
        TooManyPendingAppointmentsError,
      );
    });
  });

  describe('hasExcessiveNoShows', () => {
    it('returns false when the no-show count is below the threshold', async () => {
      const { service } = buildService({
        countNoShowsSince: jest.fn().mockResolvedValue(1),
        configValues: { 'booking.noShowTrustThreshold': 2, 'booking.noShowLookbackDays': 90 },
      });

      await expect(service.hasExcessiveNoShows('patient-1')).resolves.toBe(false);
    });

    it('returns true once the no-show count reaches the threshold (alternative flow)', async () => {
      const { service, visitRepository } = buildService({
        countNoShowsSince: jest.fn().mockResolvedValue(2),
        configValues: { 'booking.noShowTrustThreshold': 2, 'booking.noShowLookbackDays': 90 },
      });

      await expect(service.hasExcessiveNoShows('patient-1')).resolves.toBe(true);
      expect(visitRepository.countNoShowsSince).toHaveBeenCalledWith('patient-1', expect.any(Date));
    });
  });
});
