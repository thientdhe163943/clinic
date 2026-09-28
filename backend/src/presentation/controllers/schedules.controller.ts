import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateBulkScheduleRequestDto } from '../../application/dtos/schedules/create-bulk-schedule.dto';
import { CreateScheduleRequestDto } from '../../application/dtos/schedules/create-schedule.dto';
import { ListSchedulesQueryDto } from '../../application/dtos/schedules/list-schedules-query.dto';
import { ReassignScheduleDoctorRequestDto } from '../../application/dtos/schedules/reassign-schedule-doctor.dto';
import { UpdateScheduleRequestDto } from '../../application/dtos/schedules/update-schedule.dto';
import { CreateBulkScheduleUseCase } from '../../application/use-cases/schedules/create-bulk-schedule.use-case';
import { CreateScheduleUseCase } from '../../application/use-cases/schedules/create-schedule.use-case';
import { DeleteScheduleUseCase } from '../../application/use-cases/schedules/delete-schedule.use-case';
import { GetScheduleUseCase } from '../../application/use-cases/schedules/get-schedule.use-case';
import { ListSchedulesUseCase } from '../../application/use-cases/schedules/list-schedules.use-case';
import { ReassignScheduleDoctorUseCase } from '../../application/use-cases/schedules/reassign-schedule-doctor.use-case';
import { UpdateScheduleUseCase } from '../../application/use-cases/schedules/update-schedule.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

@Controller('schedules')
export class SchedulesController {
  constructor(
    private readonly listSchedulesUseCase: ListSchedulesUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly createScheduleUseCase: CreateScheduleUseCase,
    private readonly createBulkScheduleUseCase: CreateBulkScheduleUseCase,
    private readonly updateScheduleUseCase: UpdateScheduleUseCase,
    private readonly deleteScheduleUseCase: DeleteScheduleUseCase,
    private readonly reassignScheduleDoctorUseCase: ReassignScheduleDoctorUseCase,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH, UserRole.RECEPTIONIST)
  list(@Query() query: ListSchedulesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.listSchedulesUseCase.execute({ ...query, actorId: user.sub, actorRole: user.role });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH, UserRole.RECEPTIONIST)
  getById(@Param('id') id: string) {
    return this.getScheduleUseCase.execute(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0031)
  @SkipAudit()
  create(@Body() dto: CreateScheduleRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createScheduleUseCase.execute({ ...dto, createdBy: user.sub });
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0087)
  createBulk(@Body() dto: CreateBulkScheduleRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.createBulkScheduleUseCase.execute({ ...dto, createdBy: user.sub });
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0032)
  @SkipAudit()
  update(@Param('id') id: string, @Body() dto: UpdateScheduleRequestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.updateScheduleUseCase.execute({ ...dto, id, updatedBy: user.sub });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0033)
  @SkipAudit()
  delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.deleteScheduleUseCase.execute(id, user.sub);
  }

  // Version-up 0.2 Phase 2 #9 tình huống B: ADMIN marks a doctor absent for
  // the whole shift and swaps in a substitute doctor in one call.
  @Patch(':id/reassign')
  @Roles(UserRole.ADMIN)
  @MsgCode(MSG.INFO_0098)
  @SkipAudit()
  reassignDoctor(
    @Param('id') id: string,
    @Body() dto: ReassignScheduleDoctorRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reassignScheduleDoctorUseCase.execute({ ...dto, scheduleId: id, actorId: user.sub });
  }
}
