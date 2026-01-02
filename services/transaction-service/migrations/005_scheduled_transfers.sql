-- Transaction Service Scheduled Transfers Migration
-- Version: 005
-- Description: Scheduled and recurring transfers

-- Scheduled transfers table
CREATE TABLE IF NOT EXISTS scheduled_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    source_wallet_id UUID NOT NULL,
    destination_wallet_id UUID,
    destination_account_number VARCHAR(20),
    destination_bank_code VARCHAR(10),
    destination_name VARCHAR(255),
    amount DECIMAL(18, 2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'NGN',
    narration VARCHAR(100),

    -- Scheduling
    schedule_type VARCHAR(20) NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'custom'
    scheduled_date DATE, -- For one-time
    scheduled_time TIME DEFAULT '09:00:00',
    day_of_week INTEGER, -- 0-6 for weekly (0 = Sunday)
    day_of_month INTEGER, -- 1-31 for monthly
    cron_expression VARCHAR(100), -- For custom schedules
    timezone VARCHAR(50) DEFAULT 'Africa/Lagos',

    -- Execution tracking
    next_execution_at TIMESTAMP WITH TIME ZONE,
    last_execution_at TIMESTAMP WITH TIME ZONE,
    execution_count INTEGER DEFAULT 0,
    max_executions INTEGER, -- NULL for unlimited

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'cancelled', 'failed'
    failure_count INTEGER DEFAULT 0,
    last_failure_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled transfer executions log
CREATE TABLE IF NOT EXISTS scheduled_transfer_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_transfer_id UUID NOT NULL REFERENCES scheduled_transfers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id),
    status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
    amount DECIMAL(18, 2) NOT NULL,
    fee_amount DECIMAL(18, 2),
    failure_reason TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_scheduled_transfers_user ON scheduled_transfers(user_id);
CREATE INDEX idx_scheduled_transfers_wallet ON scheduled_transfers(source_wallet_id);
CREATE INDEX idx_scheduled_transfers_next ON scheduled_transfers(next_execution_at) WHERE status = 'active';
CREATE INDEX idx_scheduled_transfers_status ON scheduled_transfers(status);
CREATE INDEX idx_scheduled_executions_transfer ON scheduled_transfer_executions(scheduled_transfer_id);

-- Add trigger for updated_at
CREATE TRIGGER update_scheduled_transfers_updated_at BEFORE UPDATE ON scheduled_transfers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('005', 'scheduled_transfers')
ON CONFLICT (version) DO NOTHING;
