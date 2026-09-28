import { Controller, Get, Query } from '@nestjs/common';
import { ListPublicServicesQueryDto } from '../../application/dtos/public-services/list-public-services-query.dto';
import { ListPublicServicesUseCase } from '../../application/use-cases/public-services/list-public-services.use-case';
import { Public } from '../decorators/public.decorator';

@Public()
@Controller('public/services')
export class PublicServicesController {
  constructor(private readonly listPublicServicesUseCase: ListPublicServicesUseCase) {}

  @Get()
  list(@Query() query: ListPublicServicesQueryDto) {
    return this.listPublicServicesUseCase.execute({
      search: query.search,
      specialtyId: query.specialtyId,
    });
  }
}
