-- Migration: Create project_capabilities table
-- Stores feature flags and limits per project

CREATE TABLE IF NOT EXISTS project_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE,

  -- Feature flags
  wallet_enabled BOOLEAN DEFAULT FALSE,
  transfers_enabled BOOLEAN DEFAULT FALSE,
  payments_enabled BOOLEAN DEFAULT FALSE,
  cards_enabled BOOLEAN DEFAULT FALSE,
  kyc_enabled BOOLEAN DEFAULT FALSE,
  webhooks_enabled BOOLEAN DEFAULT TRUE,

  -- Currency restrictions
  allowed_currencies TEXT[] DEFAULT '{NGN}',

  -- Transfer limits
  daily_transfer_limit DECIMAL(18,2) DEFAULT 1000000,
  per_transfer_limit DECIMAL(18,2) DEFAULT 100000,
  monthly_volume_limit DECIMAL(18,2),

  -- Payment limits
  daily_payment_limit DECIMAL(18,2) DEFAULT 5000000,
  per_payment_limit DECIMAL(18,2) DEFAULT 500000,

  -- KYC options (if kyc_enabled)
  kyc_types TEXT[] DEFAULT '{bvn,phone}',

  -- Rate limits
  requests_per_minute INTEGER DEFAULT 100,
  requests_per_hour INTEGER DEFAULT 1000,

  -- Tier information
  tier VARCHAR(20) DEFAULT 'starter',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_project_capabilities_project ON project_capabilities(project_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_project_capabilities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_project_capabilities_updated_at ON project_capabilities;
CREATE TRIGGER trigger_project_capabilities_updated_at
  BEFORE UPDATE ON project_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_project_capabilities_updated_at();

-- Default tier configurations (for reference)
CREATE TABLE IF NOT EXISTS capability_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(50) NOT NULL,

  -- Features
  wallet_enabled BOOLEAN DEFAULT FALSE,
  transfers_enabled BOOLEAN DEFAULT FALSE,
  payments_enabled BOOLEAN DEFAULT FALSE,
  cards_enabled BOOLEAN DEFAULT FALSE,
  kyc_enabled BOOLEAN DEFAULT FALSE,

  -- Limits
  daily_transfer_limit DECIMAL(18,2),
  per_transfer_limit DECIMAL(18,2),
  monthly_volume_limit DECIMAL(18,2),
  requests_per_minute INTEGER,
  requests_per_hour INTEGER,

  -- Pricing (optional)
  monthly_fee DECIMAL(10,2) DEFAULT 0,
  transaction_fee_percent DECIMAL(5,4) DEFAULT 0,
  transaction_fee_cap DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO capability_tiers (tier_name, display_name, wallet_enabled, transfers_enabled, payments_enabled, kyc_enabled, daily_transfer_limit, per_transfer_limit, requests_per_minute, requests_per_hour)
VALUES
  ('starter', 'Starter', TRUE, TRUE, TRUE, TRUE, 1000000, 100000, 60, 500),
  ('growth', 'Growth', TRUE, TRUE, TRUE, TRUE, 10000000, 1000000, 120, 2000),
  ('business', 'Business', TRUE, TRUE, TRUE, TRUE, 50000000, 5000000, 300, 10000),
  ('enterprise', 'Enterprise', TRUE, TRUE, TRUE, TRUE, NULL, NULL, 1000, 50000)
ON CONFLICT (tier_name) DO NOTHING;

-- View for capabilities with tier defaults
CREATE OR REPLACE VIEW project_capabilities_with_tier AS
SELECT
  pc.*,
  ct.display_name as tier_display_name,
  COALESCE(pc.daily_transfer_limit, ct.daily_transfer_limit) as effective_daily_transfer_limit,
  COALESCE(pc.per_transfer_limit, ct.per_transfer_limit) as effective_per_transfer_limit,
  COALESCE(pc.requests_per_minute, ct.requests_per_minute) as effective_requests_per_minute,
  COALESCE(pc.requests_per_hour, ct.requests_per_hour) as effective_requests_per_hour
FROM project_capabilities pc
LEFT JOIN capability_tiers ct ON pc.tier = ct.tier_name;

-- Add comments
COMMENT ON TABLE project_capabilities IS 'Feature flags and limits per project';
COMMENT ON TABLE capability_tiers IS 'Default configurations for each pricing tier';
COMMENT ON COLUMN project_capabilities.tier IS 'Pricing tier: starter, growth, business, enterprise';
COMMENT ON COLUMN project_capabilities.kyc_types IS 'Allowed KYC verification types: bvn, nin, passport, phone, address, selfie';
COMMENT ON VIEW project_capabilities_with_tier IS 'Capabilities with effective limits from tier defaults';
