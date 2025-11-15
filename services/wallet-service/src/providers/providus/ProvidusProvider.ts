import { BaseProvider } from '../BaseProvider';
import {
  IWalletProvider,
  AuthResult,
  CreateCustomerRequest,
  Customer,
  UpdateCustomerRequest,
  SearchCriteria,
  CreateWalletRequest,
  Wallet,
  Balance,
  TransferRequest,
  Transaction,
  Bank,
  BankAccountValidation,
  PaginationOptions,
  PaginatedResult,
  ProviderConfig,
  ProviderError,
} from '../IWalletProvider';
import { logger } from '../../utils/logger';

/**
 * Providus Bank (Xpress Wallet) Provider Implementation
 *
 * Integrates with Providus Bank's Xpress Wallet API
 * Base URL: https://api.xpresswallet.com
 *
 * Features:
 * - Customer management
 * - Wallet creation and management
 * - Bank transfers
 * - Transaction history
 * - Virtual cards
 */
export class ProvidusProvider extends BaseProvider implements IWalletProvider {
  readonly name = 'providus';
  readonly version = '1.0.0';

  private clientId: string;
  private clientSecret: string;

  constructor(config: ProviderConfig) {
    super(config);

    this.validateConfig(['clientId', 'clientSecret']);
    this.clientId = config.clientId!;
    this.clientSecret = config.clientSecret!;

    logger.info(`[Providus] Provider initialized (${config.useSandbox ? 'SANDBOX' : 'PRODUCTION'})`);
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  async initialize(): Promise<void> {
    try {
      await this.authenticate();
      logger.info('[Providus] Provider initialized successfully');
    } catch (error) {
      logger.error('[Providus] Failed to initialize provider:', error);
      throw error;
    }
  }

  async authenticate(): Promise<AuthResult> {
    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/auth/login',
        data: {
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        },
      });

      this.accessToken = response.accessToken || response.access_token;
      this.refreshToken = response.refreshToken || response.refresh_token;

      if (response.expiresIn) {
        this.setTokenExpiry(response.expiresIn);
      }

