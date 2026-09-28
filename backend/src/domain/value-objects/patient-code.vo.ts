export class PatientCode {
  private constructor(public readonly value: string) {}

  static create(value: string): PatientCode {
    if (!/^BN-\d{8}-\d{4}$/.test(value)) {
      throw new Error(`Invalid patient code: ${value}`);
    }

    return new PatientCode(value);
  }

  // Format: BN-YYYYMMDD-XXXX, XXXX is a random 4-digit sequence — callers
  // should retry generation on a unique-constraint conflict.
  static generate(now: Date = new Date()): PatientCode {
    const datePart = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
      .join('');
    const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, '0');

    return new PatientCode(`BN-${datePart}-${randomPart}`);
  }
}
