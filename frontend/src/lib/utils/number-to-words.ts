const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const TEN_UNIT_NAMES = ['', ' nghìn', ' triệu', ' tỷ'];

// Reads a single 0-999 group. `isMostSignificant` is true only for the
// highest non-zero group in the whole number — every group after it must
// read a zero hundreds digit as "không trăm" (and a zero tens digit as
// "lẻ") instead of silently dropping it, or "1,050,000" would misread as
// "một triệu năm mươi nghìn" instead of "...không trăm năm mươi nghìn".
function readTriple(n: number, isMostSignificant: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const parts: string[] = [];

  if (h > 0) {
    parts.push(CHU_SO[h], 'trăm');
  } else if (!isMostSignificant) {
    parts.push('không trăm');
  }

  if (t === 0) {
    if (u > 0) {
      if (h > 0 || !isMostSignificant) parts.push('lẻ');
      parts.push(CHU_SO[u]);
    }
  } else if (t === 1) {
    parts.push('mười');
    if (u > 0) parts.push(u === 5 ? 'lăm' : CHU_SO[u]);
  } else {
    parts.push(`${CHU_SO[t]} mươi`);
    if (u > 0) {
      if (u === 1) parts.push('mốt');
      else if (u === 5) parts.push('lăm');
      else if (u === 4) parts.push('tư');
      else parts.push(CHU_SO[u]);
    }
  }

  return parts.join(' ');
}

/** "130000" -> "Một trăm ba mươi nghìn đồng" — for the amount-in-words line on printed receipts. */
export function vndAmountToWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return 'Không đồng';

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.unshift(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const firstNonZeroIndex = groups.findIndex((g) => g !== 0);
  const words = groups
    .map((g, idx) => {
      if (g === 0) return null;
      const unitIdx = groups.length - 1 - idx;
      return readTriple(g, idx === firstNonZeroIndex) + TEN_UNIT_NAMES[unitIdx];
    })
    .filter((w): w is string => w != null);

  const result = words.join(' ').trim();
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} đồng`;
}
