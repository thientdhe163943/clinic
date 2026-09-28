export class Notification {
  constructor(
    public readonly id: string,
    public readonly userId: string | null,
    public readonly recipient: string,
    public readonly channel: string,
    public readonly type: string,
    public readonly subject: string | null,
    public readonly body: string,
    public readonly status: string,
    public readonly sentAt: Date | null,
    public readonly refId: string | null,
    public readonly isRead: boolean,
    public readonly createdAt: Date,
  ) {}
}
