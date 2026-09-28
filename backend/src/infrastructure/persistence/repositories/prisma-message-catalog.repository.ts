import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageCode } from '../../../domain/value-objects/message-code.vo';
import {
  DEFAULT_LOCALE,
  MessageCatalogPort,
} from '../../../application/ports/message-catalog.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaMessageCatalogRepository implements MessageCatalogPort, OnModuleInit {
  private readonly logger = new Logger(PrismaMessageCatalogRepository.name);
  private cache = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  // Load the full catalog into memory once at startup so per-request
  // exception handling never has to hit the database.
  async onModuleInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    const rows = await this.prisma.appMessage.findMany();
    const cache = new Map<string, string>();

    for (const row of rows) {
      cache.set(this.cacheKey(row.messageCode, row.locale), row.message);
    }

    this.cache = cache;
    this.logger.log(`Loaded ${cache.size} app messages into cache.`);
  }

  getAll(): { code: string; message: string }[] {
    const suffix = `:${DEFAULT_LOCALE}`;
    return [...this.cache.entries()]
      .filter(([key]) => key.endsWith(suffix))
      .map(([key, message]) => ({ code: key.slice(0, -suffix.length), message }));
  }

  getMessage(code: MessageCode | string, locale = DEFAULT_LOCALE, params?: Record<string, string | number>): string {
    // Fall back to DEFAULT_LOCALE, then to the raw code, so an
    // untranslated or unknown message code never breaks the response.
    const template =
      this.cache.get(this.cacheKey(code, locale)) ??
      this.cache.get(this.cacheKey(code, DEFAULT_LOCALE)) ??
      code;

    return this.interpolate(template, params);
  }

  // Replaces `{paramName}` placeholders in the message template, e.g.
  // "Không tìm thấy {resource}." + { resource: 'Patient' }.
  private interpolate(template: string, params?: Record<string, string | number>): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in params ? String(params[key]) : match,
    );
  }

  private cacheKey(code: string, locale: string): string {
    return `${code}:${locale}`;
  }
}
