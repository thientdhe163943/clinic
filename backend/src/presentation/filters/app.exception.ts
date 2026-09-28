import { HttpException, HttpStatus } from '@nestjs/common';
import { MSG, MessageCode } from '../../domain/value-objects/message-code.vo';

export interface AppExceptionBody {
  code: MessageCode;
  params?: Record<string, string | number>;
  details?: unknown;
}

export class AppException extends HttpException {
  constructor(
    code: MessageCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    params?: Record<string, string | number>,
    details?: unknown,
  ) {
    const body: AppExceptionBody = { code, params, details };
    super(body, status);
  }
}

export class ResourceNotFoundException extends AppException {
  constructor(resource: string, details?: unknown) {
    super(MSG.ERR_0009, HttpStatus.NOT_FOUND, { resource }, details);
  }
}

export class ForbiddenActionException extends AppException {
  constructor() {
    super(MSG.ERR_0008, HttpStatus.FORBIDDEN);
  }
}

export class InvalidSessionException extends AppException {
  constructor() {
    super(MSG.ERR_0007, HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(MSG.ERR_0012, HttpStatus.UNAUTHORIZED);
  }
}

export class AccountLockedException extends AppException {
  constructor() {
    super(MSG.ERR_0002, HttpStatus.FORBIDDEN);
  }
}

export class BusinessConflictException extends AppException {
  constructor(code: MessageCode = MSG.ERR_0010, params?: Record<string, string | number>, details?: unknown) {
    super(code, HttpStatus.CONFLICT, params, details);
  }
}
