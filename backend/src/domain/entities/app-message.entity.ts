export class AppMessage {
  constructor(
    public readonly id: string,
    public readonly messageCode: string,
    public readonly locale: string,
    public readonly message: string,
  ) {}
}
