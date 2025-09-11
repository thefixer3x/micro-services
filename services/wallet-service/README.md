# Wallet Service

## 🎯 Purpose
The Wallet Service manages digital wallets, balances, and virtual cards for users. It provides multi-currency support and real-time balance management.

## 🔑 Key Responsibilities
- Wallet creation and management
- Multi-currency balance tracking
- Virtual card issuance
- Statement generation
- Balance inquiries and updates
- Transaction history (read-only)

## 🏗️ Architecture

### Database Schema
```sql
-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    wallet_type ENUM('personal', 'business', 'savings'),
    status ENUM('active', 'frozen', 'closed'),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet Balances
CREATE TABLE wallet_balances (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    currency_code VARCHAR(3),
    available_balance DECIMAL(20,4),
    ledger_balance DECIMAL(20,4),
    reserved_balance DECIMAL(20,4),
    last_updated TIMESTAMP DEFAULT NOW(),
    UNIQUE(wallet_id, currency_code)
);

-- Virtual Cards
CREATE TABLE virtual_cards (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    card_number VARCHAR(16),
    card_type ENUM('debit', 'prepaid'),
    currency_code VARCHAR(3),
    spending_limit DECIMAL(20,4),
    status ENUM('active', 'frozen', 'expired'),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Balance History (for statements)
CREATE TABLE balance_history (
    id UUID PRIMARY KEY,
    wallet_id UUID REFERENCES wallets(id),
    currency_code VARCHAR(3),
    balance_snapshot DECIMAL(20,4),
    snapshot_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
- `POST /api/v1/wallets` - Create new wallet
- `GET /api/v1/wallets` - List user's wallets
- `GET /api/v1/wallets/{walletId}` - Get wallet details
- `PUT /api/v1/wallets/{walletId}/status` - Update wallet status
- `GET /api/v1/wallets/{walletId}/balance` - Get wallet balance
- `POST /api/v1/wallets/{walletId}/reserve` - Reserve funds
- `POST /api/v1/wallets/{walletId}/release` - Release reserved funds
- `POST /api/v1/cards/virtual` - Create virtual card
- `GET /api/v1/cards` - List user's cards
- `PUT /api/v1/cards/{cardId}/status` - Freeze/unfreeze card
- `GET /api/v1/statements/{walletId}` - Generate statement

### Events Published
- `WalletCreated` - When new wallet is created
- `BalanceUpdated` - When balance changes
- `CardIssued` - When virtual card is created
- `CardStatusChanged` - When card is frozen/unfrozen

### Events Consumed
- `UserRegistered` - Create default wallet for new users
- `TransactionCompleted` - Update wallet balance

## 🔗 Dependencies
- **External Services**:
  - Card issuing partner API
  - Currency exchange rate API

- **Internal Services**:
  - Identity Service (user validation)

## 🚀 Running the Service

### Development
```bash
cd services/wallet-service
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
docker build -t wallet-service:latest .
docker run -p 3002:3002 wallet-service:latest
```

## 📊 Monitoring
- Health check: `GET /health`
- Metrics: `GET /metrics`
- Key metrics:
  - Wallet creation rate
  - Active wallets count
  - Total balance by currency
  - Card issuance rate

## 🔒 Security
- All API calls require valid JWT from Identity Service
- Balance updates use database transactions
- Card numbers encrypted at rest
- PCI compliance for card data
