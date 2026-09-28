export class SystemLog {
  constructor(
    public readonly id: string,
    public readonly userId: string | null,
    public readonly action: string,
    public readonly module: string,
    public readonly targetId: string | null,
    public readonly detail: Record<string, unknown> | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly createdAt: Date,
  ) {}
}
