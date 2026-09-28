export interface SystemLogResponseDto {
  id: string;
  createdAt: Date;
  userId: string | null;
  actorName: string | null;
  action: string;
  module: string;
  targetId: string | null;
  ipAddress: string | null;
  detail: Record<string, unknown> | null;
}
