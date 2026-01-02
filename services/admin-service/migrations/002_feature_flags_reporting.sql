-- Admin Service Feature Flags and Reporting Migration
-- Version: 002
-- Description: Add feature flags table and reporting views

-- Feature Flags table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flag_key VARCHAR(100) NOT NULL UNIQUE,
    flag_value BOOLEAN DEFAULT FALSE,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    enabled_for JSONB DEFAULT '[]', -- Array of user IDs or 'all'
    disabled_for JSONB DEFAULT '[]', -- Array of user IDs to exclude
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Platform Metrics table (for aggregated daily metrics)
CREATE TABLE IF NOT EXISTS platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 4) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_date, metric_type, dimensions)
);

-- Create indexes
CREATE INDEX idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX idx_feature_flags_value ON feature_flags(flag_value);
CREATE INDEX idx_platform_metrics_date ON platform_metrics(metric_date DESC);
CREATE INDEX idx_platform_metrics_type ON platform_metrics(metric_type);

-- Add trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default feature flags
INSERT INTO feature_flags (flag_key, flag_value, description, rollout_percentage) VALUES
('2fa_enabled', false, 'Enable two-factor authentication', 0),
('international_transfers', true, 'Enable international transfers', 100),
('virtual_cards', false, 'Enable virtual card creation', 0),
('biometric_login', false, 'Enable biometric login', 0),
('push_notifications', false, 'Enable push notifications', 0),
('statement_generation', true, 'Enable statement generation', 100),
('bulk_transfers', false, 'Enable bulk transfer feature', 0),
('rewards_program', false, 'Enable rewards and loyalty program', 0)
ON CONFLICT (flag_key) DO NOTHING;

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('002', 'feature_flags_reporting')
ON CONFLICT (version) DO NOTHING;
