/**
 * Provider Registry
 *
 * Central registry for all payment/wallet/verification providers.
 */

import type { ProviderConfig } from '@shared/types/providers';

// Provider implementations
import { ProvidusProvider } from './providus';
// import { PaystackProvider } from './paystack';
// import { FlutterwaveProvider } from './flutterwave';

// Provider types
export type ProviderType = 'wallet' | 'payment_gateway' | 'card_issuer' | 'verification' | 'transfer';

export interface ProviderInfo {
  name: string;
  type: ProviderType;
  supportedCurrencies: string[];
  supportedCountries: string[];
  factory: (config: ProviderConfig) => any;
}

/**
 * Provider Registry
 *
 * Maps provider names to their factory functions.
 */
export const PROVIDER_REGISTRY: Record<string, ProviderInfo> = {
  providus: {
    name: 'providus',
    type: 'transfer',
    supportedCurrencies: ['NGN'],
    supportedCountries: ['NG'],
    factory: (config: ProviderConfig) => new ProvidusProvider(config),
  },
  // paystack: {
  //   name: 'paystack',
  //   type: 'payment_gateway',
  //   supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'KES'],
  //   supportedCountries: ['NG', 'GH', 'ZA', 'KE'],
  //   factory: (config: ProviderConfig) => new PaystackProvider(config),
  // },
  // flutterwave: {
  //   name: 'flutterwave',
  //   type: 'payment_gateway',
  //   supportedCurrencies: ['NGN', 'GHS', 'KES', 'ZAR', 'USD'],
  //   supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'US'],
  //   factory: (config: ProviderConfig) => new FlutterwaveProvider(config),
  // },
};

/**
 * Get provider by name
 */
export function getProvider(name: string, config: ProviderConfig): any {
  const providerInfo = PROVIDER_REGISTRY[name];
  if (!providerInfo) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return providerInfo.factory(config);
}

/**
 * Get all providers of a specific type
 */
export function getProvidersByType(type: ProviderType): ProviderInfo[] {
  return Object.values(PROVIDER_REGISTRY).filter((p) => p.type === type);
}

/**
 * Check if provider supports currency
 */
export function providerSupportsCurrency(name: string, currency: string): boolean {
  const providerInfo = PROVIDER_REGISTRY[name];
  return providerInfo?.supportedCurrencies.includes(currency) ?? false;
}

/**
 * Check if provider supports country
 */
export function providerSupportsCountry(name: string, country: string): boolean {
  const providerInfo = PROVIDER_REGISTRY[name];
  return providerInfo?.supportedCountries.includes(country) ?? false;
}

// Re-export providers
export { ProvidusProvider } from './providus';
// export { PaystackProvider } from './paystack';
// export { FlutterwaveProvider } from './flutterwave';
