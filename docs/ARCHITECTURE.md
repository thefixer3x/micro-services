# Platform Architecture

## Overview

This platform is a financial microservices system designed for digital wallet and payment processing. It follows a domain-driven microservices architecture with separate databases per service, an API gateway for routing, and event-driven communication.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                    (Mobile Apps, Web Dashboard, APIs)                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KONG API GATEWAY                                   │
│                                                                              │
│  • JWT Authentication    • Rate Limiting    • CORS                          │
│  • Request Routing       • Load Balancing   • Metrics Collection            │
└────────┬────────────┬────────────┬────────────┬─────────────────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  IDENTITY  │ │   WALLET   │ │TRANSACTION │ │   ADMIN    │
│  SERVICE   │ │  SERVICE   │ │  SERVICE   │ │  SERVICE   │
│   :3001    │ │   :3002    │ │   :3003    │ │   :3004    │
└─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ PostgreSQL │ │ PostgreSQL │ │ PostgreSQL │ │ PostgreSQL │
│ identity_db│ │  wallet_db │ │   txn_db   │ │  admin_db  │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
         │            │            │            │
         └────────────┴─────┬──────┴────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │         KAFKA           │
              │    (Event Bus)          │
              │                         │
              │  Topics:                │
              │  • user.events          │
              │  • wallet.events        │
              │  • transaction.events   │
              │  • admin.events         │
              └─────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼                                     ▼
┌─────────────────┐                 ┌─────────────────┐
│   PROMETHEUS    │                 │     REDIS       │
│   (Metrics)     │                 │    (Cache)      │
│     :9090       │                 │     :6379       │
└────────┬────────┘                 └─────────────────┘
         │
         ▼
┌─────────────────┐
│    GRAFANA      │
│  (Dashboards)   │
│     :3000       │
└─────────────────┘
```

---

## Services

### Identity Service (Port 3001)

**Responsibility:** User authentication, authorization, KYC, and biometric management.

**Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/login` | POST | User authentication |
| `/api/v1/auth/logout` | POST | Session termination |
| `/api/v1/auth/refresh` | POST | Token refresh |
| `/api/v1/auth/2fa/*` | POST | Two-factor authentication |
| `/api/v1/users/profile` | GET/PUT | Profile management |
| `/api/v1/users/profile/settings` | GET/PUT | User settings |
| `/api/v1/kyc/*` | ALL | KYC document management |
| `/api/v1/biometric/*` | ALL | Biometric enrollment/verification |

**Database Tables:**
- `users` - Core user accounts
- `user_profiles` - Extended profile data
- `kyc_documents` - KYC verification documents
- `biometric_data` - Biometric templates
- `refresh_tokens` - JWT refresh token storage

**Key Features:**
- Multi-language support (en, pcm, yo, fr)
- Multiple account types (Individual, Business, Joint)
- Document upload with verification workflow
- Biometric enrollment (fingerprint, face, voice)

---

### Wallet Service (Port 3002)

**Responsibility:** Wallet management, balance operations, and payment provider integration.

**Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/customers` | POST | Create customer |
| `/api/v1/customers/wallet` | POST | Create customer + wallet |
| `/api/v1/customers/user/:userId` | GET | Get customer by user |
| `/api/v1/wallets` | POST | Create wallet |
| `/api/v1/wallets/:walletId` | GET | Get wallet details |
| `/api/v1/wallets/:walletId/balance` | GET | Get balance |
| `/api/v1/wallets/:walletId/transfer` | POST | Initiate transfer |
| `/api/v1/wallets/:walletId/transactions` | GET | Transaction history |
| `/api/v1/banks` | GET | List available banks |
| `/api/v1/banks/validate` | POST | Validate bank account |

**Database Tables:**
- `customers` - Customer records (linked to Identity)
- `wallets` - Wallet accounts
- `transactions` - Transaction records
- `virtual_cards` - Virtual card management
- `balance_history` - Balance audit trail
- `provider_credentials` - Encrypted API keys

**Provider Pattern:**
```
┌─────────────────────────────────────────────┐
│              WalletService                   │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│            ProviderFactory                   │
│                                              │
│  createProvider(type: string): IWalletProvider
└─────────────────────┬───────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Providus   │ │ Flutterwave  │ │   Paystack   │
│   Provider   │ │   Provider   │ │   Provider   │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Supported Providers:**
- Providus (primary)
- Flutterwave
- Paystack
- Stripe

