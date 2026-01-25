-- Identity Service Notification Retries and Delivery Events Migration
-- Version: 005
-- Description: Adds retry queue and delivery tracking tables

-- Notification retries table for failed deliveries
CREATE TABLE IF NOT EXISTS notification_retries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- 'push', 'email', 'sms'
    retry_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notification delivery events table for webhook tracking
CREATE TABLE IF NOT EXISTS notification_delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL, -- 'push', 'email', 'sms'
    external_message_id VARCHAR(255), -- Provider's message ID
    event_type VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced', etc.
    event_data JSONB DEFAULT '{}',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS permanently_failed BOOLEAN DEFAULT FALSE;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_notification_retries_notification ON notification_retries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_retries_scheduled ON notification_retries(scheduled_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_notification_retries_processed ON notification_retries(processed, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_delivery_events_notification ON notification_delivery_events(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_external_id ON notification_delivery_events(external_message_id);
CREATE INDEX IF NOT EXISTS idx_delivery_events_received ON notification_delivery_events(received_at DESC);

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('005', 'notification_retries')
ON CONFLICT (version) DO NOTHING;