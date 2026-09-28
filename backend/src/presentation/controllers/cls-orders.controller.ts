import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CreateClsOrderDto } from '../../application/dtos/cls-orders/create-cls-order.dto';
import { EditClsOrderDto } from '../../application/dtos/cls-orders/edit-cls-order.dto';
import { EnterClsResultDto } from '../../application/dtos/cls-orders/enter-cls-result.dto';
import {
  AttachmentBeforeResultSavedError,
  ClsOrderNotFoundError,
  ClsResultNotEnteredError,
  InvalidAttachmentTypeError,
  NoFileUploadedError,
} from '../../application/errors/application-error';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { UserRole } from '../../domain/enums/user-role.enum';
import { ClsOrderStatus } from '../../domain/enums/cls-order-status.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { CreateClsOrderUseCase } from '../../application/use-cases/cls-orders/create-cls-order.use-case';
import { EditClsOrderUseCase } from '../../application/use-cases/cls-orders/edit-cls-order.use-case';
import { ListClsOrdersUseCase } from '../../application/use-cases/cls-orders/list-cls-orders.use-case';
import { ListAllClsOrdersUseCase } from '../../application/use-cases/cls-orders/list-all-cls-orders.use-case';
import { CallPatientToClsUseCase } from '../../application/use-cases/cls-orders/call-patient-to-cls.use-case';
import { EnterClsResultUseCase } from '../../application/use-cases/cls-orders/enter-cls-result.use-case';
import { ExtractClsResultOcrUseCase } from '../../application/use-cases/cls-orders/extract-cls-result-ocr.use-case';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../domain/repositories/cls-order.repository';
import { USER_REPOSITORY, UserRepository } from '../../domain/repositories/user.repository';
import { toClsOrderResponse } from '../../application/dtos/cls-orders/cls-order-response.dto';
import { PdfService } from '../../infrastructure/services/pdf.service';
import { STORAGE_PORT, StoragePort } from '../../application/ports/storage.port';

@Controller('cls-orders')
export class ClsOrdersController {
  constructor(
    private readonly createClsOrderUseCase: CreateClsOrderUseCase,
    private readonly editClsOrderUseCase: EditClsOrderUseCase,
    private readonly listClsOrdersUseCase: ListClsOrdersUseCase,
    private readonly listAllClsOrdersUseCase: ListAllClsOrdersUseCase,
    private readonly callPatientToClsUseCase: CallPatientToClsUseCase,
    private readonly enterClsResultUseCase: EnterClsResultUseCase,
    private readonly extractClsResultOcrUseCase: ExtractClsResultOcrUseCase,
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly pdfService: PdfService,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  // Feature 17 — Create CLS order (INFO_0047)
  @Post()
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0047)
  @SkipAudit()
  create(@Body() dto: CreateClsOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createClsOrderUseCase.execute({ ...dto, actorId: user.sub });
  }

  // List CLS orders: by visitId (doctor) or today's queue for KTV (lab tech)
  @Get()
  @Roles(UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH)
  list(
    @Query('visitId') visitId?: string,
    @Query('statuses') statuses?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (visitId) {
      return this.listClsOrdersUseCase.execute(visitId);
    }
    const statusFilter = statuses
      ? (statuses.split(',') as ClsOrderStatus[])
      : undefined;
    return this.listAllClsOrdersUseCase.execute(user!.sub, statusFilter);
  }

  // Get single CLS order by ID (for result entry page)
  @Get(':id')
  @Roles(UserRole.LAB_TECH, UserRole.DOCTOR, UserRole.NURSE)
  async getById(@Param('id') id: string) {
    const item = await this.clsOrderRepository.findWithDetailById(id);
    if (!item) throw new ClsOrderNotFoundError();
    return toClsOrderResponse(
      item.order,
      item.serviceName,
      item.clsRoomName,
      item.patientName,
      item.patientCode,
      item.dateOfBirth,
      item.gender,
      item.doctorName,
      item.appointmentTime,
      item.resultSummary,
      item.resultAttachments,
      item.resultRows,
      item.clsRoomCategory,
      item.resultFindings,
    );
  }