---

### Transaction Service (Port 3003)

**Responsibility:** Transfer processing, fee calculation, and settlement tracking.

**Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/transfers/domestic` | POST | Domestic transfer |
| `/api/v1/transfers/international` | POST | International transfer |
| `/api/v1/transactions/:id` | GET | Get transaction |
| `/api/v1/transactions` | GET | List transactions |
| `/api/v1/transactions/:id/cancel` | POST | Cancel transaction |
| `/api/v1/fees/calculate` | POST | Calculate fees |
| `/api/v1/stats/:walletId` | GET | Transaction statistics |

**Database Tables:**
- `transactions` - Transaction records
- `transaction_logs` - Status change audit
- `transaction_reconciliations` - Reconciliation records
- `webhook_events` - Provider webhook events

**Fee Calculation:**
```typescript
interface FeeCalculation {
  baseAmount: number;
  totalFees: number;
  breakdown: {
    type: 'platform' | 'provider' | 'tax';
    amount: number;
    percentage?: number;
  }[];
  finalAmount: number;
}
```

**Key Features:**
- Idempotent transfer creation (prevents duplicates)
- Atomic transaction + fee recording
- Multi-leg transaction routing
- Settlement reconciliation framework

---

### Admin Service (Port 3004)

**Responsibility:** Back-office operations, support tickets, and audit logging.

**Endpoints:**
| Route | Method | Description |
|-------|--------|-------------|
| `/api/v1/customers` | GET | List customers |
| `/api/v1/tickets` | POST/GET | Create/list tickets |
| `/api/v1/tickets/:id` | GET/PUT | Get/update ticket |
| `/api/v1/audit-logs` | POST/GET | Create/query audit logs |

**Database Tables:**
- `support_tickets` - Support ticket records
- `ticket_messages` - Ticket conversation history
- `audit_logs` - System audit trail
- `system_settings` - Configuration storage

**Ticket Workflow:**
```
┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────────┐     ┌────────┐
│   OPEN   │────▶│ IN_PROGRESS │────▶│ PENDING │────▶│ RESOLVED │────▶│ CLOSED │
└──────────┘     └─────────────┘     └─────────┘     └──────────┘     └────────┘
```

**Admin Roles:**
- `super_admin` - Full system access
- `admin` - Administrative operations
- `support_agent` - Customer support
- `auditor` - Read-only audit access
- `viewer` - Read-only access

---

## Shared Libraries

Located in `/libraries/`:

### common-auth
JWT token generation and verification, password hashing with bcrypt.

```typescript
// Usage
import { generateToken, verifyToken, hashPassword, comparePassword } from 'common-auth';
```

### common-db
PostgreSQL connection pooling, migration runner, base repository pattern.

```typescript
// Usage
import { pool, transaction, runMigrations } from 'common-db';
```

### common-events
Kafka producer/consumer wrappers, platform event type definitions.

```typescript
// Usage
import { publishEvent, subscribeToEvents, PlatformEvents } from 'common-events';
```

### common-utils
Error handling, HTTP client, structured logging, input validators.

```typescript
// Usage
import { AppError, httpClient, logger, validators } from 'common-utils';
```

---

## API Gateway (Kong)

**Configuration:** `/gateway/kong.yml`

### Route Configuration

**Public Routes (No Auth):**
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`

**Protected Routes (JWT Required):**
- All `/api/v1/users/*`
- All `/api/v1/kyc/*`
- All `/api/v1/biometric/*`
- All `/api/v1/wallets/*`
- All `/api/v1/transactions/*`
- All `/api/v1/admin/*`

