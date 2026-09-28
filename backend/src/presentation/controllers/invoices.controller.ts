import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CreateInvoiceRequestDto } from '../../application/dtos/invoices/create-invoice.dto';
import { ListInvoicesQueryDto } from '../../application/dtos/invoices/list-invoices-query.dto';
import { PayInvoiceRequestDto } from '../../application/dtos/invoices/pay-invoice.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreateInvoiceUseCase } from '../../application/use-cases/invoices/create-invoice.use-case';
import { GetInvoiceUseCase } from '../../application/use-cases/invoices/get-invoice.use-case';
import { ListInvoicesUseCase } from '../../application/use-cases/invoices/list-invoices.use-case';
import { PayInvoiceUseCase } from '../../application/use-cases/invoices/pay-invoice.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { ApiResponse } from '../response/api-response';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';

@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly payInvoiceUseCase: PayInvoiceUseCase,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Get()
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  list(@Query() query: ListInvoicesQueryDto) {
    return this.listInvoicesUseCase.execute(query);
  }

  // MSG.INFO_0060 has a `{invoice_code}` placeholder the static @MsgCode
  // decorator can't fill (it never sees response data) — build manually,
  // same approach as AppointmentsController.create.
  @Post()
  @Roles(UserRole.RECEPTIONIST)
  @SkipAudit()
  async create(
    @Body() dto: CreateInvoiceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.createInvoiceUseCase.execute({ ...dto, actorId: user.sub });
    const message = this.messageCatalog.getMessage(MSG.INFO_0060, DEFAULT_LOCALE, {
      invoice_code: result.invoiceCode,
    });

    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Get(':appointmentId')
  @Roles(UserRole.RECEPTIONIST, UserRole.ADMIN)
  getByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.getInvoiceUseCase.execute(appointmentId);
  }

  @Patch(':id/pay')
  @Roles(UserRole.RECEPTIONIST)
  @MsgCode(MSG.INFO_0006)
  @SkipAudit()
  pay(@Param('id') id: string, @Body() dto: PayInvoiceRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payInvoiceUseCase.execute({ ...dto, invoiceId: id, actorId: user.sub });
  }
}
