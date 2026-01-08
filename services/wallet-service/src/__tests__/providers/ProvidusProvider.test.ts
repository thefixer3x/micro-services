/**
 * ProvidusProvider Unit Tests
 * Tests the Providus Bank (Xpress Wallet) API integration
 */

import axios from 'axios';
import { ProvidusProvider } from '../../providers/providus/ProvidusProvider';
import type { ProviderConfig } from '../../providers/IWalletProvider';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ProvidusProvider', () => {
  let provider: ProvidusProvider;
  let mockAxiosInstance: any;

  const testConfig: ProviderConfig = {
    name: 'providus',
    baseUrl: 'https://sandbox.api.xpresswallet.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    useSandbox: true,
  };

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      defaults: { headers: { common: {} } },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    provider = new ProvidusProvider(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with valid config', () => {
      expect(provider.name).toBe('providus');
      expect(provider.version).toBe('1.0.0');
    });

    it('should throw error if clientId is missing', () => {
      expect(() => {
        new ProvidusProvider({ ...testConfig, clientId: undefined });
      }).toThrow();
    });

    it('should throw error if clientSecret is missing', () => {
      expect(() => {
        new ProvidusProvider({ ...testConfig, clientSecret: undefined });
      }).toThrow();
    });
  });

  describe('Authentication', () => {
    const mockAuthResponse = {
      data: {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
    };

    it('should authenticate successfully', async () => {
      mockAxiosInstance.request.mockResolvedValueOnce(mockAuthResponse);

      const result = await provider.authenticate();

      expect(result.accessToken).toBe('test-access-token');
      expect(result.refreshToken).toBe('test-refresh-token');
      expect(result.expiresIn).toBe(3600);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/auth/login',
          data: {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        })
      );
    });

    it('should refresh token successfully', async () => {
      // First authenticate to get refresh token
      mockAxiosInstance.request.mockResolvedValueOnce(mockAuthResponse);
      await provider.authenticate();

      // Then refresh
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          accessToken: 'new-access-token',
          expiresIn: 3600,
        },
      });

      const result = await provider.refreshToken();

      expect(result.accessToken).toBe('new-access-token');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/auth/refresh/token',
        })
      );
    });
  });

  describe('Customer Management', () => {
    beforeEach(async () => {
      // Authenticate first
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        },
      });
      await provider.authenticate();
    });

    it('should create customer successfully', async () => {
      const mockCustomerResponse = {
        data: {
          data: {
            id: 'cust-123',
            customer_id: 'cust-123',
            first_name: 'John',
            last_name: 'Doe',
            email: 'john@example.com',
            phone_number: '08012345678',
            kyc_status: 'pending',
            status: 'active',
            bvn: '12345678901',
            tier: 'TIER_1',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockCustomerResponse);

      const result = await provider.createCustomer({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phoneNumber: '08012345678',
        bvn: '12345678901',
        dateOfBirth: '1990-01-15',
      });

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.email).toBe('john@example.com');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/customers',
        })
      );
    });

    it('should create customer wallet (combined endpoint) successfully', async () => {
      const mockCombinedResponse = {
        data: {
          customer: {
            id: 'cust-123',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phoneNumber: '08012345678',
            bvn: '12345678901',
            tier: 'TIER_1',
          },
          wallet: {
            id: 'wallet-123',
            accountNumber: '1234567890',
            accountName: 'John Doe',
            bankName: 'Providus Bank',
            bankCode: '000023',
            currency: 'NGN',
            status: 'ACTIVE',
            bookedBalance: 0,
            availableBalance: 0,
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockCombinedResponse);

      const result = await provider.createCustomerWallet({
        bvn: '12345678901',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-15',
        phoneNumber: '08012345678',
        email: 'john@example.com',
      });

      expect(result.customer.firstName).toBe('John');
      expect(result.wallet.accountNumber).toBe('1234567890');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/wallet',
        })
      );
    });

    it('should find customer by phone', async () => {
      const mockPhoneLookupResponse = {
        data: {
          customer: {
            id: 'cust-123',
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '08012345678',
            email: 'john@example.com',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockPhoneLookupResponse);

      const result = await provider.findCustomerByPhone('08012345678');

      expect(result).not.toBeNull();
      expect(result!.phoneNumber).toBe('08012345678');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/customer/phone',
          params: { phoneNumber: '08012345678' },
        })
      );
    });
  });

  describe('Wallet Management', () => {
    beforeEach(async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        },
      });
      await provider.authenticate();
    });

    it('should get wallet balance', async () => {
      const mockBalanceResponse = {
        data: {
          data: {
            currency: 'NGN',
            available_balance: '5000.00',
            ledger_balance: '5500.00',
            reserved_balance: '500.00',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockBalanceResponse);

      const result = await provider.getWalletBalance('wallet-123');

      expect(result.availableBalance).toBe(5000);
      expect(result.ledgerBalance).toBe(5500);
      expect(result.reservedBalance).toBe(500);
      expect(result.currency).toBe('NGN');
    });

    it('should get all wallets', async () => {
      const mockWalletsResponse = {
        data: {
          wallets: [
            {
              id: 'wallet-1',
              accountNumber: '1234567890',
              currency: 'NGN',
              status: 'ACTIVE',
            },
            {
              id: 'wallet-2',
              accountNumber: '0987654321',
              currency: 'NGN',
              status: 'ACTIVE',
            },
          ],
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockWalletsResponse);

      const result = await provider.getAllWallets();

      expect(result).toHaveLength(2);
      expect(result[0].accountNumber).toBe('1234567890');
    });

    it('should get merchant wallet', async () => {
      const mockMerchantWalletResponse = {
        data: {
          data: {
            id: 'merchant-wallet-1',
            accountNumber: '9999999999',
            accountName: 'Merchant Account',
            currency: 'NGN',
            status: 'ACTIVE',
            available_balance: '100000.00',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockMerchantWalletResponse);

      const result = await provider.getMerchantWallet();

      expect(result.accountNumber).toBe('9999999999');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/merchant/wallet',
        })
      );
    });
  });

  describe('Transfers', () => {
    beforeEach(async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        },
      });
      await provider.authenticate();
    });

    it('should initiate wallet-to-wallet transfer', async () => {
      const mockTransferResponse = {
        data: {
          data: {
            amount: 200,
            reference: 'TXN-123',
            transaction_fee: 10,
            total: 210,
            source_customer_id: 'cust-1',
            target_customer_id: 'cust-2',
            source_customer_wallet: 'wallet-1',
            target_customer_wallet: 'wallet-2',
            description: 'Fund transfer between customers',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockTransferResponse);

      const result = await provider.initiateTransfer({
        sourceWalletId: 'wallet-1',
        sourceCustomerId: 'cust-1',
        destinationType: 'wallet',
        destinationId: 'wallet-2',
        destinationCustomerId: 'cust-2',
        amount: 200,
        currency: 'NGN',
      });

      expect(result.amount).toBe(200);
      expect(result.fee).toBe(10);
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/transfer/wallet',
          data: {
            amount: 200,
            fromCustomerId: 'cust-1',
            toCustomerId: 'cust-2',
          },
        })
      );
    });

    it('should initiate bank transfer', async () => {
      const mockBankTransferResponse = {
        data: {
          transfer: {
            amount: 100,
            charges: 10.5,
            vat: 0.79,
            reference: 'TXN-456',
            total: 111.29,
            sessionId: '123456789',
            destination: '0167421242/000013',
            transactionReference: '9533043993045314',
            description: 'Transfer of NGN 100 to John Doe',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockBankTransferResponse);

      const result = await provider.initiateTransfer({
        sourceWalletId: 'wallet-1',
        sourceCustomerId: 'cust-1',
        destinationType: 'bank',
        destinationId: '0167421242',
        amount: 100,
        currency: 'NGN',
        sortCode: '000013',
        accountNumber: '0167421242',
        accountName: 'John Doe',
        narration: 'Payment for services',
      });

      expect(result.amount).toBe(100);
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/transfer/bank/customer',
          data: expect.objectContaining({
            amount: 100,
            sortCode: '000013',
            customerId: 'cust-1',
          }),
        })
      );
    });

    it('should throw error if sourceCustomerId is missing for transfer', async () => {
      await expect(
        provider.initiateTransfer({
          sourceWalletId: 'wallet-1',
          destinationType: 'wallet',
          destinationId: 'wallet-2',
          amount: 200,
          currency: 'NGN',
        })
      ).rejects.toThrow('sourceCustomerId is required');
    });

    it('should throw error if destinationCustomerId is missing for wallet transfer', async () => {
      await expect(
        provider.initiateTransfer({
          sourceWalletId: 'wallet-1',
          sourceCustomerId: 'cust-1',
          destinationType: 'wallet',
          destinationId: 'wallet-2',
          amount: 200,
          currency: 'NGN',
        })
      ).rejects.toThrow('destinationCustomerId is required');
    });
  });

  describe('Bank Operations', () => {
    beforeEach(async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        data: {
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
          expiresIn: 3600,
        },
      });
      await provider.authenticate();
    });

    it('should get bank list from correct endpoint', async () => {
      const mockBankListResponse = {
        data: {
          banks: [
            { code: '000001', name: 'Sterling Bank', slug: 'sterling-bank' },
            { code: '000013', name: 'GTBank', slug: 'gtbank' },
            { code: '000023', name: 'Providus Bank', slug: 'providus-bank' },
          ],
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockBankListResponse);

      const result = await provider.getBankList();

      expect(result).toHaveLength(3);
      expect(result[0].code).toBe('000001');
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/transfer/banks',
        })
      );
    });

    it('should validate bank account using GET with query params', async () => {
      const mockValidationResponse = {
        data: {
          account: {
            bankCode: '000013',
            accountName: 'John Doe',
            accountNumber: '0167421242',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockValidationResponse);

      const result = await provider.validateBankAccount('0167421242', '000013');

      expect(result.accountName).toBe('John Doe');
      expect(result.accountNumber).toBe('0167421242');
      expect(result.isValid).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenLastCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/transfer/account/details',
          params: {
            sortCode: '000013',
            accountNumber: '0167421242',
          },
        })
      );
    });

    it('should return isValid false when account name is empty', async () => {
      const mockInvalidResponse = {
        data: {
          account: {
            bankCode: '000013',
            accountName: '',
            accountNumber: '0167421242',
          },
        },
      };

      mockAxiosInstance.request.mockResolvedValueOnce(mockInvalidResponse);

      const result = await provider.validateBankAccount('0167421242', '000013');

      expect(result.isValid).toBe(false);
    });
  });

  describe('Response Mapping', () => {
    it('should correctly map KYC status from tier', () => {
      // This tests the internal mapping logic
      const provider = new ProvidusProvider(testConfig);

      // Access private method through test helper
      const mapKycStatus = (provider as any).mapKycStatus.bind(provider);

      expect(mapKycStatus('verified', 'TIER_1')).toBe('verified');
      expect(mapKycStatus(undefined, 'TIER_1')).toBe('verified');
      expect(mapKycStatus(undefined, 'TIER_0')).toBe('pending');
      expect(mapKycStatus('rejected', undefined)).toBe('rejected');
    });

    it('should correctly map wallet type', () => {
      const provider = new ProvidusProvider(testConfig);
      const mapWalletType = (provider as any).mapWalletType.bind(provider);

      expect(mapWalletType('savings', undefined)).toBe('savings');
      expect(mapWalletType(undefined, 'current')).toBe('current');
      expect(mapWalletType(undefined, undefined)).toBe('virtual');
    });

    it('should correctly map transaction status', () => {
      const provider = new ProvidusProvider(testConfig);
      const mapTransactionStatus = (provider as any).mapTransactionStatus.bind(provider);

      expect(mapTransactionStatus('SUCCESS', '00')).toBe('completed');
      expect(mapTransactionStatus('completed', undefined)).toBe('completed');
      expect(mapTransactionStatus('FAILED', undefined)).toBe('failed');
      expect(mapTransactionStatus('PENDING', undefined)).toBe('pending');
      expect(mapTransactionStatus('PROCESSING', undefined)).toBe('processing');
    });
  });
});
