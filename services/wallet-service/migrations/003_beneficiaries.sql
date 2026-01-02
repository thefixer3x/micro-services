-- Wallet Service Beneficiaries Migration
-- Version: 003
-- Description: Saved beneficiaries and favorites

-- Beneficiaries table
CREATE TABLE IF NOT EXISTS beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    nickname VARCHAR(100),

    -- Destination details
    beneficiary_type VARCHAR(20) NOT NULL, -- 'wallet', 'bank_account', 'mobile_money'
    wallet_id UUID, -- For internal wallet transfers
    account_number VARCHAR(20),
    bank_code VARCHAR(10),
    bank_name VARCHAR(100),
    account_name VARCHAR(255),

    -- For mobile money
    phone_number VARCHAR(20),
    mobile_provider VARCHAR(50),

    -- Preferences
    is_favorite BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Usage tracking
    transfer_count INTEGER DEFAULT 0,
    last_transfer_at TIMESTAMP WITH TIME ZONE,
    total_transferred DECIMAL(18, 2) DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(user_id, beneficiary_type, COALESCE(wallet_id::text, ''), COALESCE(account_number, ''), COALESCE(bank_code, ''))
);

-- Create indexes
CREATE INDEX idx_beneficiaries_user ON beneficiaries(user_id);
CREATE INDEX idx_beneficiaries_favorites ON beneficiaries(user_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_beneficiaries_recent ON beneficiaries(user_id, last_transfer_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_beneficiaries_updated_at BEFORE UPDATE ON beneficiaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'beneficiaries')
ON CONFLICT (version) DO NOTHING;
