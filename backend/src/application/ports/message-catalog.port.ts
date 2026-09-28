import { MessageCode } from '../../domain/value-objects/message-code.vo';

export const MESSAGE_CATALOG_PORT = Symbol('MESSAGE_CATALOG_PORT');

// English support was dropped (2026-08-07) — catalog is Vietnamese-only now.
// `locale` stays on the signature for forward-compatibility but has exactly
// one valid value today.
export const DEFAULT_LOCALE = 'vi';

export interface MessageCatalogPort {
  /**
   * Returns the interpolated message for `code`. Resolution order:
   * requested `locale` -> `DEFAULT_LOCALE` -> the raw `code` itself
   * (so a missing translation never crashes the response).
   */
  getMessage(code: MessageCode | string, locale?: string, params?: Record<string, string | number>): string;

  /** Re-reads the app_messages table into the in-memory cache (see PrismaMessageCatalogRepository). */
  reload(): Promise<void>;

  /** All catalog rows for the default locale, for the frontend's read-only /messages endpoint. */
  getAll(): { code: string; message: string }[];
}