      logger.info('[Providus] Authentication successful');

      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: response.expiresIn,
        tokenType: response.tokenType || 'Bearer',
      };
    } catch (error) {
      logger.error('[Providus] Authentication failed:', error);
      throw error;
    }
  }

  async refreshToken(): Promise<AuthResult> {
    if (!this.refreshToken) {
      throw new ProviderError('No refresh token available', 'NO_REFRESH_TOKEN');
    }

    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/auth/refresh',
        headers: {
          'X-Refresh-Token': this.refreshToken,
        },
      });

      this.accessToken = response.accessToken || response.access_token;

      if (response.expiresIn) {
        this.setTokenExpiry(response.expiresIn);
      }

      logger.info('[Providus] Token refreshed successfully');

      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresIn: response.expiresIn,
      };
    } catch (error) {
      logger.error('[Providus] Token refresh failed:', error);
      // If refresh fails, try to re-authenticate
      return this.authenticate();
    }
  }

  // ============================================================================
  // Customer Management
  // ============================================================================

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/customers',
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone_number: data.phoneNumber,
          date_of_birth: data.dateOfBirth,
          address: data.address,
          kyc_level: data.kycLevel,
          metadata: data.metadata,
        },
      });

      logger.info('[Providus] Customer created:', response.data?.customer_id);

      return this.mapCustomerResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to create customer:', error);
      throw error;
    }
  }

  async getCustomer(customerId: string): Promise<Customer> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/customers/${customerId}`,
      });

      return this.mapCustomerResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to get customer:', error);
      throw error;
    }
  }

  async updateCustomer(customerId: string, data: UpdateCustomerRequest): Promise<Customer> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'PUT',
        url: `/customers/${customerId}`,
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone_number: data.phoneNumber,
          address: data.address,
          metadata: data.metadata,
        },
      });

      logger.info('[Providus] Customer updated:', customerId);

      return this.mapCustomerResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to update customer:', error);
      throw error;
    }
  }

  async searchCustomer(criteria: SearchCriteria): Promise<Customer[]> {
    await this.ensureAuthenticated();

    try {
      const params: any = {};
      if (criteria.phoneNumber) params.phone_number = criteria.phoneNumber;
      if (criteria.email) params.email = criteria.email;
      if (criteria.customerId) params.customer_id = criteria.customerId;

      const response = await this.request<any>({
        method: 'GET',
        url: '/customers/search',
        params,
      });

      return (response.data || []).map(this.mapCustomerResponse);
    } catch (error) {
      logger.error('[Providus] Failed to search customers:', error);
      throw error;
    }
  }

  // ============================================================================
  // Wallet Management
  // ============================================================================

  async createWallet(data: CreateWalletRequest): Promise<Wallet> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/wallets',
        data: {
          customer_id: data.customerId,
          currency: data.currency,
          wallet_type: data.walletType || 'virtual',
          metadata: data.metadata,
        },
      });

      logger.info('[Providus] Wallet created:', response.data?.wallet_id);

      return this.mapWalletResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to create wallet:', error);
      throw error;
    }
  }

  async getWallet(walletId: string): Promise<Wallet> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/wallets/${walletId}`,
      });

      return this.mapWalletResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to get wallet:', error);
      throw error;
    }
  }

  async getWalletsByCustomer(customerId: string): Promise<Wallet[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/customers/${customerId}/wallets`,
      });

      return (response.data || []).map(this.mapWalletResponse);
    } catch (error) {
      logger.error('[Providus] Failed to get customer wallets:', error);
      throw error;
    }
  }

  async getWalletBalance(walletId: string): Promise<Balance> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/wallets/${walletId}/balance`,
      });

      return {
        walletId,
        currency: response.data.currency || 'NGN',
        availableBalance: parseFloat(response.data.available_balance || '0'),
        ledgerBalance: parseFloat(response.data.ledger_balance || '0'),
        reservedBalance: parseFloat(response.data.reserved_balance || '0'),
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[Providus] Failed to get wallet balance:', error);
      throw error;
    }
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  async initiateTransfer(data: TransferRequest): Promise<Transaction> {
    await this.ensureAuthenticated();

    try {
      const reference = data.reference || this.generateReference('PROV');

      let endpoint = '/transfers';
      let payload: any = {
        source_wallet_id: data.sourceWalletId,
        amount: data.amount,
        currency: data.currency,
        narration: data.narration,
        reference,
        metadata: data.metadata,
      };

      // Route based on destination type
      if (data.destinationType === 'bank') {
        endpoint = '/transfers/bank';
        payload = {
          ...payload,
          account_number: data.accountNumber,
          bank_code: data.bankCode,
          account_name: data.accountName,
        };
      } else if (data.destinationType === 'wallet') {
        endpoint = '/transfers/wallet';
        payload = {
          ...payload,
          destination_wallet_id: data.destinationId,
        };
      }

      const response = await this.request<any>({
        method: 'POST',
        url: endpoint,
        data: payload,
      });

      logger.info('[Providus] Transfer initiated:', reference);

      return this.mapTransactionResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to initiate transfer:', error);
      throw error;
    }
  }

  async getTransaction(transactionId: string): Promise<Transaction> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/transactions/${transactionId}`,
      });

      return this.mapTransactionResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to get transaction:', error);
      throw error;
    }
  }

  async getTransactionHistory(
    walletId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<Transaction>> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: `/wallets/${walletId}/transactions`,
        params: {
          page: options?.page || 1,
          limit: options?.limit || 50,
          start_date: options?.startDate,
          end_date: options?.endDate,
        },
      });

      return {
        data: (response.data || []).map(this.mapTransactionResponse),
        pagination: {
          currentPage: response.pagination?.current_page || 1,
          totalPages: response.pagination?.total_pages || 1,
          totalRecords: response.pagination?.total_records || 0,
          limit: response.pagination?.limit || 50,
        },
      };
    } catch (error) {
      logger.error('[Providus] Failed to get transaction history:', error);
      throw error;
    }
  }

  // ============================================================================
  // Bank Operations
  // ============================================================================

  async getBankList(): Promise<Bank[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '/banks',
      });

      return (response.data || []).map((bank: any) => ({
        code: bank.code || bank.bank_code,
        name: bank.name || bank.bank_name,
        slug: bank.slug,
        country: bank.country || 'NG',
      }));
    } catch (error) {
      logger.error('[Providus] Failed to get bank list:', error);
      throw error;
    }
  }

  async validateBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountValidation> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/banks/validate-account',
        data: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      return {
        accountNumber,
        accountName: response.data.account_name,
        bankCode,
        bankName: response.data.bank_name,
        isValid: response.data.is_valid !== false,
      };
    } catch (error) {
      logger.error('[Providus] Failed to validate bank account:', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || this.isTokenExpired()) {
      if (this.refreshToken) {
        await this.refreshToken();
      } else {
        await this.authenticate();
      }
    }
  }

  private mapCustomerResponse(data: any): Customer {
    return {
      id: data.id || data.customer_id,
      providerId: data.provider_id || data.customer_id,
      firstName: data.first_name || data.firstName,
      lastName: data.last_name || data.lastName,
      email: data.email,
      phoneNumber: data.phone_number || data.phoneNumber,
      dateOfBirth: data.date_of_birth || data.dateOfBirth,
      address: data.address,
      kycStatus: data.kyc_status || 'pending',
      kycLevel: data.kyc_level,
      status: data.status || 'active',
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
      metadata: data.metadata,
    };
  }

  private mapWalletResponse(data: any): Wallet {
    return {
      id: data.id || data.wallet_id,
      providerId: data.provider_id || data.wallet_id,
      customerId: data.customer_id || data.customerId,
      accountNumber: data.account_number || data.accountNumber,
      accountName: data.account_name || data.accountName,
      currency: data.currency || 'NGN',
      walletType: data.wallet_type || data.walletType || 'virtual',
      status: data.status || 'active',
      availableBalance: parseFloat(data.available_balance || data.availableBalance || '0'),
      ledgerBalance: parseFloat(data.ledger_balance || data.ledgerBalance || '0'),
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
      metadata: data.metadata,
    };
  }

  private mapTransactionResponse(data: any): Transaction {
    return {
      id: data.id || data.transaction_id,
      providerId: data.provider_id || data.transaction_id,
      reference: data.reference,
      sourceWalletId: data.source_wallet_id || data.sourceWalletId,
      destinationId: data.destination_id || data.destinationId,
      destinationType: data.destination_type || data.destinationType || 'wallet',
      amount: parseFloat(data.amount || '0'),
      currency: data.currency || 'NGN',
      fee: parseFloat(data.fee || '0'),
      totalAmount: parseFloat(data.total_amount || data.amount || '0'),
      status: data.status || 'pending',
      narration: data.narration,
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      completedAt: data.completed_at || data.completedAt,
      failureReason: data.failure_reason || data.failureReason,
      metadata: data.metadata,
    };
  }
}
