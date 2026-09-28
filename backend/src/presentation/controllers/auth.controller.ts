import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Put, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ChangePasswordRequestDto } from '../../application/dtos/auth/change-password.dto';
import { ForgotPasswordRequestDto } from '../../application/dtos/auth/forgot-password.dto';
import { LoginRequestDto } from '../../application/dtos/auth/login.dto';
import { AuthSessionDto } from '../../application/dtos/auth/login-response.dto';
import { RegisterRequestDto } from '../../application/dtos/auth/register.dto';
import { ResetPasswordRequestDto } from '../../application/dtos/auth/reset-password.dto';
import { VerifyOtpRequestDto } from '../../application/dtos/auth/verify-otp.dto';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { ChangePasswordUseCase } from '../../application/use-cases/auth/change-password.use-case';
import { ForgotPasswordUseCase } from '../../application/use-cases/auth/forgot-password.use-case';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/auth/logout.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/auth/refresh-token.use-case';
import { RegisterUseCase } from '../../application/use-cases/auth/register.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/auth/reset-password.use-case';
import { VerifyOtpUseCase } from '../../application/use-cases/auth/verify-otp.use-case';
import { MSG } from '../../domain/value-objects/message-code.vo';
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  parseDurationMs,
  setAuthCookies,
} from '../../infrastructure/auth/cookie.util';
import { ClientIp } from '../decorators/client-ip.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { Public } from '../decorators/public.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly configService: ConfigService,
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  @Public()
  @Post('login')
  @MsgCode(MSG.INFO_0001)
  @SkipAudit()
  async login(
    @Body() dto: LoginRequestDto,
    @ClientIp() ipAddress: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const { accessToken, refreshToken, ...session } = await this.loginUseCase.execute({
      username: dto.username,
      password: dto.password,
      ipAddress,
      userAgent: req.headers['user-agent'] ?? null,
    });

    this.setSessionCookies(req, res, accessToken, refreshToken);

    return session;
  }

  // Called by the frontend axios interceptor when an API request 401s with
  // an expired access token, and by middleware.ts on a protected-route
  // navigation with no valid access_token — both forward whatever
  // refresh_token cookie is present. @Public() because the access token that
  // would normally satisfy JwtAuthGuard is exactly what's missing/expired here.
  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @ClientIp() ipAddress: string,
  ): Promise<AuthSessionDto> {
    const { accessToken, refreshToken, ...session } = await this.refreshTokenUseCase.execute({
      refreshToken: req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
      ipAddress,
      userAgent: req.headers['user-agent'] ?? null,
    });

    this.setSessionCookies(req, res, accessToken, refreshToken);

    return session;
  }

  @Public()
  @Post('register')
  @MsgCode(MSG.INFO_0007)
  async register(
    @Body() dto: RegisterRequestDto,
    @ClientIp() ipAddress: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const { accessToken, refreshToken, ...session } = await this.registerUseCase.execute({
      ...dto,
      ipAddress,
      userAgent: req.headers['user-agent'] ?? null,
    });

    this.setSessionCookies(req, res, accessToken, refreshToken);

    return session;
  }

  // MSG.INFO_0010 has an `{email}` placeholder (the OTP always goes to the
  // account's email, which may differ from the `username` the caller typed
  // in if they logged in with their phone number) — the static @MsgCode
  // decorator can't fill that in, so the response is built manually here.
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordRequestDto, @Req() req: RequestWithTrace) {
    const result = await this.forgotPasswordUseCase.execute({ username: dto.username });
    const message = this.messageCatalog.getMessage(MSG.INFO_0010, DEFAULT_LOCALE, { email: result.email });

    // NOTE: `data` must stay non-null — the frontend's `unwrap<null>()` for
    // this endpoint treats `data === null` as a thrown ApiError even when
    // `success: true` (see clinic_system_frontend/src/lib/api/client.ts).
    return ApiResponse.ok(result, message, { traceId: req.traceId });
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() dto: VerifyOtpRequestDto): Promise<void> {
    return this.verifyOtpUseCase.execute({ username: dto.username, otpCode: dto.otpCode });
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @MsgCode(MSG.INFO_0011)
  resetPassword(@Body() dto: ResetPasswordRequestDto): Promise<void> {
    return this.resetPasswordUseCase.execute(dto);
  }

  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  @MsgCode(MSG.INFO_0008)
  changePassword(
    @Body() dto: ChangePasswordRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.changePasswordUseCase.execute({
      userId: user.sub,
      ...dto,
      refreshToken: req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @MsgCode(MSG.INFO_0009)
  @SkipAudit()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute({
      userId: user.sub,
      refreshToken: req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined,
    });
    clearAuthCookies(res);
  }

  // secure derives from req.secure (real client-facing protocol, via the
  // X-Forwarded-Proto header Nginx sets + `trust proxy` in main.ts) instead
  // of NODE_ENV — a production deploy behind plain HTTP (no domain/SSL yet)
  // must NOT get a Secure cookie, or browsers silently drop it and the user
  // appears logged in but every subsequent request looks unauthenticated.
  private setSessionCookies(req: Request, res: Response, accessToken: string, refreshToken: string): void {
    setAuthCookies(res, accessToken, refreshToken, {
      accessTokenMaxAgeMs: parseDurationMs(this.configService.get<string>('auth.jwtExpiresIn') ?? '15m'),
      refreshTokenMaxAgeMs: (this.configService.get<number>('auth.refreshTokenExpiresDays') ?? 7) * 86_400_000,
      secure: req.secure,
    });
  }
}
