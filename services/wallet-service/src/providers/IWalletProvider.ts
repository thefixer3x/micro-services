/**
 * Wallet Provider Interface
 *
 * This interface defines the contract that all wallet providers must implement.
 * It ensures a consistent API regardless of the underlying provider (Providus, Flutterwave, etc.)
 */

export interface IWalletProvider {
  // Provider metadata
  readonly name: string;
  readonly version: string;

  // Authentication & Initialization
  initialize(): Promise<void>;
  authenticate(): Promise<AuthResult>;
  refreshToken(): Promise<AuthResult>;

  // Customer Management
  createCustomer(data: CreateCustomerRequest): Promise<Customer>;
  getCustomer(customerId: string): Promise<Customer>;
  updateCustomer(customerId: string, data: UpdateCustomerRequest): Promise<Customer>;
  searchCustomer(criteria: SearchCriteria): Promise<Customer[]>;
  findCustomerByPhone?(phoneNumber: string): Promise<Customer | null>; // Quick lookup by phone

  // Wallet Management
  createWallet(data: CreateWalletRequest): Promise<Wallet>;
  createCustomerWallet?(data: CreateCustomerWalletRequest): Promise<{ customer: Customer; wallet: Wallet }>; // Combined customer+wallet creation
  getWallet(walletId: string): Promise<Wallet>;
  getAllWallets?(): Promise<Wallet[]>; // Get all wallets (merchant operation)
  getWalletsByCustomer(customerId: string): Promise<Wallet[]>;
  getWalletBalance(walletId: string): Promise<Balance>;
  getMerchantWallet?(): Promise<Wallet>; // Get merchant's own wallet

  // Transactions
  initiateTransfer(data: TransferRequest): Promise<Transaction>;
  getTransaction(transactionId: string): Promise<Transaction>;
  getTransactionHistory(walletId: string, options?: PaginationOptions): Promise<PaginatedResult<Transaction>>;

  // Bank Operations
  getBankList(): Promise<Bank[]>;
  validateBankAccount(accountNumber: string, bankCode: string): Promise<BankAccountValidation>;

  // Virtual Cards (if supported)
  createVirtualCard?(data: CreateCardRequest): Promise<VirtualCard>;
  getVirtualCard?(cardId: string): Promise<VirtualCard>;
  fundVirtualCard?(cardId: string, amount: number): Promise<CardFundingResult>;

  // Webhooks (if supported)
  verifyWebhookSignature?(payload: any, signature: string): boolean;
  handleWebhook?(payload: any): Promise<WebhookHandlingResult>;
}

// ============================================================================
// Request/Response Type Definitions
// ============================================================================

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  bvn?: string; // Bank Verification Number (required for Providus wallet creation)
  address?: Address | string; // Can be string or Address object
  kycLevel?: 'basic' | 'intermediate' | 'full';
  metadata?: Record<string, any>;
}

export interface CreateCustomerWalletRequest {
  bvn: string; // Required for Providus
  firstName: string;
  lastName: string;
  dateOfBirth: string; // Required for Providus (YYYY-MM-DD format)
  phoneNumber: string;
  email: string;
  address?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCustomerRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: Address;
  metadata?: Record<string, any>;
}

export interface Customer {
  id: string;
  providerId: string; // ID in the provider's system
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth?: string;
  address?: Address;
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycLevel?: 'basic' | 'intermediate' | 'full';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CreateWalletRequest {
  customerId: string;
  currency: string;
  walletType?: 'savings' | 'current' | 'virtual';
  metadata?: Record<string, any>;
}

export interface Wallet {
  id: string;
  providerId: string; // ID in the provider's system
  customerId: string;
  accountNumber?: string;
  accountName?: string;
  currency: string;
  walletType: 'savings' | 'current' | 'virtual';
  status: 'active' | 'inactive' | 'frozen';
  availableBalance: number;
  ledgerBalance: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface Balance {
  walletId: string;
  currency: string;
  availableBalance: number;
  ledgerBalance: number;
  reservedBalance?: number;
  lastUpdated: string;
}

export interface TransferRequest {
  sourceWalletId: string;
  sourceCustomerId?: string; // Customer ID (used by Providus for transfers)
  destinationType: 'wallet' | 'bank' | 'card';
  destinationId: string; // wallet ID, account number, or card number
  destinationCustomerId?: string; // Customer ID for wallet-to-wallet transfers (Providus)
  amount: number;
  currency: string;
  narration?: string;
  reference?: string; // Client-provided idempotency key
  bankCode?: string; // Bank code (mapped to sortCode for Providus)
  sortCode?: string; // Sort code (Providus uses this instead of bankCode)
  accountNumber?: string; // Required for bank transfers
  accountName?: string;
  metadata?: Record<string, any>;
}

export interface Transaction {
  id: string;
  providerId: string;
  reference: string;
  sourceWalletId: string;
  destinationId: string;
  destinationType: 'wallet' | 'bank' | 'card';
  amount: number;
  currency: string;
  fee: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'reversed';
  narration?: string;
  createdAt: string;
  completedAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

export interface Bank {
  code: string;
  name: string;
  slug?: string;
  country?: string;
}

export interface BankAccountValidation {
  accountNumber: string;
  accountName: string;
  bankCode: string; // Sort code (Providus returns as bankCode)
  bankName?: string;
  isValid: boolean;
}

export interface CreateCardRequest {
  customerId: string;
  walletId: string;
  cardType: 'virtual' | 'physical';
  currency: string;
  spendingLimit?: number;
  metadata?: Record<string, any>;
}

export interface VirtualCard {
  id: string;
  providerId: string;
  customerId: string;
  walletId: string;
  cardNumber: string;
  cardType: 'virtual' | 'physical';
  maskedPan: string;
  expiryMonth: string;
  expiryYear: string;
  cvv?: string; // Only returned on creation
  currency: string;
  balance: number;
  spendingLimit?: number;
  status: 'active' | 'inactive' | 'frozen' | 'expired';
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface CardFundingResult {
  cardId: string;
  amount: number;
  newBalance: number;
  transactionId: string;
  status: 'success' | 'failed';
}

export interface WebhookHandlingResult {
  processed: boolean;
  transactionId?: string;
  error?: string;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country: string;
  postalCode?: string;
}

export interface SearchCriteria {
  phoneNumber?: string;
  email?: string;
  customerId?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
  };
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  useSandbox?: boolean;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public providerResponse?: any
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(message: string, providerResponse?: any) {
    super(message, 'AUTH_ERROR', 401, providerResponse);
    this.name = 'AuthenticationError';
  }
}

export class InsufficientFundsError extends ProviderError {
  constructor(message: string, providerResponse?: any) {
    super(message, 'INSUFFICIENT_FUNDS', 400, providerResponse);
    this.name = 'InsufficientFundsError';
  }
}

export class ValidationError extends ProviderError {
  constructor(message: string, providerResponse?: any) {
    super(message, 'VALIDATION_ERROR', 400, providerResponse);
    this.name = 'ValidationError';
  }
}
