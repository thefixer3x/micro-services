-- Migration: Create provider_references table for reconciliation
-- This table maps internal references to provider references

CREATE TABLE IF NOT EXISTS provider_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Internal reference
  internal_ref VARCHAR(50) NOT NULL UNIQUE,
  internal_type VARCHAR(30) NOT NULL,

  -- Provider reference
  provider_name VARCHAR(50) NOT NULL,
  provider_ref VARCHAR(100),
  provider_session_id VARCHAR(100),

  -- Raw data for debugging
  raw_request JSONB,
  raw_response JSONB,

  -- Status tracking
  provider_status VARCHAR(30),
  normalized_status VARCHAR(20) NOT NULL,
  status_reason TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  response_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provider_refs_internal ON provider_references(internal_ref);
CREATE INDEX IF NOT EXISTS idx_provider_refs_provider ON provider_references(provider_name, provider_ref);
CREATE INDEX IF NOT EXISTS idx_provider_refs_status ON provider_references(normalized_status);
CREATE INDEX IF NOT EXISTS idx_provider_refs_pending ON provider_references(normalized_status)
  WHERE normalized_status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_provider_refs_created ON provider_references(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_provider_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_provider_references_updated_at ON provider_references;
CREATE TRIGGER trigger_provider_references_updated_at
  BEFORE UPDATE ON provider_references
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_references_updated_at();

-- Add comments
COMMENT ON TABLE provider_references IS 'Maps internal transaction references to provider-specific references for reconciliation';
COMMENT ON COLUMN provider_references.internal_ref IS 'Your internal transaction/transfer ID';
COMMENT ON COLUMN provider_references.provider_ref IS 'Provider transaction reference';
COMMENT ON COLUMN provider_references.normalized_status IS 'Standardized status: pending, processing, success, failed, reversed';
COMMENT ON COLUMN provider_references.raw_request IS 'Original request sent to provider (for debugging)';
COMMENT ON COLUMN provider_references.raw_response IS 'Original response from provider (for debugging)';
