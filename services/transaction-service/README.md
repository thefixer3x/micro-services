# Transaction Service

## 🎯 Purpose
The Transaction Service handles all payment processing, money transfers, and settlement operations. It ensures accurate, secure, and traceable financial transactions.

## 🔑 Key Responsibilities
- Process domestic transfers
- Handle international remittances
- Execute payments
- Manage settlements
- Transaction validation and routing
- Fee calculation
- Transaction status tracking

## 🏗️ Architecture

### Database Schema
```sql
-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    reference_number VARCHAR(50) UNIQUE,
    transaction_type ENUM('transfer', 'payment', 'remittance', 'settlement'),
    source_wallet_id UUID,
    destination_wallet_id UUID,
    amount DECIMAL(20,4),
    currency_code VARCHAR(3),
    exchange_rate DECIMAL(10,6),
    fee_amount DECIMAL(20,4),
    status ENUM('pending', 'processing', 'completed', 'failed', 'reversed'),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);

-- Transaction Routes
CREATE TABLE transaction_routes (
    id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id),
    route_type ENUM('direct', 'swift', 'correspondent', 'local'),
    partner_id VARCHAR(100),
    partner_reference VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Settlement Records
CREATE TABLE settlements (
    id UUID PRIMARY KEY,
    settlement_date DATE,
    partner_id VARCHAR(100),
    currency_code VARCHAR(3),
    gross_amount DECIMAL(20,4),
    fee_amount DECIMAL(20,4),
    net_amount DECIMAL(20,4),
    transaction_count INTEGER,
    status ENUM('pending', 'processing', 'completed', 'disputed'),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transaction Fees
CREATE TABLE transaction_fees (
    id UUID PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id),
    fee_type VARCHAR(50),
    fee_amount DECIMAL(20,4),
    fee_currency VARCHAR(3),
    applied_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
- `POST /api/v1/transfers/domestic` - Initiate domestic transfer
- `POST /api/v1/transfers/international` - Initiate international transfer
- `GET /api/v1/transactions/{transactionId}` - Get transaction details
- `GET /api/v1/transactions` - List user transactions
- `POST /api/v1/transactions/{transactionId}/cancel` - Cancel pending transaction
- `POST /api/v1/transactions/validate` - Validate transaction details
- `GET /api/v1/transactions/fees` - Calculate transaction fees
- `GET /api/v1/settlements` - List settlements (admin)
- `POST /api/v1/settlements/process` - Process settlement batch (admin)
- `GET /api/v1/exchange-rates` - Get current exchange rates

### Events Published
- `TransactionInitiated` - When transaction starts
- `TransactionCompleted` - When transaction succeeds
- `TransactionFailed` - When transaction fails
- `SettlementCompleted` - When settlement is done

### Events Consumed
- `WalletCreated` - Enable transactions for new wallets
- `CardTransaction` - Process card payments

## 🔗 Dependencies
- **External Services**:
  - Payment gateway APIs
  - SWIFT network
  - Banking partner APIs
  - Exchange rate providers

- **Internal Services**:
  - Identity Service (user validation)
  - Wallet Service (balance checks and updates)

## 🚀 Running the Service

### Development
```bash
cd services/transaction-service
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:integration
```

### Docker
```bash
docker build -t transaction-service:latest .
docker run -p 3003:3003 transaction-service:latest
```

## 📊 Monitoring
- Health check: `GET /health`
- Metrics: `GET /metrics`
- Key metrics:
  - Transaction volume by type
  - Success/failure rates
  - Average processing time
  - Settlement lag time
  - Fee revenue

## 🔒 Security
- Transaction signing with HMAC
- Idempotency keys to prevent duplicates
- Rate limiting per user
- Fraud detection rules
- Transaction limits enforcement
- End-to-end encryption for sensitive data
