export enum TransactionType {
  TRANSFER = 'transfer',
  PAYMENT = 'payment',
  REMITTANCE = 'remittance',
  SETTLEMENT = 'settlement'
}

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
  CANCELLED = 'cancelled'
}

export enum RouteType {
  DIRECT = 'direct',
  SWIFT = 'swift',
  CORRESPONDENT = 'correspondent',
  LOCAL = 'local'
}

export enum SettlementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  DISPUTED = 'disputed'
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  transactionType: TransactionType;
  sourceWalletId: string;
  destinationWalletId?: string;
  destinationAccountNumber?: string;
  destinationBankCode?: string;
  amount: number;
  currencyCode: string;
  exchangeRate?: number;
  feeAmount: number;
  status: TransactionStatus;
  narration?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TransactionRoute {
  id: string;
  transactionId: string;
  routeType: RouteType;
  partnerId: string;
  partnerReference?: string;
  status: string;
  createdAt: Date;
}

export interface Settlement {
  id: string;
  settlementDate: Date;
  partnerId: string;
  currencyCode: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  transactionCount: number;
  status: SettlementStatus;
  createdAt: Date;
}

export interface TransactionFee {
  id: string;
  transactionId: string;
  feeType: string;
  feeAmount: number;
  feeCurrency: string;
  appliedAt: Date;
}

export interface CreateTransferRequest {
  sourceWalletId: string;
  destinationWalletId?: string;
  destinationAccountNumber?: string;
  destinationBankCode?: string;
  amount: number;
  currencyCode: string;
  narration?: string;
  idempotencyKey?: string;
}

export interface TransferResponse {
  transaction: Transaction;
  fees: TransactionFee[];
  estimatedCompletionTime?: string;
}

export interface FeeCalculationRequest {
  transactionType: TransactionType;
  amount: number;
  sourceCurrency: string;
  destinationCurrency?: string;
  isInternational?: boolean;
}

export interface FeeCalculationResponse {
  baseFee: number;
  percentageFee: number;
  totalFee: number;
  feeCurrency: string;
  breakdown: {
    type: string;
    amount: number;
    description: string;
  }[];
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  inverseRate: number;
  timestamp: Date;
  source: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
