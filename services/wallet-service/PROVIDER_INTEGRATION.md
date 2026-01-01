# Wallet Provider Integration Guide

This guide explains how to integrate new wallet providers into the Wallet Service.

## Architecture Overview

The Wallet Service uses a **Provider Abstraction Pattern** to support multiple wallet providers (Providus, Flutterwave, Paystack, etc.) without changing the core business logic.

```
┌─────────────────────────────────────────────────────────────┐
│                    Wallet Service API                        │
│              (Provider-Agnostic Endpoints)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   WalletService Layer                        │
│              (Business Logic & Orchestration)                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Provider Factory                             │
│          (Creates provider instances)                        │
└─────┬──────────┬──────────┬──────────┬───────────────────────┘
      │          │          │          │
┌─────▼───┐ ┌───▼─────┐ ┌──▼──────┐ ┌▼────────┐
│Providus │ │Flutterwave│ │Paystack│ │Custom  │
│Provider │ │Provider  │ │Provider │ │Provider│
└─────────┘ └──────────┘ └─────────┘ └─────────┘
     │            │            │          │
     ▼            ▼            ▼          ▼
  Providus    Flutterwave  Paystack   Your API
   Bank API      API          API
```

## Currently Supported Providers

1. **Providus Bank (Xpress Wallet)** ✅ Fully Implemented
   - Base URL: https://api.xpresswallet.com (sandbox/production)
   - Authentication: X-Access-Token / X-Refresh-Token
   - Endpoint: `/auth/login` (POST), `/auth/refresh/token` (POST)
   - **Key Features:**
     - Combined customer+wallet creation (`POST /wallet`)
     - Customer-to-customer wallet transfers (uses customerId, not walletId)
     - Bank transfers use `sortCode` (not `bankCode`)
     - Bank validation via `GET /transfer/account/details`
     - Merchant wallet operations
   - [Documentation](https://developer.providusbank.com/xpress-wallet-api)
   - **Important Notes:**
     - Transfers require `customerId`, not `walletId`
     - Bank operations use `sortCode` (same as bankCode, different name)
     - BVN and dateOfBirth required for wallet creation
     - Combined `createCustomerWallet()` is more efficient than separate calls

2. **Flutterwave** ⏳ Planned
3. **Paystack** ⏳ Planned
4. **Stripe** ⏳ Planned

## Adding a New Provider

### Step 1: Implement the IWalletProvider Interface

Create a new provider class in `src/providers/[provider-name]/[Provider]Provider.ts`:

```typescript
import { BaseProvider } from '../BaseProvider';
import { IWalletProvider, /* other types */ } from '../IWalletProvider';

export class FlutterwaveProvider extends BaseProvider implements IWalletProvider {
  readonly name = 'flutterwave';
  readonly version = '1.0.0';

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig(['secretKey']); // Validate required config
  }

  async initialize(): Promise<void> {
    await this.authenticate();
  }

  async authenticate(): Promise<AuthResult> {
    // Implement authentication logic
    // Store access token in this.accessToken
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    // Implement customer creation
  }

  async createWallet(data: CreateWalletRequest): Promise<Wallet> {
    // Implement wallet creation
  }

  async getWalletBalance(walletId: string): Promise<Balance> {
    // Implement balance inquiry
  }

  async initiateTransfer(data: TransferRequest): Promise<Transaction> {
    // Implement transfer logic
  }

  // Implement all other required methods...
}
```

### Step 2: Register Provider in Factory

Update `src/providers/ProviderFactory.ts`:

```typescript
// In createProvider method, add new case:
case 'flutterwave':
  return new FlutterwaveProvider(config);

// In getProviderConfigFromEnv, add configuration:
case 'flutterwave': {
  return {
    name: 'flutterwave',
    baseUrl: 'https://api.flutterwave.com/v3',
    apiKey: process.env.FLUTTERWAVE_SECRET_KEY,
    timeout: 30000,
    retries: 3,
  };
}

// In getAvailableProviders, add to list:
return [
  'providus',
  'flutterwave', // Add here
];
```

### Step 3: Add Environment Configuration

Update `.env.example`:

```bash
# Flutterwave Configuration
FLUTTERWAVE_PUBLIC_KEY=your-public-key
FLUTTERWAVE_SECRET_KEY=your-secret-key
FLUTTERWAVE_ENCRYPTION_KEY=your-encryption-key
```

### Step 4: Update Docker Compose

Add environment variables to `docker-compose.yml`:

```yaml
wallet-service:
  environment:
    # ... existing config
    FLUTTERWAVE_SECRET_KEY: ${FLUTTERWAVE_SECRET_KEY:-your-secret-key}
```

## IWalletProvider Interface Methods

All providers **must** implement these methods:

### Required Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize()` | Initialize provider (auth, setup) | `Promise<void>` |
| `authenticate()` | Authenticate with provider API | `Promise<AuthResult>` |
| `refreshToken()` | Refresh authentication token | `Promise<AuthResult>` |
| `createCustomer()` | Create customer account | `Promise<Customer>` |
| `getCustomer()` | Get customer details | `Promise<Customer>` |
| `updateCustomer()` | Update customer info | `Promise<Customer>` |
| `searchCustomer()` | Search for customers | `Promise<Customer[]>` |
| `createWallet()` | Create new wallet | `Promise<Wallet>` |
| `getWallet()` | Get wallet details | `Promise<Wallet>` |
| `getWalletsByCustomer()` | List customer's wallets | `Promise<Wallet[]>` |
| `getWalletBalance()` | Get wallet balance | `Promise<Balance>` |
| `initiateTransfer()` | Start money transfer | `Promise<Transaction>` |
| `getTransaction()` | Get transaction details | `Promise<Transaction>` |
| `getTransactionHistory()` | Get transaction list | `Promise<PaginatedResult<Transaction>>` |
| `getBankList()` | Get supported banks | `Promise<Bank[]>` |
| `validateBankAccount()` | Validate bank account | `Promise<BankAccountValidation>` |

### Optional Methods (Provider-Specific)

| Method | Description | Returns | Provider Support |
|--------|-------------|---------|------------------|
| `createCustomerWallet()` | Create customer + wallet in one call | `Promise<{customer: Customer, wallet: Wallet}>` | ✅ Providus |
| `findCustomerByPhone()` | Quick lookup by phone number | `Promise<Customer \| null>` | ✅ Providus |
| `getAllWallets()` | Get all customer wallets (merchant op) | `Promise<Wallet[]>` | ✅ Providus |
| `getMerchantWallet()` | Get merchant's own wallet | `Promise<Wallet>` | ✅ Providus |
| `createVirtualCard()` | Create virtual card | `Promise<VirtualCard>` | ⏳ Planned |
| `getVirtualCard()` | Get card details | `Promise<VirtualCard>` | ⏳ Planned |
| `fundVirtualCard()` | Fund card balance | `Promise<CardFundingResult>` | ⏳ Planned |
| `verifyWebhookSignature()` | Verify webhook signature | `boolean` | ⏳ Planned |
| `handleWebhook()` | Process webhook payload | `Promise<WebhookHandlingResult>` | ⏳ Planned |

## BaseProvider Utilities

The `BaseProvider` class provides common functionality:

### HTTP Client

```typescript
// Make authenticated requests
const response = await this.request<ResponseType>({
  method: 'POST',
  url: '/endpoint',
  data: { key: 'value' }
});
```

### Token Management

```typescript
// Check if token is expired
if (this.isTokenExpired()) {
  await this.refreshToken();
}

// Set token expiry
this.setTokenExpiry(expiresIn); // seconds
```

### Error Handling

```typescript
// Errors are automatically converted to ProviderError
throw new ProviderError('Message', 'ERROR_CODE', 400, responseData);
```

### Retry Logic

```typescript
// Built-in exponential backoff retry for 5xx errors
// Configure via:
config.retries = 3; // Default
```

## Testing Your Provider

### Unit Tests

Create tests in `src/providers/[provider]/__tests__/[Provider]Provider.test.ts`:

```typescript
import { FlutterwaveProvider } from '../FlutterwaveProvider';

describe('FlutterwaveProvider', () => {
  let provider: FlutterwaveProvider;

  beforeEach(() => {
    provider = new FlutterwaveProvider({
      name: 'flutterwave',
      baseUrl: 'https://api.flutterwave.com/v3',
      apiKey: 'test-key',
    });
  });

  it('should authenticate successfully', async () => {
    const result = await provider.authenticate();
    expect(result.accessToken).toBeDefined();
  });

  // Add more tests...
});
```

### Integration Tests

Test against provider's sandbox environment:

```bash
FLUTTERWAVE_SECRET_KEY=test_key npm run test:integration
```

## Configuration

### Provider Selection

Users can specify which provider to use:

```typescript
// Per-request provider selection
POST /api/v1/wallets
{
  "customerId": "uuid",
  "provider": "flutterwave" // Optional, defaults to DEFAULT_WALLET_PROVIDER
}
```

### Default Provider

Set via environment variable:

```bash
DEFAULT_WALLET_PROVIDER=flutterwave
```

## Error Handling

All providers should use these error types:

```typescript
import {
  ProviderError,           // Generic provider error
  AuthenticationError,     // Auth failures
  InsufficientFundsError,  // Not enough balance
  ValidationError,         // Invalid input
} from '../IWalletProvider';

// Example:
if (balance < amount) {
  throw new InsufficientFundsError('Insufficient funds');
}
```

## Best Practices

### 1. Token Caching

```typescript
// Cache tokens to avoid unnecessary auth calls
if (!this.accessToken || this.isTokenExpired()) {
  await this.authenticate();
}
```

### 2. Idempotency

```typescript
// Use client-provided reference or generate one
const reference = data.reference || this.generateReference('FLW');
```

### 3. Response Mapping

```typescript
// Always map provider responses to standard format
private mapCustomerResponse(data: any): Customer {
  return {
    id: data.id,
    providerId: data.customer_id, // Provider's ID
    firstName: data.first_name,
    // ... map all fields
  };
}
```

### 4. Provider-Specific Field Mapping

Some providers use different field names. Always map to standard format:

```typescript
// Example: Providus uses "sortCode" but we accept "bankCode"
const sortCode = data.sortCode || data.bankCode; // Map for Providus

// Example: Providus requires customerId for transfers, not walletId
// WalletService handles this lookup automatically
```

### 5. Logging

```typescript
logger.info('[Flutterwave] Operation successful', { customerId });
logger.error('[Flutterwave] Operation failed:', error);
```

### 6. Configuration Validation

```typescript
constructor(config: ProviderConfig) {
  super(config);
  this.validateConfig(['secretKey', 'publicKey']);
}
```

### 7. Customer ID Lookups

For providers that require customerId (like Providus), WalletService automatically:
- Looks up customerId from walletId
- Passes both walletId and customerId to provider
- Handles the mapping transparently

## Example: Complete Provider Implementation

See `src/providers/providus/ProvidusProvider.ts` for a complete reference implementation.

### Providus-Specific Implementation Notes

1. **Authentication Endpoints:**
   - Login: `POST /auth/login` (with clientId/clientSecret)
   - Refresh: `POST /auth/refresh/token` (with X-Refresh-Token header)

2. **Customer + Wallet Creation:**
   ```typescript
   // Recommended: Combined endpoint (more efficient)
   await provider.createCustomerWallet({
     bvn: "22181029322",
     firstName: "First",
     lastName: "User",
     dateOfBirth: "1992-05-16", // Required, YYYY-MM-DD format
     phoneNumber: "08020245368",
     email: "user@example.com",
     address: "No 10, Street Name",
     metadata: {}
   });
   ```

3. **Transfers:**
   ```typescript
   // Wallet-to-wallet: Uses customerId (not walletId)
   await provider.initiateTransfer({
     sourceWalletId: "wallet-id",
     sourceCustomerId: "customer-id", // Required!
     destinationType: "wallet",
     destinationCustomerId: "dest-customer-id", // Required!
     amount: 200,
     currency: "NGN"
   });

   // Bank transfer: Uses sortCode (not bankCode)
   await provider.initiateTransfer({
     sourceWalletId: "wallet-id",
     sourceCustomerId: "customer-id", // Required!
     destinationType: "bank",
     sortCode: "000013", // Providus uses sortCode
     accountNumber: "0167421242",
     accountName: "Account Name",
     amount: 100,
     currency: "NGN"
   });
   ```

4. **Bank Operations:**
   ```typescript
   // Get bank list: GET /transfer/banks (not /banks)
   const banks = await provider.getBankList();

   // Validate account: GET /transfer/account/details (not POST /banks/validate-account)
   const validation = await provider.validateBankAccount(
     "0167421242", // accountNumber
     "000013"      // bankCode (used as sortCode)
   );
   ```

## Webhooks

If your provider supports webhooks:

```typescript
async handleWebhook(payload: any): Promise<WebhookHandlingResult> {
  // 1. Verify signature
  if (!this.verifyWebhookSignature(payload, signature)) {
    throw new Error('Invalid signature');
  }

  // 2. Process event
  if (payload.event === 'transaction.success') {
    // Update transaction status in database
  }

  return { processed: true };
}
```

## Support

For questions or issues:
- Check existing provider implementations
- Review the `IWalletProvider` interface documentation
- Contact the platform team

## Resources

- [Providus Bank API Docs](https://developer.providusbank.com/xpress-wallet-api)
- [Flutterwave API Docs](https://developer.flutterwave.com/)
- [Paystack API Docs](https://paystack.com/docs/api/)
