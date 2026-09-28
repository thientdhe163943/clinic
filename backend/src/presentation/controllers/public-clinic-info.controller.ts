import { Controller, Get } from '@nestjs/common';
import { GetClinicInfoUseCase } from '../../application/use-cases/clinic-info/get-clinic-info.use-case';
import { Public } from '../decorators/public.decorator';

@Public()
@Controller('public/clinic-info')
export class PublicClinicInfoController {
  constructor(private readonly getClinicInfoUseCase: GetClinicInfoUseCase) {}

  @Get()
  get() {
    return this.getClinicInfoUseCase.execute();
  }
}
