import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListPublicDoctorsQueryDto } from '../../application/dtos/public-doctors/list-public-doctors-query.dto';
import { GetPublicDoctorUseCase } from '../../application/use-cases/public-doctors/get-public-doctor.use-case';
import { ListPublicDoctorsUseCase } from '../../application/use-cases/public-doctors/list-public-doctors.use-case';
import { Public } from '../decorators/public.decorator';

@Public()
@Controller('public/doctors')
export class PublicDoctorsController {
  constructor(
    private readonly listPublicDoctorsUseCase: ListPublicDoctorsUseCase,
    private readonly getPublicDoctorUseCase: GetPublicDoctorUseCase,
  ) {}

  @Get()
  list(@Query() query: ListPublicDoctorsQueryDto) {
    return this.listPublicDoctorsUseCase.execute(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.getPublicDoctorUseCase.execute(id);
  }
}
