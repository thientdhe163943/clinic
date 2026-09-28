import { Specialty } from '../entities/specialty.entity';

export const SPECIALTY_REPOSITORY = Symbol('SPECIALTY_REPOSITORY');

export interface SpecialtyRepository {
  findById(id: string): Promise<Specialty | null>;
  findByIds(ids: string[]): Promise<Specialty[]>;
  findAll(): Promise<Specialty[]>;
  findByName(name: string): Promise<Specialty | null>;
  create(data: { name: string; description?: string | null }): Promise<Specialty>;
  update(id: string, data: { name?: string; description?: string | null }): Promise<Specialty>;
  delete(id: string): Promise<void>;
  isInUse(id: string): Promise<boolean>;
}
