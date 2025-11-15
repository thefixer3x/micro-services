import { BaseProvider } from '../BaseProvider';
import {
  IWalletProvider,
  AuthResult,
  CreateCustomerRequest,
  CreateCustomerWalletRequest,
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
        url: '/auth/refresh/token', // Correct endpoint per API docs
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
      // Convert address object to string if needed
      const addressString = typeof data.address === 'string' 
        ? data.address 
        : data.address 
          ? `${data.address.street || ''}, ${data.address.city || ''}, ${data.address.state || ''}, ${data.address.country || ''}`.trim()
          : undefined;

      const response = await this.request<any>({
        method: 'POST',
        url: '/customers',
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone_number: data.phoneNumber,
          date_of_birth: data.dateOfBirth,
          bvn: data.bvn,
          address: addressString,
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

  /**
   * Create customer wallet in a single call (Providus API endpoint)
   * This is the recommended way to create wallets as it's more efficient
   */
  async createCustomerWallet(data: CreateCustomerWalletRequest): Promise<{ customer: Customer; wallet: Wallet }> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'POST',
        url: '/wallet', // Combined endpoint per API docs
        data: {
          bvn: data.bvn,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          phoneNumber: data.phoneNumber,
          email: data.email,
          address: data.address,
          metadata: data.metadata,
        },
      });

      logger.info('[Providus] Customer wallet created:', {
        customerId: response.customer?.id,
        walletId: response.wallet?.id,
      });

      return {
        customer: this.mapCustomerResponse(response.customer),
        wallet: this.mapWalletResponse(response.wallet),
      };
    } catch (error) {
      logger.error('[Providus] Failed to create customer wallet:', error);
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

  /**
   * Find customer by phone number (quick lookup)
   */
  async findCustomerByPhone(phoneNumber: string): Promise<Customer | null> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '/customer/phone',
        params: {
          phoneNumber,
        },
      });

      if (!response.customer) {
        return null;
      }

      return this.mapCustomerResponse(response.customer);
    } catch (error) {
      logger.error('[Providus] Failed to find customer by phone:', error);
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

  /**
   * Get all customer wallets (merchant operation)
   */
  async getAllWallets(): Promise<Wallet[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '/wallet', // Per API docs
      });

      return (response.wallets || []).map(this.mapWalletResponse);
    } catch (error) {
      logger.error('[Providus] Failed to get all wallets:', error);
      throw error;
    }
  }

  /**
   * Get merchant's own wallet
   */
  async getMerchantWallet(): Promise<Wallet> {
    await this.ensureAuthenticated();

    try {
      const response = await this.request<any>({
        method: 'GET',
        url: '/merchant/wallet',
      });

      return this.mapWalletResponse(response.data);
    } catch (error) {
      logger.error('[Providus] Failed to get merchant wallet:', error);
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
      // Providus API requires customerId for transfers, not walletId
      // If sourceCustomerId is not provided, we need to look it up from walletId
      // For now, we'll require it to be passed in the request
      if (!data.sourceCustomerId) {
        throw new ProviderError(
          'sourceCustomerId is required for Providus transfers. Please provide customerId in TransferRequest.',
          'MISSING_CUSTOMER_ID'
        );
      }

      let endpoint: string;
      let payload: any;

      // Route based on destination type per Providus API docs
      if (data.destinationType === 'wallet') {
        // Customer-to-customer wallet transfer
        // Endpoint: POST /transfer/wallet (singular, not plural)
        if (!data.destinationCustomerId) {
          throw new ProviderError(
            'destinationCustomerId is required for wallet-to-wallet transfers',
            'MISSING_DESTINATION_CUSTOMER_ID'
          );
        }

        endpoint = '/transfer/wallet'; // Note: singular "transfer"
        payload = {
          amount: data.amount,
          fromCustomerId: data.sourceCustomerId,
          toCustomerId: data.destinationCustomerId,
        };
      } else if (data.destinationType === 'bank') {
        // Customer bank transfer
        // Endpoint: POST /transfer/bank/customer
        if (!data.accountNumber || !data.accountName) {
          throw new ProviderError(
            'accountNumber and accountName are required for bank transfers',
            'MISSING_BANK_DETAILS'
          );
        }

        // Use sortCode if provided, otherwise map bankCode to sortCode
        const sortCode = data.sortCode || data.bankCode;
        if (!sortCode) {
          throw new ProviderError(
            'sortCode or bankCode is required for bank transfers',
            'MISSING_SORT_CODE'
          );
        }

        endpoint = '/transfer/bank/customer';
        payload = {
          amount: data.amount,
          sortCode: sortCode, // Providus uses sortCode, not bankCode
          narration: data.narration,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          customerId: data.sourceCustomerId,
          metadata: data.metadata,
        };
      } else {
        throw new ProviderError(
          `Unsupported destination type: ${data.destinationType}`,
          'UNSUPPORTED_DESTINATION_TYPE'
        );
      }

      const response = await this.request<any>({
        method: 'POST',
        url: endpoint,
        data: payload,
      });

      // Map response based on transfer type
      const transferData = data.destinationType === 'wallet' 
        ? response.data 
        : response.transfer;

      logger.info('[Providus] Transfer initiated:', {
        reference: transferData?.reference,
        type: data.destinationType,
      });

      return this.mapTransactionResponse(transferData, data);
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
      // Per API docs: GET /transfer/banks (not /banks)
      const response = await this.request<any>({
        method: 'GET',
        url: '/transfer/banks',
      });

      return (response.banks || []).map((bank: any) => ({
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
      // Per API docs: GET /transfer/account/details?sortCode=...&accountNumber=...
      // bankCode is used as sortCode (they're the same thing)
      const sortCode = bankCode;

      const response = await this.request<any>({
        method: 'GET',
        url: '/transfer/account/details',
        params: {
          sortCode: sortCode,
          accountNumber: accountNumber,
        },
      });

      return {
        accountNumber: response.account?.accountNumber || accountNumber,
        accountName: response.account?.accountName || '',
        bankCode: response.account?.bankCode || bankCode, // Providus returns it as bankCode
        bankName: undefined, // Not provided in response
        isValid: !!response.account?.accountName, // Valid if account name is returned
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
      providerId: data.provider_id || data.customer_id || data.id,
      firstName: data.first_name || data.firstName,
      lastName: data.last_name || data.lastName,
      email: data.email,
      phoneNumber: data.phone_number || data.phoneNumber,
      dateOfBirth: data.date_of_birth || data.dateOfBirth,
      address: data.address,
      kycStatus: this.mapKycStatus(data.kyc_status, data.tier),
      kycLevel: this.mapKycLevel(data.tier),
      status: this.mapCustomerStatus(data.status, data.mode),
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
      metadata: {
        ...data.metadata,
        bvn: data.bvn,
        nameMatch: data.nameMatch,
        BVNFirstName: data.BVNFirstName,
        BVNLastName: data.BVNLastName,
        tier: data.tier,
        mode: data.mode,
        MerchantId: data.MerchantId,
        walletId: data.walletId,
      },
    };
  }

  private mapKycStatus(kycStatus?: string, tier?: string): Customer['kycStatus'] {
    if (kycStatus) {
      if (kycStatus.toLowerCase().includes('verified')) return 'verified';
      if (kycStatus.toLowerCase().includes('rejected')) return 'rejected';
    }
    // Infer from tier
    if (tier && tier !== 'TIER_0') return 'verified';
    return 'pending';
  }

  private mapKycLevel(tier?: string): Customer['kycLevel'] {
    if (!tier) return undefined;
    if (tier === 'TIER_1') return 'basic';
    if (tier === 'TIER_2') return 'intermediate';
    if (tier === 'TIER_3') return 'full';
    return 'basic';
  }

  private mapCustomerStatus(status?: string, mode?: string): Customer['status'] {
    if (!status) return 'active';
    const statusLower = status.toLowerCase();
    if (statusLower === 'active' || statusLower === 'enabled') return 'active';
    if (statusLower === 'inactive' || statusLower === 'disabled') return 'inactive';
    if (statusLower === 'suspended' || statusLower === 'frozen') return 'suspended';
    return 'active';
  }

  private mapWalletResponse(data: any): Wallet {
    // Providus returns bookedBalance (ledger) and availableBalance
    const bookedBalance = parseFloat(data.bookedBalance || data.ledger_balance || data.ledgerBalance || '0');
    const availableBalance = parseFloat(data.availableBalance || data.available_balance || '0');

    return {
      id: data.id || data.wallet_id || data.walletId,
      providerId: data.provider_id || data.wallet_id || data.id,
      customerId: data.customer_id || data.customerId || data.walletId, // walletId sometimes equals customerId in Providus
      accountNumber: data.account_number || data.accountNumber,
      accountName: data.account_name || data.accountName,
      currency: data.currency || 'NGN',
      walletType: this.mapWalletType(data.walletType, data.wallet_type),
      status: this.mapWalletStatus(data.status),
      availableBalance: availableBalance,
      ledgerBalance: bookedBalance,
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      updatedAt: data.updated_at || data.updatedAt || new Date().toISOString(),
      metadata: {
        ...data.metadata,
        bankName: data.bankName,
        bankCode: data.bankCode,
        accountReference: data.accountReference,
        mode: data.mode,
        email: data.email,
      },
    };
  }

  private mapWalletType(walletType?: string, wallet_type?: string): Wallet['walletType'] {
    const type = (walletType || wallet_type || '').toLowerCase();
    if (type.includes('savings')) return 'savings';
    if (type.includes('current')) return 'current';
    return 'virtual'; // Default for Providus customer wallets
  }

  private mapWalletStatus(status?: string): Wallet['status'] {
    if (!status) return 'active';
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return 'active';
    if (statusLower === 'frozen' || statusLower === 'suspended') return 'frozen';
    if (statusLower === 'inactive' || statusLower === 'closed') return 'inactive';
    return 'active';
  }

  private mapTransactionResponse(data: any, transferRequest?: TransferRequest): Transaction {
    // Handle different response structures from Providus API
    // Wallet transfer response has: reference, transaction_fee, total, source_customer_wallet, target_customer_wallet
    // Bank transfer response has: reference, charges, vat, total, sessionId, transactionReference
    
    const fee = parseFloat(data.transaction_fee || data.charges || data.fee || '0');
    const vat = parseFloat(data.vat || '0');
    const totalAmount = parseFloat(data.total || data.total_amount || data.amount || '0');

    return {
      id: data.id || data.transaction_id || data.transactionReference || data.reference,
      providerId: data.transactionReference || data.reference || data.id,
      reference: data.reference,
      sourceWalletId: data.source_customer_wallet || data.source_wallet_id || transferRequest?.sourceWalletId || '',
      destinationId: data.target_customer_wallet || data.destination_id || transferRequest?.destinationId || '',
      destinationType: transferRequest?.destinationType || data.destination_type || 'wallet',
      amount: parseFloat(data.amount || '0'),
      currency: data.currency || 'NGN',
      fee: fee + vat, // Include VAT in total fee
      totalAmount: totalAmount,
      status: this.mapTransactionStatus(data.status, data.responseCode),
      narration: data.narration || data.description,
      createdAt: data.created_at || data.createdAt || new Date().toISOString(),
      completedAt: data.completed_at || data.completedAt,
      failureReason: data.failure_reason || data.failureReason,
      metadata: {
        ...data.metadata,
        sessionId: data.sessionId,
        transactionReference: data.transactionReference,
        description: data.description,
      },
    };
  }

  private mapTransactionStatus(status?: string, responseCode?: string): Transaction['status'] {
    if (responseCode === '00' || status === 'SUCCESS' || status === 'completed') {
      return 'completed';
    }
    if (status === 'FAILED' || status === 'failed') {
      return 'failed';
    }
    if (status === 'PENDING' || status === 'pending') {
      return 'pending';
    }
    if (status === 'PROCESSING' || status === 'processing') {
      return 'processing';
    }
    return 'pending';
  }
}
