// Strips Vietnamese diacritics and non-alphanumerics to build a suggested
// email local-part from a full name — e.g. "Le Van Son" -> "levanson".
// normalize('NFD') decomposes most diacritics into a base letter + combining
// marks (Unicode code points 0x0300-0x036f, filtered out by char code below
// rather than a literal regex range, to avoid embedding raw combining
// characters in source); "d/D" with a stroke doesn't decompose that way, so
// it's replaced explicitly first.
const COMBINING_MARK_MIN = 0x0300;
const COMBINING_MARK_MAX = 0x036f;

function stripCombiningMarks(value: string): string {
  let result = '';
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < COMBINING_MARK_MIN || code > COMBINING_MARK_MAX) {
      result += ch;
    }
  }
  return result;
}

export function toEmailLocalPart(fullName: string): string {
  const withoutDStroke = fullName.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const withoutMarks = stripCombiningMarks(withoutDStroke.normalize('NFD'));
  return withoutMarks.toLowerCase().replace(/[^a-z0-9]/g, '');
}
