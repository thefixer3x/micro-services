import { IWalletProvider, ProviderConfig, ProviderError } from './IWalletProvider';
import { ProvidusProvider } from './providus/ProvidusProvider';
import { logger } from '../utils/logger';

/**
 * Provider Factory
 *
 * Creates wallet provider instances based on configuration
 * Supports multiple providers: Providus, Flutterwave, Paystack, etc.
 */
export class ProviderFactory {
  private static providers: Map<string, IWalletProvider> = new Map();

  /**
   * Get or create a wallet provider instance
   */
  static getProvider(providerName: string, config?: ProviderConfig): IWalletProvider {
    // Return existing provider if already instantiated
    if (this.providers.has(providerName)) {
      const provider = this.providers.get(providerName)!;
      logger.debug(`[ProviderFactory] Using existing provider: ${providerName}`);
      return provider;
    }

    // Create new provider instance
    const provider = this.createProvider(providerName, config);
    this.providers.set(providerName, provider);

    logger.info(`[ProviderFactory] Created new provider: ${providerName}`);
    return provider;
  }

  /**
   * Create a new provider instance based on name
   */
  private static createProvider(providerName: string, config?: ProviderConfig): IWalletProvider {
    const normalizedName = providerName.toLowerCase();

    // Use environment config if not provided
    if (!config) {
      config = this.getProviderConfigFromEnv(normalizedName);
    }

    switch (normalizedName) {
      case 'providus':
        return new ProvidusProvider(config);

      // Future providers
      // case 'flutterwave':
      //   return new FlutterwaveProvider(config);
      //
      // case 'paystack':
      //   return new PaystackProvider(config);
      //
      // case 'stripe':
      //   return new StripeProvider(config);

      default:
        throw new ProviderError(
          `Unsupported wallet provider: ${providerName}`,
          'UNSUPPORTED_PROVIDER'
        );
    }
  }

  /**
   * Get provider configuration from environment variables
   */
  private static getProviderConfigFromEnv(providerName: string): ProviderConfig {
    switch (providerName) {
      case 'providus': {
        const useSandbox = process.env.PROVIDUS_USE_SANDBOX === 'true';
        const baseUrl = useSandbox
          ? process.env.PROVIDUS_SANDBOX_URL || 'https://sandbox.api.xpresswallet.com'
          : process.env.PROVIDUS_BASE_URL || 'https://api.xpresswallet.com';

        return {
          name: 'providus',
          baseUrl,
          apiKey: process.env.PROVIDUS_API_KEY,
          clientId: process.env.PROVIDUS_CLIENT_ID,
          clientSecret: process.env.PROVIDUS_CLIENT_SECRET,
          useSandbox,
          timeout: 30000,
          retries: 3,
        };
      }

      // Future provider configs
      // case 'flutterwave': {
      //   return {
      //     name: 'flutterwave',
      //     baseUrl: 'https://api.flutterwave.com/v3',
      //     apiKey: process.env.FLUTTERWAVE_SECRET_KEY,
      //     timeout: 30000,
      //     retries: 3,
      //   };
      // }

      default:
        throw new ProviderError(
          `No environment configuration found for provider: ${providerName}`,
          'NO_PROVIDER_CONFIG'
        );
    }
  }

  /**
   * Get the default provider based on environment configuration
   */
  static getDefaultProvider(): IWalletProvider {
    const defaultProvider = process.env.DEFAULT_WALLET_PROVIDER || 'providus';
    return this.getProvider(defaultProvider);
  }

  /**
   * Get all available provider names
   */
  static getAvailableProviders(): string[] {
    return [
      'providus',
      // 'flutterwave',
      // 'paystack',
      // 'stripe',
    ];
  }

  /**
   * Clear all cached provider instances
   */
  static clearProviders(): void {
    this.providers.clear();
    logger.info('[ProviderFactory] All provider instances cleared');
  }

  /**
   * Remove a specific provider from cache
   */
  static removeProvider(providerName: string): void {
    this.providers.delete(providerName);
    logger.debug(`[ProviderFactory] Provider removed: ${providerName}`);
  }
}
