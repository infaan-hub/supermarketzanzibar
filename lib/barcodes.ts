// Code 128 barcode helpers shared by the API and the POS UI.
//
// Code 128 encodes the printable ASCII range (letters, digits and symbols),
// which makes it suitable for internal product, shelf and carton labels.

export const CODE128_MAX_LENGTH = 80;

/** Trim scanner noise (newlines/spaces) from a scanned or typed code. */
export function normalizeBarcode(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Code 128 supports printable ASCII 32-126. Reject control characters and
 * non-ASCII text before it reaches the database or the label generator.
 */
export function isValidCode128(value: string): boolean {
  if (value.length === 0 || value.length > CODE128_MAX_LENGTH) return false;

  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 || codePoint > 126) return false;
  }

  return true;
}
