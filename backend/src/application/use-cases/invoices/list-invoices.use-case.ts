import { Inject, Injectable } from '@nestjs/common';
import { ListInvoicesQueryDto } from '../../dtos/invoices/list-invoices-query.dto';
import { InvoiceListResponseDto, toInvoiceResponse } from '../../dtos/invoices/invoice-response.dto';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import {
  INVOICE_REPOSITORY,
  InvoiceRepository,
} from '../../../domain/repositories/invoice.repository';

@Injectable()
export class ListInvoicesUseCase {
  constructor(@Inject(INVOICE_REPOSITORY) private readonly invoiceRepository: InvoiceRepository) {}

  async execute(query: ListInvoicesQueryDto): Promise<InvoiceListResponseDto> {
    const { items, total } = await this.invoiceRepository.findMany({
      search: query.search,
      paymentStatus: query.paymentStatus,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: items.map(({ invoice, patientName, patientCode }) => toInvoiceResponse(invoice, patientName, patientCode)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
