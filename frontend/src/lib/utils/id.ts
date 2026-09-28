// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) —
// calling it on a plain-HTTP deployment (no SSL yet) throws
// "crypto.randomUUID is not a function", crashing anything that generates
// an id on render (toasts, chat session ids...). Falls back to a
// non-cryptographic id when the secure-context API isn't available.
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
