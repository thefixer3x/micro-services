-- Migration: Create provider_accounts table for vendor abstraction
-- This table stores provider configurations per project

-- Create enum types
DO $$ BEGIN
  CREATE TYPE provider_type AS ENUM (
    'wallet',
    'payment_gateway',
    'card_issuer',
    'verification',
    'transfer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE provider_status AS ENUM ('active', 'disabled', 'maintenance', 'deprecated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE environment_type AS ENUM ('sandbox', 'live');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create provider_accounts table
CREATE TABLE IF NOT EXISTS provider_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  provider_name VARCHAR(50) NOT NULL,
  provider_type provider_type NOT NULL,
  environment environment_type NOT NULL DEFAULT 'sandbox',

  -- Configuration (encrypted in production)
  config JSONB NOT NULL DEFAULT '{}',
  base_url VARCHAR(255),

  -- Routing
  priority INTEGER DEFAULT 0,
  weight INTEGER DEFAULT 100,
  supported_currencies TEXT[] DEFAULT '{}',
  supported_countries TEXT[] DEFAULT '{}',

  -- Limits
  daily_limit_amount DECIMAL(18,2),
  per_transaction_limit DECIMAL(18,2),

  -- Status
  status provider_status NOT NULL DEFAULT 'active',
  health_check_url VARCHAR(255),
  last_health_check_at TIMESTAMPTZ,
  last_health_status VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,

  UNIQUE(project_id, provider_name, environment)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provider_accounts_project ON provider_accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_type ON provider_accounts(provider_type, status);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_routing ON provider_accounts(provider_type, status, priority DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_provider_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_provider_accounts_updated_at ON provider_accounts;
CREATE TRIGGER trigger_provider_accounts_updated_at
  BEFORE UPDATE ON provider_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_accounts_updated_at();

-- Add comments
COMMENT ON TABLE provider_accounts IS 'Stores provider configurations per project for vendor abstraction';
COMMENT ON COLUMN provider_accounts.config IS 'Provider credentials and settings (should be encrypted in production)';
COMMENT ON COLUMN provider_accounts.priority IS 'Higher priority = preferred provider for routing';
COMMENT ON COLUMN provider_accounts.weight IS 'Weight for load balancing when multiple providers have same priority';
