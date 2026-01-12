/**
 * Provider Router
 *
 * Selects the appropriate provider based on project configuration,
 * capabilities, and routing rules.
 */

import type {
  ProviderType,
  Currency,
  WalletProvider,
  PaymentGatewayProvider,
  CardIssuerProvider,
  VerificationProvider,
  TransferProvider,
} from '@shared/types/providers';

type AnyProvider =
  | WalletProvider
  | PaymentGatewayProvider
  | CardIssuerProvider
  | VerificationProvider
  | TransferProvider;

interface ProviderAccount {
  id: string;
  projectId: string;
  providerName: string;
  providerType: ProviderType;
  environment: 'sandbox' | 'live';
  config: Record<string, string>;
  baseUrl?: string;
  priority: number;
  weight: number;
  supportedCurrencies: string[];
  supportedCountries: string[];
  status: 'active' | 'disabled' | 'maintenance' | 'deprecated';
  dailyLimitAmount?: number;
  perTransactionLimit?: number;
  lastHealthStatus?: string;
}

interface ProjectCapabilities {
  projectId: string;
  walletEnabled: boolean;
  transfersEnabled: boolean;
  paymentsEnabled: boolean;
  cardsEnabled: boolean;
  kycEnabled: boolean;
  webhooksEnabled: boolean;
  allowedCurrencies: string[];
  dailyTransferLimit: number;
  perTransferLimit: number;
  tier: string;
}

interface RoutingContext {
  currency?: Currency;
  country?: string;
  amount?: number;
  channel?: string;
}

export class ProviderRouter {
  private providerRegistry: Map<string, (config: any) => AnyProvider>;
  private providerInstances: Map<string, AnyProvider> = new Map();
  private db: any; // Database connection

  constructor(db: any, registry: Map<string, (config: any) => AnyProvider>) {
    this.db = db;
    this.providerRegistry = registry;
  }

  /**
   * Select the best provider for an operation
   */
  async selectProvider<T extends AnyProvider>(
    projectId: string,
    providerType: ProviderType,
    context: RoutingContext = {}
  ): Promise<T> {
    // 1. Check project capabilities
    const capabilities = await this.getProjectCapabilities(projectId);
    this.validateCapabilities(capabilities, providerType, context);

    // 2. Get available providers
    const providers = await this.getAvailableProviders(projectId, providerType, context);

    if (providers.length === 0) {
      throw new Error(`No provider available for ${providerType} in project ${projectId}`);
    }

    // 3. Select provider based on priority and health
    for (const providerAccount of providers) {
      // Skip unhealthy providers
      if (providerAccount.lastHealthStatus === 'unhealthy') {
        continue;
      }

      // Check transaction limits
      if (context.amount && providerAccount.perTransactionLimit) {
        if (context.amount > providerAccount.perTransactionLimit) {
          continue;
        }
      }

      // Get or create provider instance
      const provider = await this.getProviderInstance<T>(providerAccount);
      if (provider) {
        return provider;
      }
    }

    throw new Error(`All ${providerType} providers unavailable for project ${projectId}`);
  }

  /**
   * Get or create a provider instance
   */
  private async getProviderInstance<T extends AnyProvider>(
    account: ProviderAccount
  ): Promise<T | null> {
    const instanceKey = `${account.id}:${account.environment}`;

    // Check cache
    if (this.providerInstances.has(instanceKey)) {
      return this.providerInstances.get(instanceKey) as T;
    }

    // Get factory
    const factory = this.providerRegistry.get(account.providerName);
    if (!factory) {
      console.warn(`No factory registered for provider: ${account.providerName}`);
      return null;
    }

    // Create instance
    const provider = factory({
      name: account.providerName,
      environment: account.environment,
      credentials: account.config,
      baseUrl: account.baseUrl,
    }) as T;

    // Cache instance
    this.providerInstances.set(instanceKey, provider);

    return provider;
  }

  /**
   * Get project capabilities
   */
  private async getProjectCapabilities(projectId: string): Promise<ProjectCapabilities> {
    const result = await this.db.query(
      `SELECT * FROM project_capabilities WHERE project_id = $1`,
      [projectId]
    );

    if (result.rows.length === 0) {
      // Return default capabilities
      return {
        projectId,
        walletEnabled: false,
        transfersEnabled: false,
        paymentsEnabled: false,
        cardsEnabled: false,
        kycEnabled: false,
        webhooksEnabled: true,
        allowedCurrencies: ['NGN'],
        dailyTransferLimit: 1000000,
        perTransferLimit: 100000,
        tier: 'starter',
      };
    }

    const row = result.rows[0];
    return {
      projectId: row.project_id,
      walletEnabled: row.wallet_enabled,
      transfersEnabled: row.transfers_enabled,
      paymentsEnabled: row.payments_enabled,
      cardsEnabled: row.cards_enabled,
      kycEnabled: row.kyc_enabled,
      webhooksEnabled: row.webhooks_enabled,
      allowedCurrencies: row.allowed_currencies,
      dailyTransferLimit: row.daily_transfer_limit,
      perTransferLimit: row.per_transfer_limit,
      tier: row.tier,
    };
  }

