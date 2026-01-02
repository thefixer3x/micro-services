-- Transaction Service Settlements & Refunds Migration
-- Version: 004
-- Description: Settlement batches and refund management

-- Settlement batches table
CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference VARCHAR(50) NOT NULL UNIQUE,
    settlement_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'partial'
    total_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    total_fees DECIMAL(18, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'NGN',
    bank_reference VARCHAR(100),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by VARCHAR(255),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Settlement items (transactions in a batch)
CREATE TABLE IF NOT EXISTS settlement_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES settlement_batches(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    amount DECIMAL(18, 2) NOT NULL,
    fee_amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
    net_amount DECIMAL(18, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'settled', 'failed'
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, transaction_id)
);

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_reference VARCHAR(50) NOT NULL UNIQUE,
    original_transaction_id UUID NOT NULL REFERENCES transactions(id),
    refund_transaction_id UUID REFERENCES transactions(id),
    wallet_id UUID NOT NULL,
    amount DECIMAL(18, 2) NOT NULL,
    fee_refund DECIMAL(18, 2) NOT NULL DEFAULT 0,
    total_refund DECIMAL(18, 2) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    reason_code VARCHAR(50), -- 'duplicate', 'fraud', 'customer_request', 'merchant_error', 'other'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'processing', 'completed', 'rejected', 'failed'
    requested_by UUID NOT NULL,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    bank_reference VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refund approval workflow
CREATE TABLE IF NOT EXISTS refund_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refund_id UUID NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'approve', 'reject', 'escalate'
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_settlement_batches_status ON settlement_batches(status);
CREATE INDEX idx_settlement_batches_date ON settlement_batches(settlement_date);
CREATE INDEX idx_settlement_items_batch ON settlement_items(batch_id);
CREATE INDEX idx_settlement_items_transaction ON settlement_items(transaction_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_wallet ON refunds(wallet_id);
CREATE INDEX idx_refunds_original_txn ON refunds(original_transaction_id);
CREATE INDEX idx_refund_approvals_refund ON refund_approvals(refund_id);

-- Add trigger for updated_at
CREATE TRIGGER update_settlement_batches_updated_at BEFORE UPDATE ON settlement_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('004', 'settlements_refunds')
ON CONFLICT (version) DO NOTHING;
