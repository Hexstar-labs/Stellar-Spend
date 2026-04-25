/**
 * Supported fiat currency configuration.
 *
 * Each entry defines the currency code, display name, symbol, decimal places,
 * minimum/maximum transaction amounts, and whether it is currently active.
 *
 * To add a new currency:
 *  1. Add an entry to SUPPORTED_CURRENCIES below.
 *  2. Ensure the currency is supported by Paycrest (check their /currencies endpoint).
 *  3. Add a flag emoji to src/lib/currency-flags.ts.
 */

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  minAmount: number;
  maxAmount: number;
  active: boolean;
  /** ISO 3166-1 alpha-2 country code (primary) */
  country: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  // Africa
  { code: 'NGN', name: 'Nigerian Naira',        symbol: '₦',  decimals: 2, minAmount: 100,    maxAmount: 10_000_000, active: true,  country: 'NG' },
  { code: 'KES', name: 'Kenyan Shilling',        symbol: 'KSh', decimals: 2, minAmount: 100,   maxAmount: 5_000_000,  active: true,  country: 'KE' },
  { code: 'GHS', name: 'Ghanaian Cedi',          symbol: 'GH₵', decimals: 2, minAmount: 10,    maxAmount: 500_000,    active: true,  country: 'GH' },
  { code: 'ZAR', name: 'South African Rand',     symbol: 'R',   decimals: 2, minAmount: 10,    maxAmount: 1_000_000,  active: true,  country: 'ZA' },
  { code: 'UGX', name: 'Ugandan Shilling',       symbol: 'USh', decimals: 0, minAmount: 1000,  maxAmount: 50_000_000, active: true,  country: 'UG' },
  { code: 'TZS', name: 'Tanzanian Shilling',     symbol: 'TSh', decimals: 0, minAmount: 1000,  maxAmount: 50_000_000, active: true,  country: 'TZ' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0, minAmount: 500,   maxAmount: 10_000_000, active: true,  country: 'SN' },
  { code: 'MAD', name: 'Moroccan Dirham',        symbol: 'MAD', decimals: 2, minAmount: 10,    maxAmount: 500_000,    active: true,  country: 'MA' },
  { code: 'EGP', name: 'Egyptian Pound',         symbol: 'E£',  decimals: 2, minAmount: 10,    maxAmount: 1_000_000,  active: true,  country: 'EG' },
  { code: 'ETB', name: 'Ethiopian Birr',         symbol: 'Br',  decimals: 2, minAmount: 50,    maxAmount: 2_000_000,  active: true,  country: 'ET' },
  { code: 'RWF', name: 'Rwandan Franc',          symbol: 'RF',  decimals: 0, minAmount: 1000,  maxAmount: 20_000_000, active: true,  country: 'RW' },
  { code: 'MWK', name: 'Malawian Kwacha',        symbol: 'MK',  decimals: 2, minAmount: 1000,  maxAmount: 20_000_000, active: false, country: 'MW' },
  { code: 'ZMW', name: 'Zambian Kwacha',         symbol: 'ZK',  decimals: 2, minAmount: 10,    maxAmount: 500_000,    active: false, country: 'ZM' },
  // Americas
  { code: 'BRL', name: 'Brazilian Real',         symbol: 'R$',  decimals: 2, minAmount: 5,     maxAmount: 500_000,    active: true,  country: 'BR' },
  { code: 'MXN', name: 'Mexican Peso',           symbol: '$',   decimals: 2, minAmount: 10,    maxAmount: 1_000_000,  active: true,  country: 'MX' },
  // Asia
  { code: 'INR', name: 'Indian Rupee',           symbol: '₹',   decimals: 2, minAmount: 50,    maxAmount: 5_000_000,  active: true,  country: 'IN' },
  { code: 'PHP', name: 'Philippine Peso',        symbol: '₱',   decimals: 2, minAmount: 50,    maxAmount: 2_000_000,  active: true,  country: 'PH' },
  // Middle East
  { code: 'AED', name: 'UAE Dirham',             symbol: 'د.إ', decimals: 2, minAmount: 5,     maxAmount: 200_000,    active: true,  country: 'AE' },
];

/** Returns only active currencies */
export function getActiveCurrencies(): CurrencyConfig[] {
  return SUPPORTED_CURRENCIES.filter((c) => c.active);
}

/** Returns a currency config by code (case-insensitive), or undefined */
export function getCurrencyConfig(code: string): CurrencyConfig | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase());
}

/** Returns true if the currency code is supported and active */
export function isSupportedCurrency(code: string): boolean {
  const config = getCurrencyConfig(code);
  return !!config?.active;
}

/**
 * Validates that an amount is within the allowed range for a currency.
 * Returns an error message or null if valid.
 */
export function validateCurrencyAmount(code: string, amount: number): string | null {
  const config = getCurrencyConfig(code);
  if (!config) return `Unsupported currency: ${code}`;
  if (!config.active) return `Currency ${code} is not currently active`;
  if (amount < config.minAmount) return `Minimum amount for ${code} is ${config.minAmount}`;
  if (amount > config.maxAmount) return `Maximum amount for ${code} is ${config.maxAmount}`;
  return null;
}