  // Edit CLS order — only while PENDING (INFO_0088)
  @Patch(':id')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0088)
  @SkipAudit()
  edit(@Param('id') id: string, @Body() dto: EditClsOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.editClsOrderUseCase.execute(id, dto, user.sub);
  }

  // Feature 18 — Call patient into CLS room (INFO_0048, has {room_code} placeholder)
  @Patch(':id/call')
  @Roles(UserRole.LAB_TECH)
  @SkipAudit()
  async callPatient(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: RequestWithTrace) {
    const result = await this.callPatientToClsUseCase.execute(id, user.sub);
    const message = this.messageCatalog.getMessage(MSG.INFO_0048, DEFAULT_LOCALE, {
      room_code: result.clsRoomName,
    });
    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // Feature 19 — Enter CLS result (draft: INFO_0049, finalize: INFO_0101).
  // Dynamic message per dto.finalize, so a plain @MsgCode alone can't cover
  // it — build the ApiResponse here, same pattern as callPatient() below.
  @Patch(':id/result')
  @Roles(UserRole.LAB_TECH)
  @SkipAudit()
  async enterResult(
    @Param('id') id: string,
    @Body() dto: EnterClsResultDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: RequestWithTrace,
  ) {
    const result = await this.enterClsResultUseCase.execute(
      id,
      dto.summary,
      user.sub,
      dto.rows,
      dto.findings,
      dto.finalize,
    );
    const message = this.messageCatalog.getMessage(
      dto.finalize ? MSG.INFO_0101 : MSG.INFO_0049,
      DEFAULT_LOCALE,
    );
    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  // version-up 0.2 Phase 3 — OCR pre-fill for LAB result entry. Draft only:
  // nothing is saved here, the KTV reviews/edits the returned rows and then
  // calls the existing PATCH :id/result to actually persist them.
  @Post(':id/ocr-extract')
  @Roles(UserRole.LAB_TECH)
  @MsgCode(MSG.INFO_0099)
  @SkipAudit()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png'];
        if (!allowed.includes(file.mimetype)) {
          cb(new InvalidAttachmentTypeError(), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async ocrExtract(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new NoFileUploadedError();
    return this.extractClsResultOcrUseCase.execute(id, file.buffer);
  }

  // Feature 17 — Print CLS order PDF (routing slip for patient)
  @Get(':id/print')
  @Roles(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.NURSE)
  async printClsOrder(@Param('id') id: string, @Res() res: Response) {
    const item = await this.clsOrderRepository.findWithDetailById(id);
    if (!item) throw new ClsOrderNotFoundError();
    const pdf = await this.pdfService.generateClsOrderPdf({
      clsOrderId: item.order.id,
      patientName: item.patientName,
      patientCode: item.patientCode,
      dateOfBirth: item.dateOfBirth,
      gender: item.gender,
      doctorName: item.doctorName,
      serviceName: item.serviceName,
      clsRoomName: item.clsRoomName,
      note: item.order.note,
      createdAt: item.order.createdAt,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cls-order-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  // Print CLS result PDF (result slip KTV gives to patient)
  @Get(':id/result-print')
  @Roles(UserRole.LAB_TECH, UserRole.DOCTOR, UserRole.RECEPTIONIST)
  async printClsResult(@Param('id') id: string, @Res() res: Response) {
    const item = await this.clsOrderRepository.findWithDetailById(id);
    if (!item) throw new ClsOrderNotFoundError();
    // Only a finalized result may be printed — a draft saved while still
    // IN_PROGRESS (finalize=false) has a resultSummary too, but isn't
    // confirmed yet and shouldn't be handed to the patient as final.
    if (!item.resultSummary || item.order.status !== ClsOrderStatus.COMPLETED) {
      throw new ClsResultNotEnteredError();
    }

    // Read image buffers back via the storage port; skip files that can't be
    // read or aren't images. Deliberately not reading straight off local
    // disk here — this.storage resolves each adapter's own url shape
    // (S3StorageAdapter's `url` is an absolute https:// URL, fetched over
    // HTTP; LocalDiskStorageAdapter's is a relative path, read off disk).
    // A prior version of this handler always joined the url onto a disk
    // path, which silently failed (caught below, no buffer) for every
    // attachment once the app started running against S3 in production —
    // the print PDF fell back to listing just the filename instead of
    // embedding the image.
    const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png']);
    const attachments = await Promise.all(
      item.resultAttachments.map(async (a) => {
        const ext = a.fileName.split('.').pop()?.toLowerCase() ?? '';
        if (!IMAGE_EXTS.has(ext)) return { fileName: a.fileName };
        try {
          const buffer = await this.storage.read(a.fileUrl);
          return { fileName: a.fileName, buffer };
        } catch {
          return { fileName: a.fileName };
        }
      }),
    );

    const enteredByUser = item.resultEnteredBy ? await this.userRepository.findById(item.resultEnteredBy) : null;

    const pdf = await this.pdfService.generateClsResultPdf({
      clsOrderId: item.order.id,
      patientName: item.patientName,
      patientCode: item.patientCode,
      dateOfBirth: item.dateOfBirth,
      gender: item.gender,
      doctorName: item.doctorName,
      serviceName: item.serviceName,
      clsRoomName: item.clsRoomName,
      clsRoomCategory: item.clsRoomCategory,
      summary: item.resultSummary,
      resultRows: item.resultRows,
      findings: item.resultFindings,
      completedAt: item.order.createdAt,
      attachments,
      enteredByName: enteredByUser?.fullName ?? null,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cls-result-${id}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }

  // Upload attachment for a CLS result (INFO_0051)
  @Post(':id/attachments')
  @Roles(UserRole.LAB_TECH)
  @MsgCode(MSG.INFO_0051)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.mimetype)) {
          cb(new InvalidAttachmentTypeError(), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new NoFileUploadedError();

    const item = await this.clsOrderRepository.findWithDetailById(id);
    if (!item) throw new ClsOrderNotFoundError();
    // A result must exist (draft or finalized) before a file can be linked
    // to it — no longer requires the order to be COMPLETED, since a KTV may
    // now save a draft (finalize=false) and keep attaching evidence while
    // still IN_PROGRESS.
    if (!item.resultSummary) {
      throw new AttachmentBeforeResultSavedError();
    }

    const uploaded = await this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'cls-attachments',
    });

    const ext = file.originalname.split('.').pop()?.toUpperCase() ?? '';
    const fileType =
      ext === 'PDF' ? 'PDF' :
      ext === 'PNG' ? 'PNG' :
      'JPG';

    await this.clsOrderRepository.addAttachment(id, {
      fileName: file.originalname,
      fileUrl: uploaded.url,
      fileType: fileType as 'PDF' | 'JPG' | 'PNG',
      fileSizeKb: Math.ceil(file.size / 1024),
      uploadedBy: user.sub,
    });

    return { url: uploaded.url, fileName: file.originalname };
  }
}
