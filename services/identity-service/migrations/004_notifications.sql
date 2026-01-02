-- Identity Service Notifications Migration
-- Version: 004
-- Description: Notification system infrastructure

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- 'transaction', 'security', 'marketing', 'system'

    -- Template content
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    email_subject_template TEXT,
    email_body_template TEXT,
    sms_template TEXT,

    -- Settings
    channels TEXT[] DEFAULT ARRAY['push'], -- 'push', 'email', 'sms', 'in_app'
    is_active BOOLEAN DEFAULT TRUE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    category VARCHAR(50) NOT NULL,

    -- Channel preferences
    push_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    in_app_enabled BOOLEAN DEFAULT TRUE,

    -- Quiet hours
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50) DEFAULT 'Africa/Lagos',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category)
);

-- Notifications queue/log
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    template_id UUID REFERENCES notification_templates(id),

    -- Content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',

    -- Delivery status per channel
    channels_requested TEXT[] NOT NULL,
    push_status VARCHAR(20), -- 'pending', 'sent', 'delivered', 'failed'
    push_sent_at TIMESTAMP WITH TIME ZONE,
    email_status VARCHAR(20),
    email_sent_at TIMESTAMP WITH TIME ZONE,
    sms_status VARCHAR(20),
    sms_sent_at TIMESTAMP WITH TIME ZONE,

    -- User interaction
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP WITH TIME ZONE,

    -- Action
    action_type VARCHAR(50), -- 'open_transaction', 'open_wallet', 'open_url', etc.
    action_data JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
    app_version VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);

-- Create indexes
CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = TRUE;

-- Insert default templates
INSERT INTO notification_templates (name, category, title_template, body_template, email_subject_template, email_body_template, sms_template, channels) VALUES
    ('transaction_credit', 'transaction', 'Money Received!', 'You received {{currency}} {{amount}} from {{sender}}', 'You received {{currency}} {{amount}}', 'Hi {{name}},\n\nYou have received {{currency}} {{amount}} from {{sender}}.\n\nTransaction Reference: {{reference}}\n\nThank you for using our service!', 'You received {{currency}} {{amount}} from {{sender}}. Ref: {{reference}}', ARRAY['push', 'email', 'sms']),
    ('transaction_debit', 'transaction', 'Transfer Successful', 'Your transfer of {{currency}} {{amount}} to {{recipient}} was successful', 'Transfer Confirmation', 'Hi {{name}},\n\nYour transfer of {{currency}} {{amount}} to {{recipient}} was successful.\n\nTransaction Reference: {{reference}}\n\nThank you!', 'Transfer of {{currency}} {{amount}} to {{recipient}} successful. Ref: {{reference}}', ARRAY['push', 'email']),
    ('transaction_failed', 'transaction', 'Transfer Failed', 'Your transfer of {{currency}} {{amount}} could not be completed', 'Transfer Failed', 'Hi {{name}},\n\nUnfortunately, your transfer of {{currency}} {{amount}} could not be completed.\n\nReason: {{reason}}\n\nPlease try again or contact support.', 'Transfer of {{currency}} {{amount}} failed. {{reason}}', ARRAY['push', 'email', 'sms']),
    ('security_login', 'security', 'New Login Detected', 'New login to your account from {{device}} in {{location}}', 'New Login Alert', 'Hi {{name}},\n\nWe detected a new login to your account:\n\nDevice: {{device}}\nLocation: {{location}}\nTime: {{time}}\n\nIf this was not you, please secure your account immediately.', 'New login detected from {{device}}. If not you, secure your account.', ARRAY['push', 'email', 'sms']),
    ('security_2fa_enabled', 'security', '2FA Enabled', 'Two-factor authentication has been enabled on your account', '2FA Enabled', 'Hi {{name}},\n\nTwo-factor authentication has been successfully enabled on your account.\n\nYour account is now more secure!', '2FA enabled on your account.', ARRAY['push', 'email']),
    ('high_value_alert', 'security', 'High Value Transaction', 'A high-value transaction of {{currency}} {{amount}} was initiated', 'High Value Transaction Alert', 'Hi {{name}},\n\nA high-value transaction has been initiated on your account:\n\nAmount: {{currency}} {{amount}}\nTo: {{recipient}}\n\nIf you did not authorize this, please contact us immediately.', 'High value txn: {{currency}} {{amount}}. Not you? Call support.', ARRAY['push', 'email', 'sms']),
    ('scheduled_transfer_executed', 'transaction', 'Scheduled Transfer Complete', 'Your scheduled transfer of {{currency}} {{amount}} to {{recipient}} has been executed', 'Scheduled Transfer Executed', 'Hi {{name}},\n\nYour scheduled transfer has been executed:\n\nAmount: {{currency}} {{amount}}\nTo: {{recipient}}\nReference: {{reference}}', NULL, ARRAY['push', 'email']),
    ('scheduled_transfer_failed', 'transaction', 'Scheduled Transfer Failed', 'Your scheduled transfer could not be completed', 'Scheduled Transfer Failed', 'Hi {{name}},\n\nYour scheduled transfer could not be completed:\n\nAmount: {{currency}} {{amount}}\nTo: {{recipient}}\nReason: {{reason}}\n\nPlease check your account and try again.', 'Scheduled transfer failed: {{reason}}', ARRAY['push', 'email', 'sms'])
ON CONFLICT (name) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('004', 'notifications')
ON CONFLICT (version) DO NOTHING;
