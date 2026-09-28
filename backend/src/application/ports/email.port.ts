export const EMAIL_PORT = Symbol('EMAIL_PORT');

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface EmailPort {
  send(input: SendEmailInput): Promise<void>;
}
