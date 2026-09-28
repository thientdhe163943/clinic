import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import { Server, Socket } from 'socket.io';
import { RealtimePort } from '../../application/ports/realtime.port';
import { AuthenticatedUser } from '../../presentation/guards/authenticated-user.type';
import { ACCESS_TOKEN_COOKIE } from '../auth/cookie.util';

// @WebSocketGateway's options are evaluated at class-decoration time (module
// load), before Nest's DI container exists, so ConfigService cannot be
// injected here — corsOrigins is computed inline with the exact same logic
// app.config.ts uses to build `app.corsOrigins` from CORS_ORIGINS.
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Single shared realtime gateway for the whole app — every domain
// (appointments, visits, cls-orders, invoices, notifications,
// doctor-specialty approvals, ...) pushes through this one Socket.io
// server/connection rather than each spinning up its own @WebSocketGateway
// (that would open a second namespace/connection per domain for no benefit
// and duplicate the JWT-cookie auth below). Domain use-cases stay decoupled
// from Socket.io by only ever depending on RealtimePort.
@WebSocketGateway({
  cors: { origin: corsOrigins, credentials: true },
})
export class RealtimeGateway implements RealtimePort, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Authenticates the same way as JwtStrategy's HTTP cookie extractor, but
  // socket.io has no cookie middleware of its own, so the cookie header is
  // parsed manually here. Each socket joins two rooms: its role (for
  // broadcasts to "everyone with this role", e.g. every RECEPTIONIST) and
  // its own userId (for a push meant for one specific person, e.g. "your CLS
  // result is ready" or "your profile update was approved") — a single emit
  // can therefore target either kind of audience by room name alone.
  handleConnection(client: Socket): void {
    const rawCookie = client.handshake.headers.cookie;
    if (!rawCookie) {
      client.disconnect();
      return;
    }

    const cookies = parseCookie(rawCookie);
    const accessToken = cookies[ACCESS_TOKEN_COOKIE];
    if (!accessToken) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<AuthenticatedUser>(accessToken, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
      void client.join(payload.role);
      void client.join(payload.sub);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(): void {
    // No cleanup needed — socket.io automatically removes disconnected
    // sockets from every room they had joined.
  }

  emit(target: string | string[], event: string, payload: unknown): void {
    try {
      this.server.to(target).emit(event, payload);
    } catch (error) {
      this.logger.warn(
        `Failed to emit realtime event "${event}" to ${JSON.stringify(target)}: ${(error as Error).message}`,
      );
    }
  }
}