### Plugins

| Plugin | Configuration |
|--------|---------------|
| JWT | Verify exp claim, key claim name: `kid` |
| Rate Limiting | Public: 20/min, Protected: 100/min |
| CORS | All origins, methods, headers |
| Request Size | 10MB max |
| Prometheus | Per-consumer metrics |

---

## Event-Driven Architecture

### Event Types

**Identity Events:**
- `user.registered`
- `user.login`
- `user.logout`
- `user.profile.updated`
- `kyc.submitted`
- `kyc.verified`
- `kyc.rejected`

**Wallet Events:**
- `wallet.created`
- `wallet.balance.updated`
- `wallet.frozen`
- `wallet.unfrozen`

**Transaction Events:**
- `transaction.initiated`
- `transaction.pending`
- `transaction.completed`
- `transaction.failed`
- `transaction.reversed`

**Admin Events:**
- `ticket.created`
- `ticket.assigned`
- `ticket.resolved`
- `audit.logged`

### Event Schema

```typescript
interface PlatformEvent<T> {
  eventId: string;           // UUID
  eventType: string;         // e.g., "user.registered"
  timestamp: string;         // ISO 8601
  source: string;            // Service name
  version: string;           // Event schema version
  correlationId?: string;    // Request tracing
  payload: T;                // Event-specific data
}
```

---

## Monitoring & Observability

### Prometheus Metrics

Each service exposes `/metrics` endpoint with:
- `http_requests_total` - Request counter by method, route, status
- `http_request_duration_seconds` - Request latency histogram
- `db_connections_active` - Active database connections
- `db_query_duration_seconds` - Database query latency

### Grafana Dashboards

**Platform Overview Dashboard:**
- Request rate per service
- Error rate and latency (P50, P95, P99)
- Active transactions
- Authentication activity
- Database connection pool status

**Location:** `/monitoring/grafana/dashboards/platform-overview.json`

### Health Checks

All services expose `GET /health` returning:
```json
{
  "status": "healthy",
  "service": "identity-service",
  "timestamp": "2024-01-01T00:00:00Z",
  "checks": {
    "database": "connected",
    "redis": "connected"
  }
}
```

---

## Database Design

### Naming Conventions
- Tables: `snake_case`, plural (e.g., `users`, `transactions`)
- Columns: `snake_case` (e.g., `created_at`, `user_id`)
- Primary Keys: `id` (UUID)
- Foreign Keys: `{table}_id` (e.g., `user_id`, `wallet_id`)
- Timestamps: `created_at`, `updated_at`

### Common Patterns

**UUID Primary Keys:**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

**Timestamps:**
```sql
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

**Soft Deletes:**
```sql
status VARCHAR(20) DEFAULT 'active'  -- active, inactive, deleted
```

**JSONB for Flexible Data:**
```sql
metadata JSONB DEFAULT '{}'
```

### Migration Strategy

Each service manages its own migrations in `/migrations/`:
```
services/
├── identity-service/
│   └── migrations/
│       └── 001_initial_schema.sql
├── wallet-service/
│   └── migrations/
│       └── 001_initial_schema.sql
└── ...
```

Migrations are tracked via `schema_migrations` table per database.

---

## Security

### Authentication Flow

```
┌────────┐     ┌──────┐     ┌──────────┐     ┌─────────┐
│ Client │────▶│ Kong │────▶│ Identity │────▶│   DB    │
└────────┘     └──────┘     │ Service  │     └─────────┘
                            └──────────┘
     │              │             │
     │  1. Login    │             │
     │─────────────▶│             │
     │              │  2. Verify  │
     │              │────────────▶│
     │              │  3. JWT     │
     │◀─────────────│◀────────────│
     │              │             │
     │  4. Request  │             │
     │  + JWT       │             │
     │─────────────▶│  5. Verify  │
     │              │     JWT     │
     │              │  6. Forward │
     │              │────────────▶│
