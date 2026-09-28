import { Inject, Injectable } from '@nestjs/common';
import { InvoiceResponseDto, toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import {
  INVOICE_REPOSITORY,
  InvoiceRepository,
} from '../../../domain/repositories/invoice.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

@Injectable()
export class GetInvoiceUseCase {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
  ) {}

  async execute(appointmentId: string): Promise<InvoiceResponseDto> {
    const invoice = await this.invoiceRepository.findByAppointmentId(appointmentId);
    if (!invoice) throw new ResourceNotFoundError('Invoice', { appointmentId });

    const patient = await this.patientRepository.findById(invoice.patientId);
    return toInvoiceResponse(invoice, patient?.fullName ?? '', patient?.patientCode ?? '');
  }
}
