-- Identity Service Security Hardening Migration
-- Version: 003
-- Description: Add 2FA, session management, and security enhancements

-- Add 2FA columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_generated_at TIMESTAMP WITH TIME ZONE;

-- User Sessions table for device tracking and session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    device_id VARCHAR(255),
    device_name VARCHAR(255),
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet', 'web'
    ip_address INET,
    user_agent TEXT,
    location VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_sessions_token ON user_sessions(refresh_token_hash);

-- Security Events table for audit trail
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'password_change', '2fa_enabled', '2fa_disabled', 'suspicious_activity'
    ip_address INET,
    user_agent TEXT,
    device_id VARCHAR(255),
    location VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    risk_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);

-- Alert preferences table
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'high_value_transaction', 'new_device_login', 'password_change', 'suspicious_activity'
    enabled BOOLEAN DEFAULT TRUE,
    threshold_amount DECIMAL(18, 2), -- For high-value transaction alerts
    notification_channels TEXT[] DEFAULT ARRAY['push', 'email'], -- 'push', 'email', 'sms'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, alert_type)
);

CREATE INDEX idx_alert_preferences_user_id ON alert_preferences(user_id);

-- Trusted devices table
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_fingerprint VARCHAR(255),
    is_trusted BOOLEAN DEFAULT TRUE,
    trusted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);

CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);

-- Add trigger for updated_at on alert_preferences
CREATE TRIGGER update_alert_preferences_updated_at BEFORE UPDATE ON alert_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'security_hardening')
ON CONFLICT (version) DO NOTHING;
