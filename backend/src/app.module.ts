import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import appConfig from './config/app.config';
import clinicConfig from './config/clinic.config';
import { envValidationSchema } from './config/env.validation';
import { AUDIT_LOG_PORT } from './application/ports/audit-log.port';
import { AI_CHAT_LOG_PORT } from './application/ports/ai-chat-log.port';
import { AI_PROVIDER_PORT } from './application/ports/ai-provider.port';
import { EMAIL_PORT } from './application/ports/email.port';
import { NOTIFICATION_PORT } from './application/ports/notification.port';
import { REALTIME_PORT } from './application/ports/realtime.port';
import { STORAGE_PORT } from './application/ports/storage.port';
import { MESSAGE_CATALOG_PORT } from './application/ports/message-catalog.port';
import { MEDICAL_RECORD_REPOSITORY } from './domain/repositories/medical-record.repository';
import { MESSAGE_REPOSITORY } from './domain/repositories/message.repository';
import { OTP_TOKEN_REPOSITORY } from './domain/repositories/otp-token.repository';
import { PATIENT_REPOSITORY } from './domain/repositories/patient.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { ROOM_REPOSITORY } from './domain/repositories/room.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { APPOINTMENT_REPOSITORY } from './domain/repositories/appointment.repository';
import { INVOICE_REPOSITORY } from './domain/repositories/invoice.repository';
import { WORK_SCHEDULE_REPOSITORY } from './domain/repositories/work-schedule.repository';
import { VISIT_REPOSITORY } from './domain/repositories/visit.repository';
import { CLS_ORDER_REPOSITORY } from './domain/repositories/cls-order.repository';
import { PRESCRIPTION_REPOSITORY } from './domain/repositories/prescription.repository';
import { GetMessageUseCase } from './application/use-cases/messages/get-message.use-case';
import { ListMessagesUseCase } from './application/use-cases/messages/list-messages.use-case';
import { ReloadMessagesUseCase } from './application/use-cases/messages/reload-messages.use-case';
import { ChangePasswordUseCase } from './application/use-cases/auth/change-password.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/auth/forgot-password.use-case';
import { LoginUseCase } from './application/use-cases/auth/login.use-case';
import { LogoutUseCase } from './application/use-cases/auth/logout.use-case';
import { RefreshTokenUseCase } from './application/use-cases/auth/refresh-token.use-case';
import { RegisterUseCase } from './application/use-cases/auth/register.use-case';
import { ResetPasswordUseCase } from './application/use-cases/auth/reset-password.use-case';
import { VerifyOtpUseCase } from './application/use-cases/auth/verify-otp.use-case';
import { GetMedicalRecordUseCase } from './application/use-cases/medical-records/get-medical-record.use-case';
import { ListMedicalRecordsUseCase } from './application/use-cases/medical-records/list-medical-records.use-case';
import { PrintMedicalRecordUseCase } from './application/use-cases/medical-records/print-medical-record.use-case';
import { UpdateMedicalRecordUseCase } from './application/use-cases/medical-records/update-medical-record.use-case';
import { GetMyProfileUseCase } from './application/use-cases/users/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from './application/use-cases/users/update-my-profile.use-case';
import { CreateRoomUseCase } from './application/use-cases/rooms/create-room.use-case';
import { ListRoomsUseCase } from './application/use-cases/rooms/list-rooms.use-case';
import { GetRoomByIdUseCase } from './application/use-cases/rooms/get-room.use-case';
import { UpdateRoomUseCase } from './application/use-cases/rooms/update-room.use-case';
import { ActivateRoomUseCase } from './application/use-cases/rooms/activate-room.use-case';
import { DeactivateRoomUseCase } from './application/use-cases/rooms/deactivate-room.use-case';
import { CreateScheduleUseCase } from './application/use-cases/schedules/create-schedule.use-case';
import { CreateBulkScheduleUseCase } from './application/use-cases/schedules/create-bulk-schedule.use-case';
import { UpdateScheduleUseCase } from './application/use-cases/schedules/update-schedule.use-case';
import { ReassignScheduleDoctorUseCase } from './application/use-cases/schedules/reassign-schedule-doctor.use-case';
import { DeleteScheduleUseCase } from './application/use-cases/schedules/delete-schedule.use-case';
import { SystemLogsController } from './presentation/controllers/system-logs.controller';
import { ListSystemLogsUseCase } from './application/use-cases/system-logs/list-system-logs.use-case';
import { SYSTEM_LOG_REPOSITORY } from './domain/repositories/system-log.repository';
import { PrismaSystemLogRepository } from './infrastructure/persistence/repositories/prisma-system-log.repository';
import { ListSchedulesUseCase } from './application/use-cases/schedules/list-schedules.use-case';
import { GetScheduleUseCase } from './application/use-cases/schedules/get-schedule.use-case';
import { GetPublicDoctorUseCase } from './application/use-cases/public-doctors/get-public-doctor.use-case';
import { ListPublicDoctorsUseCase } from './application/use-cases/public-doctors/list-public-doctors.use-case';
import { ApproveDoctorSpecialtyUpdateUseCase } from './application/use-cases/doctor-specialties/approve-doctor-specialty-update.use-case';
import { ListPublicServicesUseCase } from './application/use-cases/public-services/list-public-services.use-case';
import { GetClinicInfoUseCase } from './application/use-cases/clinic-info/get-clinic-info.use-case';
import { GetMyDoctorSpecialtyUseCase } from './application/use-cases/doctor-specialties/get-my-doctor-specialty.use-case';
import { ListDoctorSpecialtyProfilesUseCase } from './application/use-cases/doctor-specialties/list-doctor-specialty-profiles.use-case';
import { ListSpecialtiesUseCase } from './application/use-cases/doctor-specialties/list-specialties.use-case';
import { CreateSpecialtyUseCase } from './application/use-cases/doctor-specialties/create-specialty.use-case';
import { UpdateSpecialtyUseCase } from './application/use-cases/doctor-specialties/update-specialty.use-case';
import { DeleteSpecialtyUseCase } from './application/use-cases/doctor-specialties/delete-specialty.use-case';
import { RejectDoctorSpecialtyUpdateUseCase } from './application/use-cases/doctor-specialties/reject-doctor-specialty-update.use-case';
import { UpdateDoctorSpecialtyProfileUseCase } from './application/use-cases/doctor-specialties/update-doctor-specialty-profile.use-case';
import { UpdateMyDoctorSpecialtyUseCase } from './application/use-cases/doctor-specialties/update-my-doctor-specialty.use-case';
import { ChatWithAiUseCase } from './application/use-cases/ai/chat-with-ai.use-case';
import { GetAiChatHistoryUseCase } from './application/use-cases/ai/get-ai-chat-history.use-case';
import { SummarizeExamResultUseCase } from './application/use-cases/ai/summarize-exam-result.use-case';
import { RunRecheckReminderUseCase } from './application/use-cases/ai/run-recheck-reminder.use-case';
import { ListRecheckNotificationsUseCase } from './application/use-cases/ai/list-recheck-notifications.use-case';
import { RecheckReminderScheduler } from './infrastructure/scheduling/recheck-reminder.scheduler';
import { EndOfDayCleanupScheduler } from './infrastructure/scheduling/end-of-day-cleanup.scheduler';
import { ListVisitsUseCase } from './application/use-cases/visits/list-visits.use-case';
import { ListNurseQueueUseCase } from './application/use-cases/visits/list-nurse-queue.use-case';
import { GetVisitQueueContextUseCase } from './application/use-cases/visits/get-visit-queue-context.use-case';
import { ResolveActorShiftService } from './application/services/resolve-actor-shift.service';
import { DoctorSlotService } from './application/services/doctor-slot.service';
import { AppointmentTrustService } from './application/services/appointment-trust.service';
import { InvoiceBillingService } from './application/services/invoice-billing.service';
import { CallPatientUseCase } from './application/use-cases/visits/call-patient.use-case';
import { StartVisitUseCase } from './application/use-cases/visits/start-visit.use-case';
import { HoldForResultsUseCase } from './application/use-cases/visits/hold-for-results.use-case';
import { MarkNoShowUseCase } from './application/use-cases/visits/mark-no-show.use-case';
import { PrintExaminationAdmissionUseCase } from './application/use-cases/visits/print-examination-admission.use-case';
import { PrintAllClsOrdersUseCase } from './application/use-cases/cls-orders/print-all-cls-orders.use-case';
import { CreateExaminationResultUseCase } from './application/use-cases/visits/create-examination-result.use-case';
import { UpdateExaminationResultUseCase } from './application/use-cases/visits/update-examination-result.use-case';
import { UpsertVitalSignsUseCase } from './application/use-cases/visits/upsert-vital-signs.use-case';
import { GetVitalSignsUseCase } from './application/use-cases/visits/get-vital-signs.use-case';
import { CompleteVisitUseCase } from './application/use-cases/visits/complete-visit.use-case';
import { GetVisitResultUseCase } from './application/use-cases/visits/get-visit-result.use-case';
import { GetResultByCodeUseCase } from './application/use-cases/visits/get-result-by-code.use-case';
import { CreateClsOrderUseCase } from './application/use-cases/cls-orders/create-cls-order.use-case';
import { ListClsOrdersUseCase } from './application/use-cases/cls-orders/list-cls-orders.use-case';
import { ListAllClsOrdersUseCase } from './application/use-cases/cls-orders/list-all-cls-orders.use-case';
import { CallPatientToClsUseCase } from './application/use-cases/cls-orders/call-patient-to-cls.use-case';
import { EnterClsResultUseCase } from './application/use-cases/cls-orders/enter-cls-result.use-case';
import { ExtractClsResultOcrUseCase } from './application/use-cases/cls-orders/extract-cls-result-ocr.use-case';
import { EditClsOrderUseCase } from './application/use-cases/cls-orders/edit-cls-order.use-case';
import { CreatePrescriptionUseCase } from './application/use-cases/prescriptions/create-prescription.use-case';
import { GetPrescriptionUseCase } from './application/use-cases/prescriptions/get-prescription.use-case';
import { UpdatePrescriptionUseCase } from './application/use-cases/prescriptions/update-prescription.use-case';
import { CreatePatientUseCase } from './application/use-cases/patients/create-patient.use-case';
import { GetPatientUseCase } from './application/use-cases/patients/get-patient.use-case';
import { ListPatientsUseCase } from './application/use-cases/patients/list-patients.use-case';
import { UpdatePatientUseCase } from './application/use-cases/patients/update-patient.use-case';
import { ListUsersUseCase } from './application/use-cases/users/list-users.use-case';
import { CreateUserUseCase } from './application/use-cases/users/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/users/update-user.use-case';
import { ToggleUserStatusUseCase } from './application/use-cases/users/toggle-user-status.use-case';
import { ResetUserPasswordUseCase } from './application/use-cases/users/reset-user-password.use-case';
import { CreateServiceUseCase } from './application/use-cases/services/create-service.use-case';
import { DeleteServiceUseCase } from './application/use-cases/services/delete-service.use-case';
import { ListServicesUseCase } from './application/use-cases/services/list-services.use-case';
import { UpdateServiceUseCase } from './application/use-cases/services/update-service.use-case';
import { SERVICE_REPOSITORY } from './domain/repositories/service.repository';
import { SPECIALTY_REPOSITORY } from './domain/repositories/specialty.repository';
import { PrismaServiceRepository } from './infrastructure/persistence/repositories/prisma-service.repository';
import { PrismaSpecialtyRepository } from './infrastructure/persistence/repositories/prisma-specialty.repository';
import { ServicesController } from './presentation/controllers/services.controller';
import { CreateAppointmentUseCase } from './application/use-cases/appointments/create-appointment.use-case';
import { CreateGuestAppointmentUseCase } from './application/use-cases/appointments/create-guest-appointment.use-case';
import { RequestGuestAppointmentOtpUseCase } from './application/use-cases/appointments/request-guest-appointment-otp.use-case';
import { ConfirmGuestAppointmentOtpUseCase } from './application/use-cases/appointments/confirm-guest-appointment-otp.use-case';
import { FindAvailableDoctorsUseCase } from './application/use-cases/appointments/find-available-doctors.use-case';
import { GetAvailabilityCalendarUseCase } from './application/use-cases/appointments/get-availability-calendar.use-case';
import { SuggestAppointmentSlotsUseCase } from './application/use-cases/appointments/suggest-appointment-slots.use-case';
import { ListAppointmentsUseCase } from './application/use-cases/appointments/list-appointments.use-case';
import { CheckInAppointmentUseCase } from './application/use-cases/appointments/check-in-appointment.use-case';
import { ConfirmCheckInPaymentUseCase } from './application/use-cases/appointments/confirm-checkin-payment.use-case';
import { CancelAppointmentUseCase } from './application/use-cases/appointments/cancel-appointment.use-case';
import { UpdateAppointmentUseCase } from './application/use-cases/appointments/update-appointment.use-case';
import { ConfirmAppointmentUseCase } from './application/use-cases/appointments/confirm-appointment.use-case';
import { RejectAppointmentUseCase } from './application/use-cases/appointments/reject-appointment.use-case';
import { RunEndOfDayCleanupUseCase } from './application/use-cases/appointments/run-end-of-day-cleanup.use-case';
import { CreateInvoiceUseCase } from './application/use-cases/invoices/create-invoice.use-case';
import { GetInvoiceUseCase } from './application/use-cases/invoices/get-invoice.use-case';
import { ListInvoicesUseCase } from './application/use-cases/invoices/list-invoices.use-case';
import { PayInvoiceUseCase } from './application/use-cases/invoices/pay-invoice.use-case';
import { PrismaAppointmentRepository } from './infrastructure/persistence/repositories/prisma-appointment.repository';
import { PrismaInvoiceRepository } from './infrastructure/persistence/repositories/prisma-invoice.repository';
import { PrismaWorkScheduleRepository } from './infrastructure/persistence/repositories/prisma-work-schedule.repository';
import { PrismaVisitRepository } from './infrastructure/persistence/repositories/prisma-visit.repository';
import { PrismaClsOrderRepository } from './infrastructure/persistence/repositories/prisma-cls-order.repository';
import { PrismaPrescriptionRepository } from './infrastructure/persistence/repositories/prisma-prescription.repository';
import { PdfService } from './infrastructure/services/pdf.service';
import { OcrService } from './infrastructure/services/ocr.service';
import { AppointmentsController } from './presentation/controllers/appointments.controller';
import { InvoicesController } from './presentation/controllers/invoices.controller';
import { AiController } from './presentation/controllers/ai.controller';
import { AuthModule } from './infrastructure/auth/auth.module';
import { ConsoleEmailAdapter } from './infrastructure/notifications/console-email.adapter';
import { SmtpEmailAdapter } from './infrastructure/notifications/smtp-email.adapter';
import { NotificationLogService } from './infrastructure/notifications/notification-log.service';
import { RealtimeGateway } from './infrastructure/realtime/realtime.gateway';
import { LocalDiskStorageAdapter } from './infrastructure/storage/local-disk-storage.adapter';
import { S3StorageAdapter } from './infrastructure/storage/s3-storage.adapter';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { PrismaMedicalRecordRepository } from './infrastructure/persistence/repositories/prisma-medical-record.repository';
import { PrismaMessageRepository } from './infrastructure/persistence/repositories/prisma-message.repository';
import { PrismaMessageCatalogRepository } from './infrastructure/persistence/repositories/prisma-message-catalog.repository';
import { PrismaOtpTokenRepository } from './infrastructure/persistence/repositories/prisma-otp-token.repository';
import { PrismaPatientRepository } from './infrastructure/persistence/repositories/prisma-patient.repository';
import { PrismaRefreshTokenRepository } from './infrastructure/persistence/repositories/prisma-refresh-token.repository';
import { PrismaRoomRepository } from './infrastructure/persistence/repositories/prisma-room.repository';
import { PrismaUserRepository } from './infrastructure/persistence/repositories/prisma-user.repository';
import { AuditLogService } from './infrastructure/persistence/repositories/audit-log.service';
import { AiChatLogService } from './infrastructure/persistence/repositories/ai-chat-log.service';
import { GroqAiProviderAdapter } from './infrastructure/ai/groq-ai-provider.adapter';
import { AuthController } from './presentation/controllers/auth.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { MessagesController } from './presentation/controllers/messages.controller';
import { RoomsController } from './presentation/controllers/rooms.controller';
import { SchedulesController } from './presentation/controllers/schedules.controller';
import { UsersController } from './presentation/controllers/users.controller';
import { GlobalExceptionFilter } from './presentation/filters/global-exception.filter';
import { MessageCodeValidationPipe } from './presentation/pipes/message-code-validation.pipe';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { AuditLogInterceptor } from './presentation/interceptors/audit-log.interceptor';
import { LoggingInterceptor } from './presentation/interceptors/logging.interceptor';
import { RequestIdInterceptor } from './presentation/interceptors/request-id.interceptor';
import { ResponseTransformInterceptor } from './presentation/interceptors/response-transform.interceptor';
import { MedicalRecordsController } from './presentation/controllers/medical-records.controller';
import { PatientsController } from './presentation/controllers/patients.controller';
import { ClsRoomsController } from './presentation/controllers/cls-rooms.controller';
import { CreateClsRoomUseCase } from './application/use-cases/cls-rooms/create-cls-room.use-case';
import { UpdateClsRoomUseCase } from './application/use-cases/cls-rooms/update-cls-room.use-case';
import { ListClsRoomsUseCase } from './application/use-cases/cls-rooms/list-cls-rooms.use-case';
import { ActivateClsRoomUseCase } from './application/use-cases/cls-rooms/activate-cls-room.use-case';
import { DeactivateClsRoomUseCase } from './application/use-cases/cls-rooms/deactivate-cls-room.use-case';
import { PublicDoctorsController } from './presentation/controllers/public-doctors.controller';
import { PublicServicesController } from './presentation/controllers/public-services.controller';
import { PublicClinicInfoController } from './presentation/controllers/public-clinic-info.controller';
import { DoctorSpecialtiesController } from './presentation/controllers/doctor-specialties.controller';
import { VisitsController } from './presentation/controllers/visits.controller';
import { ClsOrdersController } from './presentation/controllers/cls-orders.controller';
import { ResultsController } from './presentation/controllers/results.controller';
import { PrescriptionsController } from './presentation/controllers/prescriptions.controller';
import { MedicinesController } from './presentation/controllers/medicines.controller';
import { SuppliersController } from './presentation/controllers/suppliers.controller';
import { ListMedicinesUseCase } from './application/use-cases/medicines/list-medicines.use-case';
import { CreateMedicineUseCase } from './application/use-cases/medicines/create-medicine.use-case';
import { UpdateMedicineUseCase } from './application/use-cases/medicines/update-medicine.use-case';
import { DeleteMedicineUseCase } from './application/use-cases/medicines/delete-medicine.use-case';
import { ListSuppliersUseCase } from './application/use-cases/suppliers/list-suppliers.use-case';
import { CreateSupplierUseCase } from './application/use-cases/suppliers/create-supplier.use-case';
import { UpdateSupplierUseCase } from './application/use-cases/suppliers/update-supplier.use-case';
import { DeleteSupplierUseCase } from './application/use-cases/suppliers/delete-supplier.use-case';
import { MEDICINE_REPOSITORY } from './domain/repositories/medicine.repository';
import { SUPPLIER_REPOSITORY } from './domain/repositories/supplier.repository';
import { PrismaMedicineRepository } from './infrastructure/persistence/repositories/prisma-medicine.repository';
import { PrismaSupplierRepository } from './infrastructure/persistence/repositories/prisma-supplier.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { UploadsController } from './presentation/controllers/uploads.controller';
import { ListNotificationsUseCase } from './application/use-cases/notifications/list-notifications.use-case';
import { MarkNotificationReadUseCase } from './application/use-cases/notifications/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from './application/use-cases/notifications/mark-all-notifications-read.use-case';
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository';
import { PrismaNotificationRepository } from './infrastructure/persistence/repositories/prisma-notification.repository';
import { CreateSupplyCategoryUseCase } from './application/use-cases/supply-categories/create-supply-category.use-case';
import { UpdateSupplyCategoryUseCase } from './application/use-cases/supply-categories/update-supply-category.use-case';
import { DeleteSupplyCategoryUseCase } from './application/use-cases/supply-categories/delete-supply-category.use-case';
import { ListSupplyCategoriesUseCase } from './application/use-cases/supply-categories/list-supply-categories.use-case';
import { CreateSupplyUseCase } from './application/use-cases/supplies/create-supply.use-case';
import { UpdateSupplyUseCase } from './application/use-cases/supplies/update-supply.use-case';
import { DeleteSupplyUseCase } from './application/use-cases/supplies/delete-supply.use-case';
import { ListSuppliesUseCase } from './application/use-cases/supplies/list-supplies.use-case';
import { ListSupplyTransactionsUseCase } from './application/use-cases/supplies/list-supply-transactions.use-case';
import { ImportSuppliesUseCase } from './application/use-cases/supplies/import-supplies.use-case';
import { DistributeSupplyUseCase } from './application/use-cases/supplies/distribute-supply.use-case';
import { SUPPLY_CATEGORY_REPOSITORY } from './domain/repositories/supply-category.repository';
import { SUPPLY_REPOSITORY } from './domain/repositories/supply.repository';
import { PrismaSupplyCategoryRepository } from './infrastructure/persistence/repositories/prisma-supply-category.repository';
import { PrismaSupplyRepository } from './infrastructure/persistence/repositories/prisma-supply.repository';
import { SupplyCategoriesController } from './presentation/controllers/supply-categories.controller';
import { SuppliesController } from './presentation/controllers/supplies.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig, clinicConfig],
      validationSchema: envValidationSchema,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    HealthController,
    MessagesController,
    AuthController,
    UsersController,
    ClsRoomsController,
    RoomsController,
    SchedulesController,
    PatientsController,
    MedicalRecordsController,
    ServicesController,
    AppointmentsController,
    InvoicesController,
    AiController,
    PublicDoctorsController,
    PublicServicesController,
    PublicClinicInfoController,
    DoctorSpecialtiesController,
    VisitsController,
    ClsOrdersController,
    ResultsController,
    PrescriptionsController,
    MedicinesController,
    SuppliersController,
    NotificationsController,
    UploadsController,
    SupplyCategoriesController,
    SuppliesController,
    SystemLogsController,
  ],
  providers: [
    GetMessageUseCase,
    ListMessagesUseCase,
    ReloadMessagesUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    ForgotPasswordUseCase,
    VerifyOtpUseCase,
    ResetPasswordUseCase,
    ChangePasswordUseCase,
    LogoutUseCase,
    RegisterUseCase,
    GetMyProfileUseCase,
    UpdateMyProfileUseCase,
    CreateRoomUseCase,
    ListRoomsUseCase,
    GetRoomByIdUseCase,
    UpdateRoomUseCase,
    ActivateRoomUseCase,
    DeactivateRoomUseCase,
    CreateScheduleUseCase,
    CreateBulkScheduleUseCase,
    UpdateScheduleUseCase,
    DeleteScheduleUseCase,
    ListSchedulesUseCase,
    GetScheduleUseCase,
    ReassignScheduleDoctorUseCase,
    ListPatientsUseCase,
    GetPatientUseCase,
    CreatePatientUseCase,
    UpdatePatientUseCase,
    ListMedicalRecordsUseCase,
    GetMedicalRecordUseCase,
    UpdateMedicalRecordUseCase,
    PrintMedicalRecordUseCase,
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ToggleUserStatusUseCase,
    ResetUserPasswordUseCase,
    ListServicesUseCase,
    CreateServiceUseCase,
    UpdateServiceUseCase,
    DeleteServiceUseCase,
    CreateAppointmentUseCase,
    CreateGuestAppointmentUseCase,
    RequestGuestAppointmentOtpUseCase,
    ConfirmGuestAppointmentOtpUseCase,
    ListAppointmentsUseCase,
    CheckInAppointmentUseCase,
    ConfirmCheckInPaymentUseCase,
    CancelAppointmentUseCase,
    UpdateAppointmentUseCase,
    ConfirmAppointmentUseCase,
    RejectAppointmentUseCase,
    CreateInvoiceUseCase,
    GetInvoiceUseCase,
    ListInvoicesUseCase,
    PayInvoiceUseCase,
    FindAvailableDoctorsUseCase,
    GetAvailabilityCalendarUseCase,
    SuggestAppointmentSlotsUseCase,
    CreateClsRoomUseCase,
    UpdateClsRoomUseCase,
    ListClsRoomsUseCase,
    ActivateClsRoomUseCase,
    DeactivateClsRoomUseCase,
    ListPublicDoctorsUseCase,
    GetPublicDoctorUseCase,
    ListPublicServicesUseCase,
    GetClinicInfoUseCase,
    ListSpecialtiesUseCase,
    CreateSpecialtyUseCase,
    UpdateSpecialtyUseCase,
    DeleteSpecialtyUseCase,
    ListDoctorSpecialtyProfilesUseCase,
    GetMyDoctorSpecialtyUseCase,
    UpdateMyDoctorSpecialtyUseCase,
    ChatWithAiUseCase,
    GetAiChatHistoryUseCase,
    SummarizeExamResultUseCase,
    RunRecheckReminderUseCase,
    ListRecheckNotificationsUseCase,
    RecheckReminderScheduler,
    RunEndOfDayCleanupUseCase,
    EndOfDayCleanupScheduler,
    UpdateDoctorSpecialtyProfileUseCase,
    ApproveDoctorSpecialtyUpdateUseCase,
    RejectDoctorSpecialtyUpdateUseCase,
    PdfService,
    OcrService,
    ListMedicinesUseCase,
    CreateMedicineUseCase,
    UpdateMedicineUseCase,
    DeleteMedicineUseCase,
    ListSuppliersUseCase,
    CreateSupplierUseCase,
    UpdateSupplierUseCase,
    DeleteSupplierUseCase,
    ListVisitsUseCase,
    ListNurseQueueUseCase,
    GetVisitQueueContextUseCase,
    ResolveActorShiftService,
    DoctorSlotService,
    AppointmentTrustService,
    InvoiceBillingService,
    CallPatientUseCase,
    StartVisitUseCase,
    HoldForResultsUseCase,
    MarkNoShowUseCase,
    PrintExaminationAdmissionUseCase,
    PrintAllClsOrdersUseCase,
    ListNotificationsUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
    CreateExaminationResultUseCase,
    UpdateExaminationResultUseCase,
    UpsertVitalSignsUseCase,
    GetVitalSignsUseCase,
    CompleteVisitUseCase,
    GetVisitResultUseCase,
    GetResultByCodeUseCase,
    CreateClsOrderUseCase,
    ListClsOrdersUseCase,
    ListAllClsOrdersUseCase,
    CallPatientToClsUseCase,
    EnterClsResultUseCase,
    ExtractClsResultOcrUseCase,
    EditClsOrderUseCase,
    CreatePrescriptionUseCase,
    GetPrescriptionUseCase,
    UpdatePrescriptionUseCase,
    CreateSupplyCategoryUseCase,
    UpdateSupplyCategoryUseCase,
    DeleteSupplyCategoryUseCase,
    ListSupplyCategoriesUseCase,
    CreateSupplyUseCase,
    UpdateSupplyUseCase,
    DeleteSupplyUseCase,
    ListSuppliesUseCase,
    ListSupplyTransactionsUseCase,
    ImportSuppliesUseCase,
    DistributeSupplyUseCase,
    { provide: MEDICINE_REPOSITORY, useClass: PrismaMedicineRepository },
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    { provide: VISIT_REPOSITORY, useClass: PrismaVisitRepository },
    { provide: CLS_ORDER_REPOSITORY, useClass: PrismaClsOrderRepository },
    { provide: PRESCRIPTION_REPOSITORY, useClass: PrismaPrescriptionRepository },
    { provide: SERVICE_REPOSITORY, useClass: PrismaServiceRepository },
    { provide: SPECIALTY_REPOSITORY, useClass: PrismaSpecialtyRepository },
    { provide: APPOINTMENT_REPOSITORY, useClass: PrismaAppointmentRepository },
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    { provide: WORK_SCHEDULE_REPOSITORY, useClass: PrismaWorkScheduleRepository },
    { provide: SYSTEM_LOG_REPOSITORY, useClass: PrismaSystemLogRepository },
    ListSystemLogsUseCase,
    { provide: AUDIT_LOG_PORT, useClass: AuditLogService },
    { provide: AI_CHAT_LOG_PORT, useClass: AiChatLogService },
    { provide: AI_PROVIDER_PORT, useClass: GroqAiProviderAdapter },
    { provide: MESSAGE_REPOSITORY, useClass: PrismaMessageRepository },
    { provide: MESSAGE_CATALOG_PORT, useClass: PrismaMessageCatalogRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ROOM_REPOSITORY, useClass: PrismaRoomRepository },
    { provide: PATIENT_REPOSITORY, useClass: PrismaPatientRepository },
    { provide: MEDICAL_RECORD_REPOSITORY, useClass: PrismaMedicalRecordRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: OTP_TOKEN_REPOSITORY, useClass: PrismaOtpTokenRepository },
    // Real SMTP adapter is used only when its env vars are configured; local
    // dev falls back to the console/log stub so the app runs with zero
    // external setup.
    {
      provide: EMAIL_PORT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        process.env.SMTP_HOST ? new SmtpEmailAdapter(configService) : new ConsoleEmailAdapter(),
    },
    // Real S3 upload is used whenever a bucket is configured; local dev
    // falls back to disk storage under ./uploads (see
    // LocalDiskStorageAdapter — not suitable for a real deployment).
    // Deliberately does NOT also require AWS_ACCESS_KEY_ID here — on EC2,
    // credentials come from an attached IAM Role via the SDK's default
    // provider chain (see S3StorageAdapter), so no access key env var is
    // ever set there.
    {
      provide: STORAGE_PORT,
      useFactory: () => (process.env.S3_BUCKET ? new S3StorageAdapter() : new LocalDiskStorageAdapter()),
    },
    { provide: NOTIFICATION_PORT, useClass: NotificationLogService },
    { provide: REALTIME_PORT, useClass: RealtimeGateway },
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: SUPPLY_CATEGORY_REPOSITORY, useClass: PrismaSupplyCategoryRepository },
    { provide: SUPPLY_REPOSITORY, useClass: PrismaSupplyRepository },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useClass: MessageCodeValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