```

### Security Measures

| Layer | Measure |
|-------|---------|
| Transport | HTTPS/TLS |
| Authentication | JWT with RS256 |
| Authorization | Role-based (RBAC types defined) |
| Passwords | bcrypt hashing (cost 12) |
| Rate Limiting | Per-route limits in Kong |
| Input Validation | express-validator |
| SQL Injection | Parameterized queries |
| XSS | Response sanitization |
| CORS | Configurable origins |

---

## Deployment

### Docker Compose Services

```yaml
services:
  # Infrastructure
  kong-database:     # Kong config store
  kong:              # API Gateway
  redis:             # Caching
  kafka:             # Event bus
  zookeeper:         # Kafka coordination
  prometheus:        # Metrics
  grafana:           # Dashboards

  # Databases
  identity-db:       # Identity Service DB
  wallet-db:         # Wallet Service DB
  transaction-db:    # Transaction Service DB
  admin-db:          # Admin Service DB

  # Services
  identity-service:  # Port 3001
  wallet-service:    # Port 3002
  transaction-service: # Port 3003
  admin-service:     # Port 3004
```

### Environment Variables

Each service requires:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=service_db
DB_USER=postgres
DB_PASSWORD=secret

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Service Discovery
IDENTITY_SERVICE_URL=http://identity-service:3001
WALLET_SERVICE_URL=http://wallet-service:3002
TRANSACTION_SERVICE_URL=http://transaction-service:3003
ADMIN_SERVICE_URL=http://admin-service:3004

# Kafka
KAFKA_BROKERS=kafka:9092

# Redis
REDIS_URL=redis://redis:6379
```

---

## CI/CD Pipeline

**Location:** `.github/workflows/ci.yml`

### Pipeline Stages

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌─────────┐
│  Lint   │────▶│   Test   │────▶│  Build  │────▶│ Publish │
└─────────┘     └──────────┘     └─────────┘     └─────────┘
```

### Service Detection

The pipeline uses path-based change detection:
- Changes in `services/identity-service/**` trigger Identity Service jobs
- Changes in `services/wallet-service/**` trigger Wallet Service jobs
- Changes in `libraries/**` trigger all service jobs

### Test Containers

Each service test job spins up:
- PostgreSQL container
- Redis container (where needed)

---

## Architecture Alignment Status

| Component | Documented | Implemented | Status |
|-----------|------------|-------------|--------|
| Identity Service | ✅ | ✅ | Aligned |
| Wallet Service | ✅ | ✅ | Aligned |
| Transaction Service | ✅ | ✅ | Aligned |
| Admin Service | ✅ | ✅ | Aligned |
| Kong API Gateway | ✅ | ✅ | Aligned |
| PostgreSQL (per service) | ✅ | ✅ | Aligned |
| Kafka Event Bus | ✅ | ⚠️ | Producers defined, consumers partial |
| Redis Cache | ✅ | ⚠️ | Configured, usage limited |
| Prometheus | ✅ | ✅ | Aligned |
| Grafana | ✅ | ✅ | Aligned |
| Shared Libraries | ✅ | ✅ | Aligned |
| CI/CD Pipeline | ✅ | ✅ | Aligned |

### Known Gaps

1. **Event Consumers:** Kafka event producers are defined but consumers are not fully implemented
2. **Redis Caching:** Redis is configured but caching strategy is minimal
3. **Service-to-Service Auth:** Internal service communication lacks mutual TLS
4. **Circuit Breakers:** No resilience patterns implemented (Hystrix/resilience4j equivalent)
5. **Distributed Tracing:** No Jaeger/Zipkin integration for request tracing

---

## Future Considerations

### Scalability
- Horizontal scaling via Kubernetes
- Read replicas for databases
- Redis Cluster for high availability
- Kafka partition scaling

### Resilience
- Circuit breaker pattern
- Retry with exponential backoff
- Bulkhead isolation
- Graceful degradation

### Observability
- Distributed tracing (Jaeger)
- Log aggregation (ELK Stack)
- Alerting (PagerDuty/OpsGenie)
- SLO/SLI dashboards
