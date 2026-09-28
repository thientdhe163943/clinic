import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AccountInactiveError, AccountLockedError, InvalidCredentialsError } from '../../errors/application-error';
import { issueRefreshToken, signAccessToken } from './issue-auth-tokens.util';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { User } from '../../../domain/entities/user.entity';
import { LoginResponseDto } from '../../dtos/auth/login-response.dto';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export interface LoginInput {
  username: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: LoginInput): Promise<LoginResponseDto> {
    const user = await this.resolveUser(input.username);

    // Unknown username never reveals whether the account exists.
    if (!user) throw new InvalidCredentialsError();

    // A3: account already locked — reject without checking the password.
    if (user.lockedAt) throw new AccountLockedError();

    // A4: disabled account.
    if (!user.isActive) throw new AccountInactiveError();

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id, user.failedLoginCount, input);
    }

    await this.userRepository.update(user.id, {
      failedLoginCount: 0,
      lockedAt: null,
      lastLoginAt: new Date(),
    });

    const accessToken = signAccessToken(this.jwtService, user);
    const refreshToken = await issueRefreshToken(this.refreshTokenRepository, this.configService, user.id, input);

    await this.auditLog.write({
      userId: user.id,
      action: 'LOGIN',
      module: 'AUTH',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

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

  // Accepts email, phone, or CCCD/CMND as the login identifier — all three
  // are mandatory at registration (RegisterUseCase, CreatePatientUseCase,
  // CreateGuestAppointmentUseCase), so any of them uniquely identifies the
  // account. Email/phone live directly on `users`, but CCCD is split: staff
  // have it on `users.id_card` (Feature: staff CCCD), while a patient's CCCD
  // lives on `patients.id_card` and has to be resolved to its linked
  // `patients.user_id` first.
  private async resolveUser(identifier: string): Promise<User | null> {
    const byEmailOrPhone = await this.userRepository.findByEmailOrPhone(identifier);
    if (byEmailOrPhone) return byEmailOrPhone;

    const byStaffIdCard = await this.userRepository.findByIdCard(identifier);
    if (byStaffIdCard) return byStaffIdCard;

    const patient = await this.patientRepository.findByIdCard(identifier);
    if (patient?.userId) return this.userRepository.findById(patient.userId);

    return null;
  }

  private async handleFailedLogin(userId: string, currentFailedCount: number, input: LoginInput): Promise<never> {
    const failedLoginCount = currentFailedCount + 1;
    const isNowLocked = failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS;

    await this.userRepository.update(userId, {
      failedLoginCount,
      lockedAt: isNowLocked ? new Date() : null,
    });

    await this.auditLog.write({
      userId,
      action: isNowLocked ? 'LOGIN_LOCKED' : 'LOGIN_FAILED',
      module: 'AUTH',
      detail: { failedLoginCount, ipAddress: input.ipAddress, userAgent: input.userAgent },
    });

    if (isNowLocked) throw new AccountLockedError();
    throw new InvalidCredentialsError();
  }
}
