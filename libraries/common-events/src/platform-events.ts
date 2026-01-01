/**
 * Platform Event Definitions
 * Defines all events that flow through the microservices platform
 */

// ============================================================================
// Event Topics
// ============================================================================

export const Topics = {
  // Identity Service events
  IDENTITY: 'platform.identity',

  // Wallet Service events
  WALLET: 'platform.wallet',

  // Transaction Service events
  TRANSACTION: 'platform.transaction',

  // Admin Service events
  ADMIN: 'platform.admin',

  // Cross-service notifications
  NOTIFICATIONS: 'platform.notifications',

  // Audit trail events
  AUDIT: 'platform.audit'
} as const;

// ============================================================================
// Identity Service Events
// ============================================================================

export interface UserRegisteredEvent {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  registrationChannel: 'web' | 'mobile' | 'api';
}

export interface UserLoginEvent {
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
}

export interface KycSubmittedEvent {
  userId: string;
  kycId: string;
  documentType: 'id_card' | 'passport' | 'drivers_license';
  submittedAt: string;
}

export interface KycVerifiedEvent {
  userId: string;
  kycId: string;
  verificationStatus: 'approved' | 'rejected';
  verifiedAt: string;
  rejectionReason?: string;
}

export interface BiometricEnrolledEvent {
  userId: string;
  biometricType: 'fingerprint' | 'face';
  enrolledAt: string;
}

// ============================================================================
// Wallet Service Events
// ============================================================================

export interface WalletCreatedEvent {
  walletId: string;
  userId: string;
  currency: string;
  provider: string;
  accountNumber: string;
  createdAt: string;
}

export interface WalletCreditedEvent {
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  source: 'deposit' | 'transfer' | 'refund' | 'bonus';
  balanceAfter: number;
}

export interface WalletDebitedEvent {
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  destination: 'transfer' | 'payment' | 'fee' | 'withdrawal';
  balanceAfter: number;
}

export interface CardIssuedEvent {
  cardId: string;
  walletId: string;
  userId: string;
  cardType: 'virtual' | 'physical';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface CardBlockedEvent {
  cardId: string;
  userId: string;
  reason: 'lost' | 'stolen' | 'fraud' | 'user_request';
  blockedAt: string;
}

// ============================================================================
// Transaction Service Events
// ============================================================================

export interface TransactionInitiatedEvent {
  transactionId: string;
  referenceNumber: string;
  userId: string;
  transactionType: 'transfer' | 'payment' | 'remittance';
  amount: number;
  currency: string;
  sourceWalletId: string;
  destinationWalletId?: string;
  destinationAccount?: string;
  initiatedAt: string;
}

export interface TransactionCompletedEvent {
  transactionId: string;
  referenceNumber: string;
  userId: string;
  transactionType: string;
  amount: number;
  currency: string;
  feeAmount: number;
  completedAt: string;
  processingTimeMs: number;
}

export interface TransactionFailedEvent {
  transactionId: string;
  referenceNumber: string;
  userId: string;
  transactionType: string;
  amount: number;
  currency: string;
  failureReason: string;
  failureCode: string;
  failedAt: string;
}

export interface TransactionReversedEvent {
  transactionId: string;
  originalTransactionId: string;
  referenceNumber: string;
  userId: string;
  amount: number;
  currency: string;
  reason: string;
  reversedAt: string;
}

// ============================================================================
// Admin Service Events
// ============================================================================

export interface TicketCreatedEvent {
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  category: string;
  priority: string;
  subject: string;
  createdAt: string;
}

export interface TicketAssignedEvent {
  ticketId: string;
  ticketNumber: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: string;
}

export interface TicketResolvedEvent {
  ticketId: string;
  ticketNumber: string;
  customerId: string;
  resolvedBy: string;
  resolution: string;
  resolutionTimeHours: number;
  resolvedAt: string;
}

export interface AdminActionEvent {
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress: string;
  performedAt: string;
}

// ============================================================================
// Event Type Constants
// ============================================================================

export const EventTypes = {
  // Identity
  USER_REGISTERED: 'user.registered',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  KYC_SUBMITTED: 'kyc.submitted',
  KYC_VERIFIED: 'kyc.verified',
  BIOMETRIC_ENROLLED: 'biometric.enrolled',

  // Wallet
  WALLET_CREATED: 'wallet.created',
  WALLET_CREDITED: 'wallet.credited',
  WALLET_DEBITED: 'wallet.debited',
  CARD_ISSUED: 'card.issued',
  CARD_BLOCKED: 'card.blocked',

  // Transaction
  TRANSACTION_INITIATED: 'transaction.initiated',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  TRANSACTION_REVERSED: 'transaction.reversed',

  // Admin
  TICKET_CREATED: 'ticket.created',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_RESOLVED: 'ticket.resolved',
  ADMIN_ACTION: 'admin.action'
} as const;

// ============================================================================
// Event Mapping Type
// ============================================================================

export type EventMap = {
  [EventTypes.USER_REGISTERED]: UserRegisteredEvent;
  [EventTypes.USER_LOGIN]: UserLoginEvent;
  [EventTypes.KYC_SUBMITTED]: KycSubmittedEvent;
  [EventTypes.KYC_VERIFIED]: KycVerifiedEvent;
  [EventTypes.BIOMETRIC_ENROLLED]: BiometricEnrolledEvent;
  [EventTypes.WALLET_CREATED]: WalletCreatedEvent;
  [EventTypes.WALLET_CREDITED]: WalletCreditedEvent;
  [EventTypes.WALLET_DEBITED]: WalletDebitedEvent;
  [EventTypes.CARD_ISSUED]: CardIssuedEvent;
  [EventTypes.CARD_BLOCKED]: CardBlockedEvent;
  [EventTypes.TRANSACTION_INITIATED]: TransactionInitiatedEvent;
  [EventTypes.TRANSACTION_COMPLETED]: TransactionCompletedEvent;
  [EventTypes.TRANSACTION_FAILED]: TransactionFailedEvent;
  [EventTypes.TRANSACTION_REVERSED]: TransactionReversedEvent;
  [EventTypes.TICKET_CREATED]: TicketCreatedEvent;
  [EventTypes.TICKET_ASSIGNED]: TicketAssignedEvent;
  [EventTypes.TICKET_RESOLVED]: TicketResolvedEvent;
  [EventTypes.ADMIN_ACTION]: AdminActionEvent;
};
