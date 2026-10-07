const LEGACY_CURRENCY_FORMAT = (code: string, amount: number) =>
  `${code} ${amount.toFixed(2)}`;

/** Farm transaction amount using ISO currency code; falls back if code is invalid. */
export function formatFarmCurrency(
  amount: number,
  currencyCode: string,
): string {
  const code = currencyCode.trim().toUpperCase();
  if (!code) {
    return LEGACY_CURRENCY_FORMAT('USD', amount);
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(amount);
  } catch {
    return LEGACY_CURRENCY_FORMAT(code, amount);
  }
}
