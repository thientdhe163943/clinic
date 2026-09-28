import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, SupplierNameExistsError } from '../../errors/application-error';
import { SupplierResponseDto } from '../../dtos/suppliers/supplier-response.dto';
import { Supplier } from '../../../domain/entities/supplier.entity';
import { SUPPLIER_REPOSITORY, SupplierRepository } from '../../../domain/repositories/supplier.repository';

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
  createdBy: string;
}

@Injectable()
export class CreateSupplierUseCase {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly supplierRepository: SupplierRepository) {}

  async execute(input: CreateSupplierInput): Promise<SupplierResponseDto> {
    const existing = await this.supplierRepository.findByName(input.name);
    if (existing) throw new SupplierNameExistsError();

    if (input.phone) {
      const existingPhone = await this.supplierRepository.findByPhone(input.phone);
      if (existingPhone) throw new ConflictError('Số điện thoại', { field: 'phone' });
    }

    if (input.email) {
      const existingEmail = await this.supplierRepository.findByEmail(input.email);
      if (existingEmail) throw new ConflictError('Email', { field: 'email' });
    }

    const supplier = await this.supplierRepository.create({
      name: input.name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      description: input.description ?? null,
      createdBy: input.createdBy,
    });

    return this.toDto(supplier);
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
