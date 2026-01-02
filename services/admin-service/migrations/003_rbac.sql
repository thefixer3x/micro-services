-- Admin Service RBAC Migration
-- Version: 003
-- Description: Role-Based Access Control system

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System roles can't be deleted
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'users:read', 'transactions:write'
    resource VARCHAR(50) NOT NULL, -- e.g., 'users', 'transactions', 'wallets'
    action VARCHAR(50) NOT NULL, -- e.g., 'read', 'write', 'delete', 'approve'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role mapping
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, role_id)
);

-- Create indexes
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_permissions_resource ON permissions(resource);

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system) VALUES
    ('super_admin', 'Super Administrator', 'Full system access', TRUE),
    ('admin', 'Administrator', 'Administrative access', TRUE),
    ('support_manager', 'Support Manager', 'Manage support tickets and escalations', TRUE),
    ('support_agent', 'Support Agent', 'Handle customer support', TRUE),
    ('finance_manager', 'Finance Manager', 'Manage settlements and refunds', TRUE),
    ('finance_analyst', 'Finance Analyst', 'View financial reports', TRUE),
    ('compliance_officer', 'Compliance Officer', 'KYC and compliance management', TRUE),
    ('auditor', 'Auditor', 'Read-only audit access', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    -- User permissions
    ('users:read', 'users', 'read', 'View user details'),
    ('users:write', 'users', 'write', 'Create and update users'),
    ('users:delete', 'users', 'delete', 'Delete users'),
    ('users:suspend', 'users', 'suspend', 'Suspend user accounts'),

    -- Transaction permissions
    ('transactions:read', 'transactions', 'read', 'View transactions'),
    ('transactions:write', 'transactions', 'write', 'Create transactions'),
    ('transactions:approve', 'transactions', 'approve', 'Approve pending transactions'),
    ('transactions:reverse', 'transactions', 'reverse', 'Reverse transactions'),

    -- Wallet permissions
    ('wallets:read', 'wallets', 'read', 'View wallet details'),
    ('wallets:write', 'wallets', 'write', 'Modify wallets'),
    ('wallets:freeze', 'wallets', 'freeze', 'Freeze/unfreeze wallets'),

    -- Settlement permissions
    ('settlements:read', 'settlements', 'read', 'View settlements'),
    ('settlements:write', 'settlements', 'write', 'Create settlements'),
    ('settlements:approve', 'settlements', 'approve', 'Approve settlements'),

    -- Refund permissions
    ('refunds:read', 'refunds', 'read', 'View refunds'),
    ('refunds:write', 'refunds', 'write', 'Create refunds'),
    ('refunds:approve', 'refunds', 'approve', 'Approve refunds'),

    -- KYC permissions
    ('kyc:read', 'kyc', 'read', 'View KYC documents'),
    ('kyc:write', 'kyc', 'write', 'Update KYC status'),
    ('kyc:approve', 'kyc', 'approve', 'Approve/reject KYC'),

    -- Report permissions
    ('reports:read', 'reports', 'read', 'View reports'),
    ('reports:export', 'reports', 'export', 'Export reports'),

    -- Ticket permissions
    ('tickets:read', 'tickets', 'read', 'View support tickets'),
    ('tickets:write', 'tickets', 'write', 'Create and update tickets'),
    ('tickets:assign', 'tickets', 'assign', 'Assign tickets'),
    ('tickets:escalate', 'tickets', 'escalate', 'Escalate tickets'),

    -- Config permissions
    ('config:read', 'config', 'read', 'View system configuration'),
    ('config:write', 'config', 'write', 'Modify system configuration'),

    -- Audit permissions
    ('audit:read', 'audit', 'read', 'View audit logs'),

    -- Feature flags
    ('features:read', 'features', 'read', 'View feature flags'),
    ('features:write', 'features', 'write', 'Modify feature flags')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to super_admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Assign permissions to admin (most permissions except config:write)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name NOT IN ('config:write', 'users:delete')
ON CONFLICT DO NOTHING;

-- Assign permissions to support_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'support_manager'
AND p.name IN ('users:read', 'transactions:read', 'wallets:read', 'tickets:read', 'tickets:write', 'tickets:assign', 'tickets:escalate', 'refunds:read', 'refunds:write')
ON CONFLICT DO NOTHING;

-- Assign permissions to support_agent
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'support_agent'
AND p.name IN ('users:read', 'transactions:read', 'wallets:read', 'tickets:read', 'tickets:write')
ON CONFLICT DO NOTHING;

-- Assign permissions to finance_manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'finance_manager'
AND p.name IN ('transactions:read', 'transactions:approve', 'settlements:read', 'settlements:write', 'settlements:approve', 'refunds:read', 'refunds:write', 'refunds:approve', 'reports:read', 'reports:export')
ON CONFLICT DO NOTHING;

-- Assign permissions to auditor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'auditor'
AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO schema_migrations (version, name)
VALUES ('003', 'rbac')
ON CONFLICT (version) DO NOTHING;
