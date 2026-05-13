/**
 * Money in this app is stored as integer pesewas. 1 GHS = 100 pesewas.
 * All conversion happens at the edges — DB and display — never inside business
 * logic.
 */

/** Convert a pesewas integer to a display string. e.g. 12345 -> "GH₵ 123.45". */
export function formatGhs(pesewas: number | bigint): string {
  const cents = typeof pesewas === "bigint" ? Number(pesewas) : pesewas;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  const majorWithSep = major.toLocaleString("en-GH");
  return `${negative ? "-" : ""}GH₵ ${majorWithSep}.${minor.toString().padStart(2, "0")}`;
}

/** Plain numeric form, e.g. "1234.56", suitable for CSV / accounting export. */
export function formatGhsPlain(pesewas: number | bigint): string {
  const cents = typeof pesewas === "bigint" ? Number(pesewas) : pesewas;
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${negative ? "-" : ""}${major}.${minor.toString().padStart(2, "0")}`;
}

/**
 * Parse a user-supplied GHS string (e.g. "12.34", "12", " 12.5 ") into integer
 * pesewas. Returns null on invalid input. Accepts no thousand separators or
 * currency symbols — the form input should be plain numeric.
 */
export function parseGhsToPesewas(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept optional minus, integer part, optional ".", up to two decimals.
  const match = trimmed.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const major = Number(match[2]);
  const minorStr = match[3] ?? "";
  const minor = Number((minorStr + "00").slice(0, 2));
  return sign * (major * 100 + minor);
}
