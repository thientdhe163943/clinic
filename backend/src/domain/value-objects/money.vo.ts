export class Money {
  private constructor(public readonly amount: number) {}

  static of(amount: number): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Money amount must be a non-negative number.');
    }

    return new Money(Number(amount.toFixed(2)));
  }
}
