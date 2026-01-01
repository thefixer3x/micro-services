-- Transaction Service Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE transaction_type AS ENUM ('transfer', 'payment', 'remittance', 'settlement');
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled');
CREATE TYPE route_type AS ENUM ('direct', 'swift', 'correspondent', 'local');
CREATE TYPE settlement_status AS ENUM ('pending', 'processing', 'completed', 'disputed');

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    transaction_type transaction_type NOT NULL,
    source_wallet_id UUID NOT NULL,
    destination_wallet_id UUID,
    destination_account_number VARCHAR(50),
    destination_bank_code VARCHAR(20),
    amount DECIMAL(20,4) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(10,6),
    fee_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    status transaction_status NOT NULL DEFAULT 'pending',
    narration TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Transaction Routes (for tracking routing through partners)
CREATE TABLE transaction_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    route_type route_type NOT NULL,
    partner_id VARCHAR(100) NOT NULL,
    partner_reference VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'initiated',
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settlement Records
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_date DATE NOT NULL,
    partner_id VARCHAR(100) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    gross_amount DECIMAL(20,4) NOT NULL,
    fee_amount DECIMAL(20,4) NOT NULL DEFAULT 0,
    net_amount DECIMAL(20,4) NOT NULL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    status settlement_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(settlement_date, partner_id, currency_code)
);

-- Transaction Fees
CREATE TABLE transaction_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL,
    fee_amount DECIMAL(20,4) NOT NULL,
    fee_currency VARCHAR(3) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchange Rate Cache
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(18,8) NOT NULL,
    inverse_rate DECIMAL(18,8) NOT NULL,
    source VARCHAR(100) NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(from_currency, to_currency, source)
);

-- Indexes for performance
CREATE INDEX idx_transactions_source_wallet ON transactions(source_wallet_id);
CREATE INDEX idx_transactions_destination_wallet ON transactions(destination_wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);

CREATE INDEX idx_transaction_routes_transaction ON transaction_routes(transaction_id);
CREATE INDEX idx_transaction_routes_partner ON transaction_routes(partner_id);

CREATE INDEX idx_settlements_date ON settlements(settlement_date DESC);
CREATE INDEX idx_settlements_partner ON settlements(partner_id);
CREATE INDEX idx_settlements_status ON settlements(status);

CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_expires ON exchange_rates(expires_at);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_routes_updated_at
    BEFORE UPDATE ON transaction_routes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlements_updated_at
    BEFORE UPDATE ON settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