  /**
   * Validate that the operation is allowed
   */
  private validateCapabilities(
    capabilities: ProjectCapabilities,
    providerType: ProviderType,
    context: RoutingContext
  ): void {
    const capabilityMap: Record<ProviderType, keyof ProjectCapabilities> = {
      wallet: 'walletEnabled',
      payment_gateway: 'paymentsEnabled',
      card_issuer: 'cardsEnabled',
      verification: 'kycEnabled',
      transfer: 'transfersEnabled',
    };

    const capabilityKey = capabilityMap[providerType];
    if (!capabilities[capabilityKey]) {
      throw new Error(`${providerType} not enabled for this project`);
    }

    // Check currency
    if (context.currency && !capabilities.allowedCurrencies.includes(context.currency)) {
      throw new Error(`Currency ${context.currency} not allowed for this project`);
    }

    // Check amount limits for transfers
    if (providerType === 'transfer' && context.amount) {
      if (context.amount > capabilities.perTransferLimit) {
        throw new Error(
          `Amount exceeds per-transfer limit of ${capabilities.perTransferLimit}`
        );
      }
    }
  }

  /**
   * Get available providers for a project and operation
   */
  private async getAvailableProviders(
    projectId: string,
    providerType: ProviderType,
    context: RoutingContext
  ): Promise<ProviderAccount[]> {
    let query = `
      SELECT * FROM provider_accounts
      WHERE project_id = $1
        AND provider_type = $2
        AND status = 'active'
    `;
    const params: any[] = [projectId, providerType];

    // Filter by currency if specified
    if (context.currency) {
      query += ` AND (supported_currencies = '{}' OR $${params.length + 1} = ANY(supported_currencies))`;
      params.push(context.currency);
    }

    // Filter by country if specified
    if (context.country) {
      query += ` AND (supported_countries = '{}' OR $${params.length + 1} = ANY(supported_countries))`;
      params.push(context.country);
    }

    query += ` ORDER BY priority DESC, weight DESC`;

    const result = await this.db.query(query, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      providerName: row.provider_name,
      providerType: row.provider_type,
      environment: row.environment,
      config: row.config,
      baseUrl: row.base_url,
      priority: row.priority,
      weight: row.weight,
      supportedCurrencies: row.supported_currencies,
      supportedCountries: row.supported_countries,
      status: row.status,
      dailyLimitAmount: row.daily_limit_amount,
      perTransactionLimit: row.per_transaction_limit,
      lastHealthStatus: row.last_health_status,
    }));
  }

  /**
   * Record a provider reference for reconciliation
   */
  async recordProviderReference(params: {
    internalRef: string;
    internalType: string;
    providerName: string;
    providerRef?: string;
    rawRequest?: any;
    rawResponse?: any;
    normalizedStatus: string;
  }): Promise<void> {
    await this.db.query(
      `
      INSERT INTO provider_references
      (internal_ref, internal_type, provider_name, provider_ref,
       raw_request, raw_response, normalized_status, response_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (internal_ref)
      DO UPDATE SET
        provider_ref = EXCLUDED.provider_ref,
        raw_response = EXCLUDED.raw_response,
        normalized_status = EXCLUDED.normalized_status,
        response_at = NOW(),
        updated_at = NOW()
      `,
      [
        params.internalRef,
        params.internalType,
        params.providerName,
        params.providerRef,
        JSON.stringify(params.rawRequest),
        JSON.stringify(params.rawResponse),
        params.normalizedStatus,
      ]
    );
  }

  /**
   * Update health status for a provider
   */
  async updateProviderHealth(
    projectId: string,
    providerName: string,
    environment: 'sandbox' | 'live',
    healthy: boolean
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE provider_accounts
      SET last_health_check_at = NOW(),
          last_health_status = $4,
          updated_at = NOW()
      WHERE project_id = $1
        AND provider_name = $2
        AND environment = $3
      `,
      [projectId, providerName, environment, healthy ? 'healthy' : 'unhealthy']
    );
  }

  /**
   * Clear cached provider instances
   */
  clearCache(): void {
    this.providerInstances.clear();
  }
}

export default ProviderRouter;
