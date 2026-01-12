/**
 * Providus Bank Provider
 *
 * Implements TransferProvider interface for NIP bank transfers.
 * Wraps the existing Providus client from onasis-gateway.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import type {
  ProviderConfig,
  ProviderResult,
  TransferProvider,
  TransferParams,
  Transfer,
  AccountValidation,
  AccountDetails,
  Currency,
  TransactionStatus,
} from '@shared/types/providers';

interface ProvidusCredentials {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
}

interface ProvidusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ProvidusTransferResponse {
  responseCode: string;
  responseMessage: string;
  transactionReference?: string;
  sessionId?: string;
}

interface ProvidusAccountResponse {
  responseCode: string;
  responseMessage: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
}

// Status code mapping
const STATUS_MAP: Record<string, TransactionStatus> = {
  '00': 'success',
  '01': 'pending',
  '02': 'processing',
  '03': 'failed',
  '09': 'failed',
  '12': 'failed',
  '25': 'failed',
  '51': 'failed', // Insufficient funds
  '96': 'failed', // System error
};

// Error code mapping
const ERROR_MAP: Record<string, { code: string; retryable: boolean }> = {
  '51': { code: 'INSUFFICIENT_FUNDS', retryable: false },
  '12': { code: 'INVALID_ACCOUNT', retryable: false },
  '25': { code: 'ACCOUNT_NOT_FOUND', retryable: false },
  '96': { code: 'PROVIDER_ERROR', retryable: true },
  '09': { code: 'TRANSFER_FAILED', retryable: false },
};

export class ProvidusProvider implements TransferProvider {
  readonly name = 'providus';
  readonly supportedCountries = ['NG'];
  readonly supportedCurrencies: Currency[] = ['NGN'];

  private client: AxiosInstance;
  private credentials: ProvidusCredentials;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: ProviderConfig) {
    this.credentials = config.credentials as ProvidusCredentials;

    const baseURL = config.baseUrl || (
      config.environment === 'live'
        ? 'https://api.providusbank.com'
        : 'https://sandbox.providusbank.com'
    );

    this.client = axios.create({
      baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(async (config) => {
      if (config.url !== '/auth/login') {
        const token = await this.ensureValidToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<string> {
    // Check if token is still valid (with 5 min buffer)
    if (this.accessToken && this.tokenExpiry) {
      const now = new Date();
      const buffer = 5 * 60 * 1000; // 5 minutes
      if (this.tokenExpiry.getTime() - now.getTime() > buffer) {
        return this.accessToken;
      }
    }

    // Get new token
    const authString = Buffer.from(
      `${this.credentials.clientId}:${this.credentials.clientSecret}`
    ).toString('base64');

    const response = await this.client.post<ProvidusTokenResponse>(
      '/auth/login',
      {
        username: this.credentials.username,
        password: this.credentials.password,
      },
      {
        headers: {
          Authorization: `Basic ${authString}`,
        },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = new Date(Date.now() + response.data.expires_in * 1000);

    return this.accessToken;
  }

  /**
   * Initiate a bank transfer via NIP
   */
  async initiateTransfer(params: TransferParams): Promise<ProviderResult<Transfer>> {
    try {
      // Only bank transfers supported
      if (params.destinationType !== 'bank') {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_DESTINATION',
            message: 'Providus only supports bank transfers',
            retryable: false,
          },
        };
      }

      const requestBody = {
        beneficiaryAccountNumber: params.destinationAccountNumber,
        beneficiaryAccountName: params.destinationAccountName,
        beneficiaryBankCode: params.destinationBankCode,
        amount: params.amount / 100, // Convert from minor to major units
        currency: params.currency,
        narration: params.narration || 'Transfer',
        transactionReference: params.reference,
        sourceAccountNumber: params.sourceWalletId, // Assuming wallet ID maps to account
      };

      const response = await this.client.post<ProvidusTransferResponse>(
        '/nip/transfer',
        requestBody
      );

      const status = STATUS_MAP[response.data.responseCode] || 'failed';

      if (status === 'failed') {
        const errorInfo = ERROR_MAP[response.data.responseCode] || {
          code: 'TRANSFER_FAILED',
          retryable: false,
        };

        return {
          success: false,
          providerRef: response.data.transactionReference,
          rawRequest: requestBody,
          rawResponse: response.data,
          error: {
            code: errorInfo.code,
            message: response.data.responseMessage,
            providerCode: response.data.responseCode,
            retryable: errorInfo.retryable,
          },
        };
      }

      return {
        success: true,
        providerRef: response.data.transactionReference,
        rawRequest: requestBody,
        rawResponse: response.data,
        data: {
          id: params.reference,
          reference: params.reference,
          providerRef: response.data.transactionReference,
          amount: params.amount,
          fee: 0, // Providus includes fee in response
          currency: params.currency,
          status,
          sourceWalletId: params.sourceWalletId,
          destinationType: 'bank',
          destinationDetails: {
            accountNumber: params.destinationAccountNumber,
            accountName: params.destinationAccountName,
            bankCode: params.destinationBankCode,
          },
          narration: params.narration,
          createdAt: new Date(),
          completedAt: status === 'success' ? new Date() : undefined,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get transfer status
   */
  async getTransferStatus(reference: string): Promise<ProviderResult<Transfer>> {
    try {
      const response = await this.client.get<ProvidusTransferResponse>(
        `/nip/transfer/status/${reference}`
      );

      const status = STATUS_MAP[response.data.responseCode] || 'pending';

      return {
        success: true,
        providerRef: response.data.transactionReference,
        rawResponse: response.data,
        data: {
          id: reference,
          reference,
          providerRef: response.data.transactionReference,
          amount: 0, // Not returned in status check
          fee: 0,
          currency: 'NGN',
          status,
          sourceWalletId: '',
          destinationType: 'bank',
          destinationDetails: {},
          createdAt: new Date(),
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Validate bank account (Name Enquiry)
   */
  async validateAccount(params: AccountValidation): Promise<ProviderResult<AccountDetails>> {
    try {
      const response = await this.client.post<ProvidusAccountResponse>(
        '/nip/name-enquiry',
        {
          accountNumber: params.accountNumber,
          bankCode: params.bankCode,
        }
      );

      if (response.data.responseCode !== '00') {
        return {
          success: false,
          rawResponse: response.data,
          error: {
            code: 'INVALID_ACCOUNT',
            message: response.data.responseMessage,
            providerCode: response.data.responseCode,
            retryable: false,
          },
        };
      }

      return {
        success: true,
        rawResponse: response.data,
        data: {
          accountNumber: params.accountNumber,
          accountName: response.data.accountName || '',
          bankCode: params.bankCode,
          bankName: '', // Would need bank list lookup
          valid: true,
        },
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Get list of banks
   */
  async getBanks(): Promise<ProviderResult<Array<{ code: string; name: string }>>> {
    try {
      const response = await this.client.get('/banks');

      return {
        success: true,
        rawResponse: response.data,
        data: response.data.banks || [],
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle errors
   */
  private handleError<T>(error: unknown): ProviderResult<T> {
    if (error instanceof AxiosError) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      const isNetworkError = !error.response;

      return {
        success: false,
        rawResponse: error.response?.data,
        error: {
          code: isTimeout ? 'PROVIDER_TIMEOUT' : isNetworkError ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_ERROR',
          message: error.message,
          providerCode: error.response?.status?.toString(),
          retryable: isTimeout || isNetworkError || error.response?.status === 503,
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      },
    };
  }
}

export default ProvidusProvider;
