import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { PasswordPolicy } from '../../../domain/value-objects/password-policy.vo';
import { PatientCode } from '../../../domain/value-objects/patient-code.vo';
import { Gender } from '../../../domain/enums/gender.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { ApplicationError, ConflictError, WeakPasswordError } from '../../errors/application-error';
import { LoginResponseDto } from '../../dtos/auth/login-response.dto';
import { issueRefreshToken, signAccessToken } from './issue-auth-tokens.util';

const BCRYPT_ROUNDS = 10;
const PATIENT_CODE_GENERATION_ATTEMPTS = 5;

export interface RegisterInput {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  idCard: string;
  password: string;
  confirmPassword: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class RegisterUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: RegisterInput): Promise<LoginResponseDto> {
    if (input.password !== input.confirmPassword) {
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    if (!PasswordPolicy.isStrong(input.password)) throw new WeakPasswordError();

    // dateOfBirth arrives as a plain string here (RegisterRequestDto uses
    // @IsDateString(), not @Type(() => Date)), so class-validator's
    // @MaxDate can't be combined with it directly — checked manually instead.
    if (new Date(input.dateOfBirth).getTime() > Date.now()) {
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    const existingByEmail = await this.userRepository.findByEmail(input.email);
    if (existingByEmail) throw new ConflictError('Email');

    const existingByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingByPhone) throw new ConflictError('Số điện thoại');

    const existingPatient = await this.patientRepository.findByPhone(input.phone);
    if (existingPatient?.userId) throw new ConflictError('Số điện thoại');

    const existingByIdCard = await this.patientRepository.findByIdCard(input.idCard);
    if (existingByIdCard && existingByIdCard.id !== existingPatient?.id) {
      throw new ConflictError('CCCD/CMND');
    }

    // idCard now also lands on users.id_card (unique), not just
    // patients.id_card checked above — a staff member sharing the same real
    // CCCD would otherwise hit an unhandled unique-constraint error instead
    // of a clean ConflictError.
    const existingUserByIdCard = await this.userRepository.findByIdCard(input.idCard);
    if (existingUserByIdCard) throw new ConflictError('CCCD/CMND');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

    const user = await this.userRepository.create({
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: UserRole.PATIENT,
      mustChangePassword: false,
      idCard: input.idCard,
    });

    if (existingPatient) {
      await this.patientRepository.linkUser(existingPatient.id, user.id);
    } else {
      await this.createPatientProfile(user.id, input);
    }

    const accessToken = signAccessToken(this.jwtService, user);
    const refreshToken = await issueRefreshToken(this.refreshTokenRepository, this.configService, user.id, input);

    return {
      accessToken,
      refreshToken,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  private async createPatientProfile(userId: string, input: RegisterInput): Promise<void> {
    for (let attempt = 0; attempt < PATIENT_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        await this.patientRepository.create({
          patientCode: PatientCode.generate().value,
          fullName: input.fullName,
          email: input.email,
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender,
          phone: input.phone,
          idCard: input.idCard,
          userId,
          createdBy: userId,
        });
        return;
      } catch (error) {
        const isLastAttempt = attempt === PATIENT_CODE_GENERATION_ATTEMPTS - 1;
        if (isLastAttempt) throw error;
      }
    }
  }
}
