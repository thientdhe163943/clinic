import { PaginationMeta } from '../pagination.dto';

export interface RecheckNotificationResponseDto {
  id: string;
  recipient: string;
  channel: string;
  status: string;
  body: string;
  sentAt: string | null;
  visitId: string | null;
  createdAt: string;
}

export interface RecheckNotificationListResponseDto {
  items: RecheckNotificationResponseDto[];
  meta: PaginationMeta;
}
