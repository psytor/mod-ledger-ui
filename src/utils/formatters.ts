/**
 * Format display value by removing unnecessary trailing zeros from decimals
 * Examples:
 *   "36.00%" -> "36%"
 *   "5.50%" -> "5.5%"
 *   "12.34%" -> "12.34%"
 *   "+100" -> "+100"
 */
export function formatDisplayValue(value: string): string {
  // Match number with optional decimals followed by %
  const match = value.match(/^([+-]?)(\d+)\.(\d+)(%?)$/);

  if (!match) {
    // No decimal found, return as-is
    return value;
  }

  const [, sign, integerPart, decimalPart, percent] = match;

  // Remove trailing zeros from decimal part
  const trimmedDecimals = decimalPart.replace(/0+$/, '');

  // If no decimals left after trimming, return just the integer
  if (trimmedDecimals === '') {
    return `${sign}${integerPart}${percent}`;
  }

  // Otherwise, return with trimmed decimals
  return `${sign}${integerPart}.${trimmedDecimals}${percent}`;
}
