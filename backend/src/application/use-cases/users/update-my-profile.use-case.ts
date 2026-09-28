import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { ConflictError, ResourceNotFoundError } from '../../errors/application-error';
import { UpdateProfileRequestDto } from '../../dtos/users/update-profile.dto';
import { UserProfileResponseDto } from '../../dtos/users/user-profile.dto';

export interface UpdateMyProfileInput extends UpdateProfileRequestDto {
  userId: string;
}

@Injectable()
export class UpdateMyProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
  ) {}

  async execute(input: UpdateMyProfileInput): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new ResourceNotFoundError('User');

    if (input.email && input.email !== user.email) {
      const existing = await this.userRepository.findByEmail(input.email);
      if (existing && existing.id !== user.id) throw new ConflictError('Email');
    }

    if (input.phone && input.phone !== user.phone) {
      const existing = await this.userRepository.findByPhone(input.phone);
      if (existing && existing.id !== user.id) throw new ConflictError('Số điện thoại');
    }

    if (user.role === UserRole.PATIENT && input.phone && input.phone !== user.phone) {
      const existingPatient = await this.patientRepository.findByPhone(input.phone);
      if (existingPatient && existingPatient.userId !== user.id) throw new ConflictError('Số điện thoại');
    }

    const updated = await this.userRepository.update(user.id, {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
    });

    let idCard: string | null = updated.idCard;
    if (updated.role === UserRole.PATIENT) {
      const patient = await this.patientRepository.findByUserId(updated.id);
      if (patient) {
        const updatedPatient = await this.patientRepository.update(patient.id, {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          updatedBy: updated.id,
        });
        idCard = updatedPatient.idCard;
      }
    }

    return {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
      idCard,
      role: updated.role,
      mustChangePassword: updated.mustChangePassword,
      createdAt: updated.createdAt,
    };
  }
}
