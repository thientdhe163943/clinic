import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError, ServiceInUseError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';

export interface DeleteServiceInput {
  id: string;
  deletedBy: string;
}

@Injectable()
export class DeleteServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: DeleteServiceInput): Promise<void> {
    const service = await this.serviceRepository.findById(input.id);
    if (!service) throw new ResourceNotFoundError('Service', { id: input.id });

    // Per spec Feature #46: cannot delete if linked to active appointments or unpaid invoices.
    const inUse = await this.serviceRepository.isInUse(input.id);
    if (inUse) throw new ServiceInUseError();

    await this.serviceRepository.softDelete(input.id, input.deletedBy);

    await this.auditLog.write({
      userId: input.deletedBy,
      action: 'SERVICE_DELETED',
      module: 'SERVICE',
      targetId: input.id,
    });
  }
}
