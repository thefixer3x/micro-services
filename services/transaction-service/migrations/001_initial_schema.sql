-- Transaction Service Initial Schema
-- Version: 001
-- Description: Create initial tables for transaction processing and reconciliation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Types
CREATE TYPE transaction_type AS ENUM ('transfer', 'deposit', 'withdrawal', 'refund', 'reversal');
CREATE TYPE transaction_status AS ENUM ('initiated', 'pending', 'processing', 'completed', 'failed', 'reversed');
CREATE TYPE transaction_direction AS ENUM ('inbound', 'outbound', 'internal');

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference VARCHAR(255) UNIQUE NOT NULL,
    external_reference VARCHAR(255),
    transaction_type transaction_type NOT NULL,
    direction transaction_direction NOT NULL,
    source_wallet_id UUID,
    destination_wallet_id UUID,
    source_account VARCHAR(50),
    destination_account VARCHAR(50),
    amount DECIMAL(20, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'NGN',
    fee DECIMAL(20, 4) DEFAULT 0,
    total_amount DECIMAL(20, 4) NOT NULL,
    status transaction_status DEFAULT 'initiated',
    narration TEXT,
    metadata JSONB,
    user_id UUID,
    provider VARCHAR(50),
    failure_reason TEXT,
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Transaction Logs table (for audit trail)
CREATE TABLE IF NOT EXISTS transaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    status transaction_status NOT NULL,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Transaction Reconciliation table
CREATE TABLE IF NOT EXISTS transaction_reconciliations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(255) NOT NULL,
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    provider VARCHAR(50) NOT NULL,
    provider_reference VARCHAR(255),
    our_amount DECIMAL(20, 4),
    provider_amount DECIMAL(20, 4),
    discrepancy DECIMAL(20, 4),
    status VARCHAR(50) DEFAULT 'pending',
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Webhooks table (for incoming provider webhooks)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) UNIQUE,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_external_reference ON transactions(external_reference);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_source_wallet ON transactions(source_wallet_id);
CREATE INDEX idx_transactions_destination_wallet ON transactions(destination_wallet_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_reconciled ON transactions(reconciled);
CREATE INDEX idx_transaction_logs_transaction_id ON transaction_logs(transaction_id);
CREATE INDEX idx_transaction_logs_created_at ON transaction_logs(created_at DESC);
CREATE INDEX idx_reconciliations_transaction_id ON transaction_reconciliations(transaction_id);
CREATE INDEX idx_reconciliations_batch_id ON transaction_reconciliations(batch_id);
CREATE INDEX idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reconciliations_updated_at BEFORE UPDATE ON transaction_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name) 
VALUES ('001', 'initial_schema')
ON CONFLICT (version) DO NOTHING;
