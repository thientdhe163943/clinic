import 'reflect-metadata';
import { join } from 'path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  // Trust the Nginx reverse proxy's X-Forwarded-Proto header so
  // req.secure reflects the real client-facing protocol (HTTP vs HTTPS)
  // rather than the plain-HTTP connection Nginx always uses to reach this
  // container — auth cookies (cookie.util.ts) key their `secure` flag off
  // req.secure so this must be correct before login is ever called.
  app.set('trust proxy', 1);

  // Serves uploaded avatar files (see UploadsController) — outside the
  // global /api/v1 prefix, at the root /uploads/... path, so returned URLs
  // can be used directly in <img src>.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>('app.corsOrigins'),
    credentials: true,
  });
  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? '/api/v1');
  app.enableVersioning({ type: VersioningType.URI });
  // Registered via APP_PIPE in app.module.ts instead of here — that goes
  // through Nest DI so MessageCodeValidationPipe can inject MessageCatalogPort.

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Clinic Management System API')
    .setDescription('Backend API for clinic operations')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('app.port') ?? 3001;
  await app.listen(port);
}

void bootstrap();
