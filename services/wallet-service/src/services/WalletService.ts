import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection';
import { ProviderFactory } from '../providers/ProviderFactory';
import { IWalletProvider, ProviderError } from '../providers/IWalletProvider';
import { logger } from '../utils/logger';

export class WalletService {
  private db: Pool;

  constructor() {
    this.db = getDatabase();
  }

  // ========================================================================
  // Customer Management
  // ========================================================================

  async createCustomer(userId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth?: string;
    bvn?: string;
    address?: string;
    provider?: string;
  }) {
    const providerName = data.provider || process.env.DEFAULT_WALLET_PROVIDER || 'providus';
    const provider = ProviderFactory.getProvider(providerName);

    try {
      // Initialize provider if needed
      await provider.initialize();

      // Create customer with provider
      const providerCustomer = await provider.createCustomer({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        bvn: data.bvn,
        address: data.address,
      });

      // Store customer data locally
      const result = await this.db.query(
        `INSERT INTO customers (
          provider, provider_customer_id, user_id, first_name, last_name,
          email, phone_number, kyc_status, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          providerName,
          providerCustomer.providerId,
          userId,
          data.firstName,
          data.lastName,
          data.email,
          data.phoneNumber,
          providerCustomer.kycStatus || 'pending',
          providerCustomer.status || 'active',
          JSON.stringify(providerCustomer.metadata || {}),
        ]
      );

      logger.info(`Customer created:`, { userId, customerId: result.rows[0].id });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create customer:', error);
      throw error;
    }
  }

  /**
   * Create customer and wallet in a single call (more efficient for Providus)
   * This uses the combined endpoint which is faster than separate calls
   */
  async createCustomerWallet(userId: string, data: {
    bvn: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string; // YYYY-MM-DD format
    phoneNumber: string;
    email: string;
    address?: string;
    currency?: string;
    provider?: string;
  }) {
    const providerName = data.provider || process.env.DEFAULT_WALLET_PROVIDER || 'providus';
    const provider = ProviderFactory.getProvider(providerName);

    try {
      // Initialize provider if needed
      await provider.initialize();

      // Check if provider supports combined creation
      if (!provider.createCustomerWallet) {
        // Fallback to separate calls
        const customer = await this.createCustomer(userId, {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phoneNumber: data.phoneNumber,
          dateOfBirth: data.dateOfBirth,
          bvn: data.bvn,
          address: data.address,
          provider: providerName,
        });

        const wallet = await this.createWallet(customer.id, {
          currency: data.currency,
          provider: providerName,
        });

        return { customer, wallet };
      }

      // Use combined endpoint (more efficient)
      const result = await provider.createCustomerWallet({
        bvn: data.bvn,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        phoneNumber: data.phoneNumber,
        email: data.email,
        address: data.address,
      });

      // Store customer locally
      const customerResult = await this.db.query(
        `INSERT INTO customers (
          provider, provider_customer_id, user_id, first_name, last_name,
          email, phone_number, kyc_status, status, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          providerName,
          result.customer.providerId,
          userId,
          result.customer.firstName,
          result.customer.lastName,
          result.customer.email,
          result.customer.phoneNumber,
          result.customer.kycStatus || 'pending',
          result.customer.status || 'active',
          JSON.stringify(result.customer.metadata || {}),
        ]
      );

      const customer = customerResult.rows[0];

      // Store wallet locally
      const walletResult = await this.db.query(
        `INSERT INTO wallets (
          provider, provider_wallet_id, customer_id, account_number, account_name,
          currency, wallet_type, status, available_balance, ledger_balance,
          last_balance_update, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          providerName,
          result.wallet.providerId,
          customer.id,
          result.wallet.accountNumber,
          result.wallet.accountName,
          result.wallet.currency,
          result.wallet.walletType,
          result.wallet.status,
          result.wallet.availableBalance,
          result.wallet.ledgerBalance,
          new Date(),
          JSON.stringify(result.wallet.metadata || {}),
        ]
      );

      logger.info(`Customer wallet created:`, {
        userId,
        customerId: customer.id,
        walletId: walletResult.rows[0].id,
      });

      return {
        customer,
        wallet: walletResult.rows[0],
      };
    } catch (error) {
      logger.error('Failed to create customer wallet:', error);
      throw error;
    }
  }

  async getCustomerByUserId(userId: string) {
    const result = await this.db.query(
      'SELECT * FROM customers WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  // ========================================================================
  // Wallet Management
  // ========================================================================

  async createWallet(customerId: string, data: {
    currency?: string;
    walletType?: 'savings' | 'current' | 'virtual';
    provider?: string;
  }) {
    // Get customer info
    const customerResult = await this.db.query(
      'SELECT * FROM customers WHERE id = $1',
      [customerId]
    );

    if (customerResult.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = customerResult.rows[0];
    const providerName = data.provider || customer.provider;
    const provider = ProviderFactory.getProvider(providerName);

    try {
      // Create wallet with provider
      const providerWallet = await provider.createWallet({
        customerId: customer.provider_customer_id,
        currency: data.currency || 'NGN',
        walletType: data.walletType || 'virtual',
      });

      // Store wallet data locally
      const result = await this.db.query(
        `INSERT INTO wallets (
          provider, provider_wallet_id, customer_id, account_number, account_name,
          currency, wallet_type, status, available_balance, ledger_balance,
          last_balance_update, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          providerName,
          providerWallet.providerId,
          customerId,
          providerWallet.accountNumber,
          providerWallet.accountName,
          providerWallet.currency,
          providerWallet.walletType,
          providerWallet.status,
          providerWallet.availableBalance,
          providerWallet.ledgerBalance,
          new Date(),
          JSON.stringify(providerWallet.metadata || {}),
        ]
      );

      logger.info(`Wallet created:`, { customerId, walletId: result.rows[0].id });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create wallet:', error);
      throw error;
    }
  }

  async getWallet(walletId: string) {
    const result = await this.db.query(
      'SELECT * FROM wallets WHERE id = $1',
      [walletId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async getWalletsByCustomer(customerId: string) {
    const result = await this.db.query(
      'SELECT * FROM wallets WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );

    return result.rows;
  }

  async getWalletBalance(walletId: string, forceRefresh: boolean = false) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Return cached balance if recent (within 5 minutes) and not forcing refresh
    if (!forceRefresh && wallet.last_balance_update) {
      const lastUpdate = new Date(wallet.last_balance_update);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (lastUpdate > fiveMinutesAgo) {
        return {
          walletId,
          currency: wallet.currency,
          availableBalance: parseFloat(wallet.available_balance),
          ledgerBalance: parseFloat(wallet.ledger_balance),
          reservedBalance: parseFloat(wallet.reserved_balance || 0),
          lastUpdated: wallet.last_balance_update,
        };
      }
    }

    // Fetch fresh balance from provider
    const provider = ProviderFactory.getProvider(wallet.provider);
    const balance = await provider.getWalletBalance(wallet.provider_wallet_id);

    // Update local cache
    await this.db.query(
      `UPDATE wallets
       SET available_balance = $1, ledger_balance = $2, last_balance_update = NOW()
       WHERE id = $3`,
      [balance.availableBalance, balance.ledgerBalance, walletId]
    );

    return balance;
  }

  // ========================================================================
  // Transactions
  // ========================================================================

  async initiateTransfer(walletId: string, data: {
    destinationType: 'wallet' | 'bank' | 'card';
    destinationId: string;
    destinationWalletId?: string; // For wallet-to-wallet transfers
    amount: number;
    currency?: string;
    narration?: string;
    reference?: string;
    bankCode?: string;
    sortCode?: string; // Providus uses sortCode (same as bankCode)
    accountNumber?: string;
    accountName?: string;
  }) {
    const wallet = await this.getWallet(walletId);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.status !== 'active') {
      throw new Error('Wallet is not active');
    }

    // Get customer to retrieve customerId (required by Providus API)
    const customer = await this.db.query(
      'SELECT * FROM customers WHERE id = $1',
      [wallet.customer_id]
    );

    if (customer.rows.length === 0) {
      throw new Error('Customer not found for wallet');
    }

    const customerData = customer.rows[0];
    const provider = ProviderFactory.getProvider(wallet.provider);
    const reference = data.reference || `TXN-${uuidv4()}`;

    try {
      // For wallet-to-wallet transfers, get destination customer
      // destinationId can be either walletId (local) or provider walletId
      let destinationCustomerId: string | undefined;
      if (data.destinationType === 'wallet') {
        // Try to find wallet by local ID first
        let destWallet = await this.getWallet(data.destinationId);
        
        // If not found locally, it might be a provider wallet ID
        // In that case, we'd need to look it up from provider
        // For now, we'll require destinationWalletId to be passed for clarity
        if (!destWallet && data.destinationWalletId) {
          destWallet = await this.getWallet(data.destinationWalletId);
        }
        
        if (destWallet) {
          const destCustomer = await this.db.query(
            'SELECT * FROM customers WHERE id = $1',
            [destWallet.customer_id]
          );
          if (destCustomer.rows.length > 0) {
            destinationCustomerId = destCustomer.rows[0].provider_customer_id;
          }
        } else {
          // If wallet not found locally, destinationId might be provider wallet ID
          // We'll need to get customer from provider (future enhancement)
          logger.warn('Destination wallet not found locally, may need provider lookup');
        }
      }

      // Initiate transfer with provider
      const providerTransaction = await provider.initiateTransfer({
        sourceWalletId: wallet.provider_wallet_id,
        sourceCustomerId: customerData.provider_customer_id, // Required for Providus
        destinationType: data.destinationType,
        destinationId: data.destinationId,
        destinationCustomerId: destinationCustomerId, // For wallet-to-wallet transfers
        amount: data.amount,
        currency: data.currency || wallet.currency,
        narration: data.narration,
        reference,
        bankCode: data.bankCode,
        sortCode: data.sortCode || data.bankCode, // Map bankCode to sortCode for Providus
        accountNumber: data.accountNumber,
        accountName: data.accountName,
      });

      // Store transaction locally
      const result = await this.db.query(
        `INSERT INTO transactions (
          provider, provider_transaction_id, reference, source_wallet_id,
          destination_type, destination_id, destination_name, amount, currency,
          fee, total_amount, status, narration, bank_code, account_number, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          wallet.provider,
          providerTransaction.providerId,
          reference,
          walletId,
          data.destinationType,
          data.destinationId,
          data.accountName,
          data.amount,
          data.currency || wallet.currency,
          providerTransaction.fee,
          providerTransaction.totalAmount,
          providerTransaction.status,
          data.narration,
          data.bankCode,
          data.accountNumber,
          JSON.stringify(providerTransaction.metadata || {}),
        ]
      );

      // Update wallet balance
      await this.getWalletBalance(walletId, true);

      logger.info(`Transfer initiated:`, { walletId, reference });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to initiate transfer:', error);
      throw error;
    }
  }

  async getTransaction(transactionId: string) {
    const result = await this.db.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transactionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async getTransactionHistory(walletId: string, options: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM transactions WHERE source_wallet_id = $1';
    const params: any[] = [walletId];
    let paramIndex = 2;

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.db.query(query, params);

    // Get total count with the same filters
    let countQuery = 'SELECT COUNT(*) FROM transactions WHERE source_wallet_id = $1';
    const countParams: any[] = [walletId];
    let countParamIndex = 2;

    if (options.startDate) {
      countQuery += ` AND created_at >= $${countParamIndex}`;
      countParams.push(options.startDate);
      countParamIndex++;
    }

    if (options.endDate) {
      countQuery += ` AND created_at <= $${countParamIndex}`;
      countParams.push(options.endDate);
    }

    const countResult = await this.db.query(countQuery, countParams);

    const totalRecords = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    return {
      data: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        limit,
      },
    };
  }

  // ========================================================================
  // Bank Operations
  // ========================================================================

  async getBankList(providerName?: string) {
    const provider = ProviderFactory.getProvider(
      providerName || process.env.DEFAULT_WALLET_PROVIDER || 'providus'
    );

    return provider.getBankList();
  }

  async validateBankAccount(accountNumber: string, bankCode: string, providerName?: string) {
    const provider = ProviderFactory.getProvider(
      providerName || process.env.DEFAULT_WALLET_PROVIDER || 'providus'
    );

    return provider.validateBankAccount(accountNumber, bankCode);
  }
}
