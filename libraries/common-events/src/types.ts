/**
 * Base event interface
 */
export interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
  source: string;
}

/**
 * Event payload interface
 */
export interface EventPayload<T = any> extends BaseEvent {
  data: T;
  metadata?: Record<string, any>;
}

// ============================================================================
// Identity Service Events
// ============================================================================

export interface UserRegisteredData {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface UserVerifiedData {
  userId: string;
  verificationType: 'email' | 'phone' | 'kyc';
}

export interface UserUpdatedData {
  userId: string;
  changes: Record<string, any>;
}

// ============================================================================
// Wallet Service Events
// ============================================================================

export interface WalletCreatedData {
  walletId: string;
  customerId: string;
  provider: string;
  currency: string;
  walletType: string;
}

export interface BalanceUpdatedData {
  walletId: string;
  previousBalance: number;
  newBalance: number;
  changeAmount: number;
  currency: string;
  reason: string;
}

export interface CardIssuedData {
  cardId: string;
  customerId: string;
  walletId: string;
  cardType: string;
  maskedPan: string;
}

// ============================================================================
// Transaction Service Events
// ============================================================================

export interface TransactionInitiatedData {
  transactionId: string;
  sourceWalletId: string;
  destinationId: string;
  amount: number;
  currency: string;
  transactionType: string;
}

export interface TransactionCompletedData {
  transactionId: string;
  status: 'completed' | 'failed';
  finalAmount: number;
  fee: number;
  completedAt: string;
}

export interface SettlementCompletedData {
  settlementId: string;
  transactionIds: string[];
  totalAmount: number;
  currency: string;
  partner: string;
}

// ============================================================================
// Admin Service Events
// ============================================================================

export interface TicketCreatedData {
  ticketId: string;
  customerId: string;
  category: string;
  priority: string;
  subject: string;
}

export interface AdminActionData {
  adminUserId: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, any>;
}

// ============================================================================
// Event Type Constants
// ============================================================================

export const EventTypes = {
  // Identity Service
  USER_REGISTERED: 'identity.user.registered',
  USER_VERIFIED: 'identity.user.verified',
  USER_UPDATED: 'identity.user.updated',

  // Wallet Service
  WALLET_CREATED: 'wallet.created',
  BALANCE_UPDATED: 'wallet.balance.updated',
  CARD_ISSUED: 'wallet.card.issued',

  // Transaction Service
  TRANSACTION_INITIATED: 'transaction.initiated',
  TRANSACTION_COMPLETED: 'transaction.completed',
  SETTLEMENT_COMPLETED: 'transaction.settlement.completed',

  // Admin Service
  TICKET_CREATED: 'admin.ticket.created',
  ADMIN_ACTION: 'admin.action',
} as const;

export type EventType = typeof EventTypes[keyof typeof EventTypes];
