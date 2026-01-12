-- Migration: Create webhook infrastructure tables
-- Implements reliable webhook delivery with retries

-- Create enum type
DO $$ BEGIN
  CREATE TYPE webhook_status AS ENUM ('active', 'paused', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Webhook endpoints table
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,

  -- Endpoint config
  url VARCHAR(500) NOT NULL,
  description VARCHAR(255),

  -- Events to receive (empty = all)
  events TEXT[] DEFAULT '{}',

  -- Security
  secret VARCHAR(100) NOT NULL,
  signature_header VARCHAR(50) DEFAULT 'X-Webhook-Signature',

  -- Status
  status webhook_status NOT NULL DEFAULT 'active',

  -- Reliability
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,

  -- Metrics
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  UNIQUE(project_id, url)
);

-- Webhook events table (outbox pattern)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event data
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,

  -- Source
  source_type VARCHAR(30),
  source_id UUID,

  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,

  -- Delivery attempts
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Last attempt details
  last_attempt_at TIMESTAMPTZ,
  last_status_code INTEGER,
  last_response_body TEXT,
  last_error TEXT,

  -- Retry scheduling
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_project ON webhook_endpoints(project_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_status ON webhook_endpoints(status);

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(processed, created_at)
  WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON webhook_deliveries(event_id);

-- Create triggers
CREATE OR REPLACE FUNCTION update_webhook_endpoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER trigger_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_endpoints_updated_at();

CREATE OR REPLACE FUNCTION update_webhook_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_webhook_deliveries_updated_at ON webhook_deliveries;
CREATE TRIGGER trigger_webhook_deliveries_updated_at
  BEFORE UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_deliveries_updated_at();

-- Function to update endpoint metrics
CREATE OR REPLACE FUNCTION update_webhook_endpoint_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND (OLD.status IS NULL OR OLD.status != 'success') THEN
    UPDATE webhook_endpoints
    SET total_deliveries = total_deliveries + 1,
        successful_deliveries = successful_deliveries + 1
    WHERE id = NEW.endpoint_id;
  ELSIF NEW.status = 'exhausted' AND (OLD.status IS NULL OR OLD.status != 'exhausted') THEN
    UPDATE webhook_endpoints
    SET total_deliveries = total_deliveries + 1,
        failed_deliveries = failed_deliveries + 1
    WHERE id = NEW.endpoint_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_webhook_metrics ON webhook_deliveries;
CREATE TRIGGER trigger_update_webhook_metrics
  AFTER UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_endpoint_metrics();

-- Add comments
COMMENT ON TABLE webhook_endpoints IS 'Registered webhook endpoints per project';
COMMENT ON TABLE webhook_events IS 'Event outbox for reliable webhook delivery';
COMMENT ON TABLE webhook_deliveries IS 'Tracks delivery attempts and retries for each event-endpoint pair';
COMMENT ON COLUMN webhook_endpoints.events IS 'Event types to receive (empty array = all events)';
COMMENT ON COLUMN webhook_endpoints.secret IS 'HMAC secret for signing webhook payloads';
