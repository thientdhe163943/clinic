export class AccessCode {
  private constructor(public readonly value: string) {}

  static create(value: string): AccessCode {
    if (!/^KQ-[A-Z0-9]{2,}-[A-Z0-9]{4,}$/.test(value)) {
      throw new Error(`Invalid access code: ${value}`);
    }

    return new AccessCode(value);
  }
}
