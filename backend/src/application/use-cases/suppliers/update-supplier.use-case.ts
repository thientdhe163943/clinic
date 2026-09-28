import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ResourceNotFoundError, SupplierNameExistsError } from '../../errors/application-error';
import { SupplierResponseDto } from '../../dtos/suppliers/supplier-response.dto';
import { Supplier } from '../../../domain/entities/supplier.entity';
import { SUPPLIER_REPOSITORY, SupplierRepository } from '../../../domain/repositories/supplier.repository';

export interface UpdateSupplierInput {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
  updatedBy: string;
}

@Injectable()
export class UpdateSupplierUseCase {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly supplierRepository: SupplierRepository) {}

  async execute(input: UpdateSupplierInput): Promise<SupplierResponseDto> {
    const supplier = await this.supplierRepository.findById(input.id);
    if (!supplier) throw new ResourceNotFoundError('Supplier', { id: input.id });

    if (input.name !== undefined && input.name !== supplier.name) {
      const existing = await this.supplierRepository.findByName(input.name);
      if (existing) throw new SupplierNameExistsError();
    }

    if (input.phone !== undefined && input.phone && input.phone !== supplier.phone) {
      const existingPhone = await this.supplierRepository.findByPhone(input.phone, input.id);
      if (existingPhone) throw new ConflictError('Số điện thoại', { field: 'phone' });
    }

    if (input.email !== undefined && input.email && input.email !== supplier.email) {
      const existingEmail = await this.supplierRepository.findByEmail(input.email, input.id);
      if (existingEmail) throw new ConflictError('Email', { field: 'email' });
    }

    const updated = await this.supplierRepository.update(input.id, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      address: input.address,
      description: input.description,
      updatedBy: input.updatedBy,
    });

    return this.toDto(updated);
  }

  private toDto(supplier: Supplier): SupplierResponseDto {
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      description: supplier.description,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    };
  }
}
