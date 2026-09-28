import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailPort, SendEmailInput } from '../../application/ports/email.port';
import { buildHospitalEmailHtml, HospitalEmailBranding } from './templates/hospital-email.template';

// Real SMTP implementation, used when SMTP_HOST is configured (see
// app.module.ts's EMAIL_PORT factory, which falls back to
// ConsoleEmailAdapter otherwise). Credentials are provided by the
// deployment environment — this class never hardcodes them.
@Injectable()
export class SmtpEmailAdapter implements EmailPort {
  private readonly logger = new Logger(SmtpEmailAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly branding: HospitalEmailBranding;

  constructor(configService: ConfigService) {
    // SMTP_FROM, when set, may be a bare address or a full "Display Name
    // <address>" header — passed through as-is either way. Otherwise the
    // clinic's own display name/domain is used so mail shows up as coming
    // from the hospital, not a generic no-reply@clinic.local placeholder.
    const clinicName = configService.get<string>('clinic.name') ?? '';
    this.from = process.env.SMTP_FROM || `"${clinicName}" <no-reply@aucophuha.vn>`;
    this.branding = {
      name: clinicName,
      address: configService.get<string>('clinic.address') ?? '',
      phone: configService.get<string>('clinic.phone') ?? '',
      supportPhone: configService.get<string>('clinic.supportPhone') ?? '',
      email: configService.get<string>('clinic.email') ?? '',
    };
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: buildHospitalEmailHtml(input.subject, input.body, this.branding),
      });
    } catch (error) {
      this.logger.error(`SMTP send failed to=${input.to}: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }
}
