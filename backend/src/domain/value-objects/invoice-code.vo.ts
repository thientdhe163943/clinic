export class InvoiceCode {
  private constructor(public readonly value: string) {}

  static create(value: string): InvoiceCode {
    if (!/^INV-\d{8}-\d{4}$/.test(value)) {
      throw new Error(`Invalid invoice code: ${value}`);
    }

    return new InvoiceCode(value);
  }

  // Format: INV-YYYYMMDD-XXXX, XXXX is a random 4-digit sequence — callers
  // should retry generation on a unique-constraint conflict (same pattern as
  // PatientCode.generate()).
  static generate(now: Date = new Date()): InvoiceCode {
    const datePart = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
      .join('');
    const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    return new InvoiceCode(`INV-${datePart}-${randomPart}`);
  }
}
