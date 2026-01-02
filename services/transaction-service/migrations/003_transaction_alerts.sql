-- Transaction Service Alerts Migration
-- Version: 003
-- Description: Add transaction alerts and thresholds

-- Transaction alerts configuration table
CREATE TABLE IF NOT EXISTS transaction_alert_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'high_value', 'daily_limit', 'international', 'new_recipient'
    threshold_amount DECIMAL(18, 2),
    daily_limit DECIMAL(18, 2),
    is_enabled BOOLEAN DEFAULT TRUE,
    notification_channels TEXT[] DEFAULT ARRAY['push', 'email'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_id, alert_type)
);

CREATE INDEX idx_alert_configs_wallet ON transaction_alert_configs(wallet_id);

-- Transaction alerts log table
CREATE TABLE IF NOT EXISTS transaction_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    alert_message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_transaction ON transaction_alerts(transaction_id);
CREATE INDEX idx_alerts_wallet ON transaction_alerts(wallet_id);
CREATE INDEX idx_alerts_unacked ON transaction_alerts(wallet_id, is_acknowledged) WHERE is_acknowledged = FALSE;

-- Default high-value thresholds by tier
CREATE TABLE IF NOT EXISTS alert_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier VARCHAR(50) NOT NULL UNIQUE, -- 'basic', 'standard', 'premium', 'business'
    high_value_threshold DECIMAL(18, 2) NOT NULL,
    daily_limit DECIMAL(18, 2) NOT NULL,
    international_threshold DECIMAL(18, 2) NOT NULL,
    require_2fa_above DECIMAL(18, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default thresholds
INSERT INTO alert_thresholds (tier, high_value_threshold, daily_limit, international_threshold, require_2fa_above)
VALUES
    ('basic', 50000.00, 100000.00, 10000.00, 25000.00),
    ('standard', 100000.00, 500000.00, 50000.00, 100000.00),
    ('premium', 500000.00, 2000000.00, 200000.00, 500000.00),
    ('business', 1000000.00, 10000000.00, 500000.00, 1000000.00)
ON CONFLICT (tier) DO NOTHING;

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_alert_configs_updated_at BEFORE UPDATE ON transaction_alert_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'transaction_alerts')
ON CONFLICT (version) DO NOTHING;
