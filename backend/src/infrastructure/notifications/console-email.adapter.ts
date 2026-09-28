import { Injectable, Logger } from '@nestjs/common';
import { EmailPort, SendEmailInput } from '../../application/ports/email.port';

// Local-dev/staging implementation: logs the email instead of sending it via SES/SMTP.
// Swap this provider for a real EmailPort implementation when SMTP credentials are available.
@Injectable()
export class ConsoleEmailAdapter implements EmailPort {
  private readonly logger = new Logger(ConsoleEmailAdapter.name);

  async send(input: SendEmailInput): Promise<void> {
    this.logger.log(`[EMAIL] to=${input.to} subject="${input.subject}" body="${input.body}"`);
  }
}
