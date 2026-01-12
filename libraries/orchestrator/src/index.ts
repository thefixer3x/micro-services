/**
 * Orchestrator Library
 *
 * Provides provider routing, idempotency, and event emission
 * for the unified services platform.
 */

export { ProviderRouter } from './router';
export { IdempotencyManager, IdempotencyError } from './idempotency';
export { EventEmitter } from './events';

// Re-export types
export type {
  ProviderType,
  Currency,
  TransactionStatus,
  WalletProvider,
  PaymentGatewayProvider,
  CardIssuerProvider,
  VerificationProvider,
  TransferProvider,
  ProviderConfig,
  ProviderResult,
  ProviderError,
} from '@shared/types/providers';
