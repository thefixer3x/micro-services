# Admin Service

## 🎯 Purpose
The Admin Service provides administrative capabilities for managing customers, support operations, and basic reporting. It acts as the control center for operations staff.

## 🔑 Key Responsibilities
- Customer 360° view and management
- Support ticket handling
- Account management operations
- Basic reporting and analytics
- Role-based access control
- Audit trail maintenance

## 🏗️ Architecture

### Database Schema
```sql
-- Admin Users
CREATE TABLE admin_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role_id UUID REFERENCES roles(id),
    department VARCHAR(100),
    status ENUM('active', 'inactive'),
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Roles and Permissions
CREATE TABLE roles (
    id UUID PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE,
    description TEXT,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE,
    customer_id UUID,
    assigned_to UUID REFERENCES admin_users(id),
    category VARCHAR(50),
    priority ENUM('low', 'medium', 'high', 'critical'),
    status ENUM('open', 'in_progress', 'resolved', 'closed'),
    subject VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- Ticket Communications
CREATE TABLE ticket_communications (
    id UUID PRIMARY KEY,
    ticket_id UUID REFERENCES support_tickets(id),
    sender_type ENUM('customer', 'admin'),
    sender_id UUID,
    message TEXT,
    attachments JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    admin_user_id UUID REFERENCES admin_users(id),
    action_type VARCHAR(100),
    resource_type VARCHAR(100),
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
- `GET /api/v1/customers` - List customers with filters
- `GET /api/v1/customers/{customerId}` - Get customer 360° view
- `PUT /api/v1/customers/{customerId}/status` - Update account status
- `POST /api/v1/customers/{customerId}/freeze` - Freeze account
- `POST /api/v1/tickets` - Create support ticket
- `GET /api/v1/tickets` - List tickets with filters
- `PUT /api/v1/tickets/{ticketId}` - Update ticket
- `POST /api/v1/tickets/{ticketId}/messages` - Add ticket message
- `GET /api/v1/reports/daily` - Daily transaction report
- `GET /api/v1/reports/customers` - Customer acquisition report
- `GET /api/v1/audit-logs` - View audit trail
- `POST /api/v1/admin/roles` - Create role (super admin)
- `PUT /api/v1/admin/roles/{roleId}` - Update role permissions

### Events Published
- `AccountStatusChanged` - When admin changes account status
- `TicketCreated` - When support ticket is created
- `TicketResolved` - When ticket is resolved
- `AdminAction` - For all admin activities

### Events Consumed
- All events from other services for monitoring and support

## 🔗 Dependencies
- **External Services**:
  - Email service (ticket notifications)
  - SMS service (urgent alerts)

- **Internal Services**:
  - Identity Service (customer data)
  - Wallet Service (balance information)
  - Transaction Service (transaction history)

## 🚀 Running the Service

### Development
```bash
cd services/admin-service
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:integration
```

### Docker
```bash
docker build -t admin-service:latest .
docker run -p 3004:3004 admin-service:latest
```

## 📊 Monitoring
- Health check: `GET /health`
- Metrics: `GET /metrics`
- Key metrics:
  - Active tickets count
  - Average resolution time
  - Admin actions per hour
  - Report generation time

## 🔒 Security
- Role-based access control (RBAC)
- All actions logged in audit trail
- IP whitelisting for admin access
- Session timeout after inactivity
- Two-factor authentication required
