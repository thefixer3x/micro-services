-- Wallet Service Database Schema

-- Enum types
CREATE TYPE wallet_provider AS ENUM ('providus', 'flutterwave', 'paystack', 'stripe');
CREATE TYPE wallet_type AS ENUM ('savings', 'current', 'virtual');
CREATE TYPE wallet_status AS ENUM ('active', 'inactive', 'frozen', 'closed');
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');
CREATE TYPE transaction_type AS ENUM ('transfer', 'deposit', 'withdrawal', 'fee');
CREATE TYPE destination_type AS ENUM ('wallet', 'bank', 'card');

-- Customers table (local cache of customer data)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    provider_customer_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL, -- Reference to identity service user
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    kyc_status VARCHAR(50) DEFAULT 'pending',
    kyc_level VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_customer_id),
    UNIQUE(provider, user_id)
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider wallet_provider NOT NULL,
    provider_wallet_id VARCHAR(255) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    account_number VARCHAR(50),
    account_name VARCHAR(255),
    currency VARCHAR(3) DEFAULT 'NGN',
    wallet_type wallet_type DEFAULT 'virtual',
    status wallet_status DEFAULT 'active',
    available_balance DECIMAL(20, 4) DEFAULT 0,
    ledger_balance DECIMAL(20, 4) DEFAULT 0,
    reserved_balance DECIMAL(20, 4) DEFAULT 0,
    last_balance_update TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_wallet_id),
    CHECK (available_balance >= 0),
    CHECK (ledger_balance >= 0)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider wallet_provider NOT NULL,
    provider_transaction_id VARCHAR(255),
    reference VARCHAR(255) UNIQUE NOT NULL,
    source_wallet_id UUID REFERENCES wallets(id),
    destination_type destination_type NOT NULL,
    destination_id VARCHAR(255) NOT NULL,
    destination_name VARCHAR(255),
    amount DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'NGN',
    fee DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) NOT NULL,
    status transaction_status DEFAULT 'pending',
    transaction_type transaction_type DEFAULT 'transfer',
    narration TEXT,
    bank_code VARCHAR(10),
    account_number VARCHAR(50),
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    CHECK (amount > 0)
);

-- Virtual Cards table
CREATE TABLE IF NOT EXISTS virtual_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider wallet_provider NOT NULL,
    provider_card_id VARCHAR(255) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    masked_pan VARCHAR(20) NOT NULL,
    card_type VARCHAR(20) DEFAULT 'virtual',
    currency VARCHAR(3) DEFAULT 'NGN',
    balance DECIMAL(20, 4) DEFAULT 0,
    spending_limit DECIMAL(20, 4),
    status VARCHAR(50) DEFAULT 'active',
    expiry_month VARCHAR(2),
    expiry_year VARCHAR(4),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, provider_card_id)
);

-- Provider Credentials table (encrypted storage for API keys)
CREATE TABLE IF NOT EXISTS provider_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider wallet_provider NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    api_key_encrypted TEXT,
    client_id_encrypted TEXT,
    client_secret_encrypted TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Balance History table (for auditing)
CREATE TABLE IF NOT EXISTS balance_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    previous_balance DECIMAL(20, 4),
    new_balance DECIMAL(20, 4),
    change_amount DECIMAL(20, 4),
    change_type VARCHAR(50),
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_provider ON customers(provider, provider_customer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_customer_id ON wallets(customer_id);
CREATE INDEX IF NOT EXISTS idx_wallets_provider ON wallets(provider, provider_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(source_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_virtual_cards_wallet_id ON virtual_cards(wallet_id);
CREATE INDEX IF NOT EXISTS idx_virtual_cards_customer_id ON virtual_cards(customer_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_virtual_cards_updated_at BEFORE UPDATE ON virtual_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
