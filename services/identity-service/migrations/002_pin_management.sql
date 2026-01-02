-- Identity Service PIN Management Migration
-- Version: 002
-- Description: Add PIN management and security questions

-- Add PIN columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMP WITH TIME ZONE;

-- Security Questions table
CREATE TABLE IF NOT EXISTS security_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question VARCHAR(500) NOT NULL,
    answer_hash VARCHAR(255) NOT NULL,
    question_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index
CREATE INDEX idx_security_questions_user_id ON security_questions(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_security_questions_updated_at BEFORE UPDATE ON security_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('002', 'pin_management')
ON CONFLICT (version) DO NOTHING;
