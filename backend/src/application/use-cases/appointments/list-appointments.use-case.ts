import { Inject, Injectable } from '@nestjs/common';
import { AppointmentListResponseDto, AppointmentResponseDto } from '../../dtos/appointments/appointment-response.dto';
import { ListAppointmentsQueryDto } from '../../dtos/appointments/list-appointments-query.dto';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { UserRole } from '../../../domain/enums/user-role.enum';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

export interface ListAppointmentsInput {
  query: ListAppointmentsQueryDto;
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class ListAppointmentsUseCase {
  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
  ) {}

  async execute(input: ListAppointmentsInput): Promise<AppointmentListResponseDto> {
    const { query } = input;

    // Business Rule: a patient caller may only ever see their own
    // appointments — force-scope the filter to their own resolved patientId,
    // ignoring any patientId the query might otherwise carry (prevents IDOR,
    // mirroring the pattern in CreateAppointmentUseCase/CancelAppointmentUseCase).
    let patientId: string | undefined;
    if (input.actorRole === UserRole.PATIENT) {
      const selfPatient = await this.patientRepository.findByUserId(input.actorId);
      if (!selfPatient) throw new ResourceNotFoundError('Patient', { userId: input.actorId });
      patientId = selfPatient.id;
    } else {
      // Staff callers (ADMIN/RECEPTIONIST/DOCTOR) may optionally scope the
      // list to one patient (e.g. receptionist "patient detail" view) —
      // added Phase 0 of the 0.2 version-up plan, item #5 groundwork.
      patientId = query.patientId;
    }

    // Business Rule: Feature 61 (receptionist "today's schedule" list) sorts
    // ascending — earliest appointment first, for a walk-up queue view. A
    // patient's own "my appointments" list instead sorts descending — their
    // newest/most recently booked appointment first — since patients care
    // about what's upcoming/most-recent rather than working a queue.
    const sort = input.actorRole === UserRole.PATIENT ? 'desc' : 'asc';

    const { items, total } = await this.appointmentRepository.findMany({
      date: query.date,
      doctorId: query.doctorId,
      patientId,
      statuses: query.statuses,
      search: query.search,
      page: query.page,
      limit: query.limit,
      sort,
    });

    const dtoItems: AppointmentResponseDto[] = items.map((item) => ({
      id: item.appointment.id,
      patientId: item.appointment.patientId,
      patientName: item.patientName,
      patientCode: item.patientCode,
      doctorId: item.appointment.doctorId,
      doctorName: item.doctorName,
      serviceId: item.appointment.serviceId,
      serviceName: item.serviceName,
      roomId: item.appointment.roomId,
      appointmentTime: item.appointment.appointmentTime,
      status: item.appointment.status,
      note: item.appointment.note,
      cancelReason: item.appointment.cancelReason,
      cancelledBy: item.appointment.cancelledBy,
      cancelledAt: item.appointment.cancelledAt,
      checkedInAt: item.appointment.checkedInAt,
      bookedBy: item.appointment.bookedBy,
      createdAt: item.appointment.createdAt,
      updatedAt: item.appointment.updatedAt,
      visitId: item.visitId,
      roomName: item.roomName,
    }));

    return {
      items: dtoItems,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
