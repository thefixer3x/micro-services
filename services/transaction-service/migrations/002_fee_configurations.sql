-- Transaction Service Fee Configurations Migration
-- Version: 002
-- Description: Add fee_configurations table for dynamic fee management

-- Fee Configurations table
CREATE TABLE IF NOT EXISTS fee_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fee_type VARCHAR(50) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    percentage_fee DECIMAL(5, 4) NOT NULL DEFAULT 0,
    minimum_fee DECIMAL(20, 4) NOT NULL DEFAULT 0,
    maximum_fee DECIMAL(20, 4),
    flat_fee DECIMAL(20, 4) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'NGN',
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fee_type, transaction_type, currency, is_active)
);

-- Transaction Fees table (records actual fees charged per transaction)
CREATE TABLE IF NOT EXISTS transaction_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_fee_configurations_type ON fee_configurations(fee_type, transaction_type);
CREATE INDEX idx_fee_configurations_active ON fee_configurations(is_active);
CREATE INDEX idx_transaction_fees_transaction_id ON transaction_fees(transaction_id);

-- Add trigger for updated_at
CREATE TRIGGER update_fee_configurations_updated_at BEFORE UPDATE ON fee_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default fee configurations
INSERT INTO fee_configurations (fee_type, transaction_type, percentage_fee, minimum_fee, maximum_fee, flat_fee, currency) VALUES
('transfer', 'domestic', 0.005, 100, 5000, 0, 'NGN'),
('transfer', 'international', 0.015, 500, 25000, 250, 'NGN'),
('payment', 'default', 0.005, 50, 2000, 0, 'NGN'),
('remittance', 'default', 0.02, 1000, NULL, 500, 'NGN'),
('fx', 'conversion', 0.002, 0, NULL, 0, 'NGN')
ON CONFLICT DO NOTHING;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('002', 'fee_configurations')
ON CONFLICT (version) DO NOTHING;
