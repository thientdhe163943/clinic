import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreatePrescriptionDto } from '../../application/dtos/prescriptions/create-prescription.dto';
import { UpdatePrescriptionDto } from '../../application/dtos/prescriptions/update-prescription.dto';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { UserRole } from '../../domain/enums/user-role.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { CreatePrescriptionUseCase } from '../../application/use-cases/prescriptions/create-prescription.use-case';
import { GetPrescriptionUseCase } from '../../application/use-cases/prescriptions/get-prescription.use-case';
import { UpdatePrescriptionUseCase } from '../../application/use-cases/prescriptions/update-prescription.use-case';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly createPrescriptionUseCase: CreatePrescriptionUseCase,
    private readonly getPrescriptionUseCase: GetPrescriptionUseCase,
    private readonly updatePrescriptionUseCase: UpdatePrescriptionUseCase,
  ) {}

  // Feature 21 — Create prescription (INFO_0055)
  @Post()
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0055)
  @SkipAudit()
  create(@Body() dto: CreatePrescriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createPrescriptionUseCase.execute({ ...dto, actorId: user.sub });
  }

  // Feature 21 — Update prescription (replace all items)
  @Patch(':id')
  @Roles(UserRole.DOCTOR)
  @MsgCode(MSG.INFO_0055)
  @SkipAudit()
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePrescriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updatePrescriptionUseCase.execute({ prescriptionId: id, ...dto, actorId: user.sub });
  }

  // Feature 21 — Get prescription by visitId
  @Get()
  @Roles(UserRole.DOCTOR, UserRole.NURSE, UserRole.RECEPTIONIST)
  getByVisit(@Query('visitId') visitId: string) {
    return this.getPrescriptionUseCase.getByVisitId(visitId);
  }
}
