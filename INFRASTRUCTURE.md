# Infrastructure Documentation

This document describes the complete infrastructure setup for the microservices platform.

## Architecture Overview

The platform consists of the following components:

### Core Services
1. **Identity Service** (Port 3001) - User authentication, KYC, biometrics
2. **Wallet Service** (Port 3002) - Multi-provider wallet management
3. **Transaction Service** (Port 3003) - Transaction processing and reconciliation
4. **Admin Service** (Port 3004) - Support tickets, audit logs, admin operations

### Infrastructure Components
1. **Kong API Gateway** (Ports 8000, 8001, 8002) - API routing, authentication, rate limiting
2. **Kafka** (Port 9092, 29092) - Event bus for async communication
3. **Zookeeper** (Port 2181) - Kafka coordination
4. **Redis** (Port 6379) - Caching layer
5. **PostgreSQL** (Multiple instances) - Database per service pattern
6. **Prometheus** (Port 9090) - Metrics collection
7. **Grafana** (Port 3000) - Monitoring dashboards

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL client (optional, for database access)

### Start All Services

```bash
# Start all infrastructure and services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f [service-name]
```

### Run Database Migrations

```bash
# Run migrations for all services
./scripts/migrate-all.sh

# Or run for specific service
ts-node scripts/run-migrations.ts --service=identity-service
```

### Access Points

- **Kong API Gateway**: http://localhost:8000
- **Kong Admin API**: http://localhost:8001
- **Kong Manager**: http://localhost:8002
- **Identity Service**: http://localhost:3001
- **Wallet Service**: http://localhost:3002
- **Transaction Service**: http://localhost:3003
- **Admin Service**: http://localhost:3004
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Shared Libraries

The platform uses four shared libraries to eliminate code duplication:

### 1. @platform/common-auth
Authentication and authorization utilities:
- JWT token generation/verification
- Password hashing with bcrypt
- Express middleware (authenticateJWT, requireRoles, optionalAuth)
- Role-based access control (RBAC)

**Location**: `libraries/common-auth/`

**Usage**:
```typescript
import { JwtService, authenticateJWT, requireRoles } from '@platform/common-auth';

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET,
  expiresIn: '15m'
});

app.use(authenticateJWT(jwtService));
app.post('/admin', requireRoles('admin'), handler);
```

### 2. @platform/common-db
Database utilities and patterns:
- Connection pooling
- Transaction support
- Migration runner
- Base repository pattern for CRUD operations

**Location**: `libraries/common-db/`

**Usage**:
```typescript
import { createDatabaseConnection, BaseRepository } from '@platform/common-db';

const db = createDatabaseConnection({
  connectionString: process.env.DATABASE_URL
}, 'my-service');

await db.transaction(async (client) => {
  // Your transactional queries
});
```

### 3. @platform/common-events
Event bus integration with Kafka:
- EventProducer for publishing events
- EventConsumer for subscribing to events
- Type-safe event schemas
- Predefined event types for all services

**Location**: `libraries/common-events/`

**Usage**:
```typescript
import { EventProducer, EventTypes } from '@platform/common-events';

const producer = new EventProducer({
  brokers: ['kafka:9092'],
  serviceName: 'my-service'
});

await producer.publish('user-events', EventTypes.USER_REGISTERED, {
  userId: '123',
  email: 'user@example.com'
});
```

### 4. @platform/common-utils
General utilities:
- Winston logger factory
- Standard error classes (BadRequestError, NotFoundError, etc.)
- Express validators (email, UUID, phone, etc.)
- HTTP client with retry logic

**Location**: `libraries/common-utils/`

**Usage**:
```typescript
import { createLogger, BadRequestError, validators } from '@platform/common-utils';

const logger = createLogger({ serviceName: 'my-service' });
logger.info('Service started');

// In routes
app.post('/users', validators.email('email'), async (req, res) => {
  if (!req.body.name) {
    throw new BadRequestError('Name is required');
  }
});
```

## Event Bus (Kafka)

### Predefined Event Types

```typescript
export const EventTypes = {
  // Identity Service
  USER_REGISTERED: 'identity.user.registered',
  USER_VERIFIED: 'identity.user.verified',
  USER_UPDATED: 'identity.user.updated',
  
  // Wallet Service  
  WALLET_CREATED: 'wallet.created',
  WALLET_CREDITED: 'wallet.credited',
  WALLET_DEBITED: 'wallet.debited',
  
  // Transaction Service
  TRANSACTION_INITIATED: 'transaction.initiated',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  
  // Admin Service
  TICKET_CREATED: 'admin.ticket.created',
  TICKET_RESOLVED: 'admin.ticket.resolved',
};
```

### Publishing Events

```typescript
import { EventProducer } from '@platform/common-events';

const producer = new EventProducer({
  brokers: [process.env.KAFKA_BROKERS],
  serviceName: 'identity-service'
});

await producer.connect();

// Publish event
await producer.publish('user-events', 'identity.user.registered', {
  userId: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName
});
```

### Consuming Events

```typescript
import { EventConsumer } from '@platform/common-events';

const consumer = new EventConsumer({
  brokers: [process.env.KAFKA_BROKERS],
  serviceName: 'wallet-service',
  groupId: 'wallet-service-group',
  topics: ['user-events']
});

// Register handler
consumer.on('identity.user.registered', async (event) => {
  console.log('User registered:', event.data);
  // Create wallet for new user
});

await consumer.connect();
await consumer.start();
```

## Caching (Redis)

Redis is available for caching frequently accessed data:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD
});

// Cache wallet balance
await redis.setex(`wallet:${walletId}:balance`, 300, balance);

// Get cached balance
const cachedBalance = await redis.get(`wallet:${walletId}:balance`);
```

## Database Migrations

See [scripts/MIGRATIONS_README.md](scripts/MIGRATIONS_README.md) for detailed migration documentation.

### Quick Reference

```bash
# Run all migrations
./scripts/migrate-all.sh

# Run specific service
ts-node scripts/run-migrations.ts --service=identity-service

# Check applied migrations
psql -h localhost -U postgres -d identity_service -c "SELECT * FROM schema_migrations;"
```

## API Gateway (Kong)

Kong is configured with the following features:

### Routing
- All services accessible through `/api/v1/[service]/[endpoint]`
- Identity Service: `/api/v1/identity/*`
- Wallet Service: `/api/v1/wallet/*`
- Transaction Service: `/api/v1/transactions/*`
- Admin Service: `/api/v1/admin/*`

### Security
- JWT validation on protected routes
- Rate limiting (public: 20/min, protected: 100/min, admin: 200/min)
- CORS enabled with configurable origins

### Monitoring
- Prometheus plugin for metrics
- Request/response logging
- Health check endpoints

Configuration: [gateway/kong.yml](gateway/kong.yml)

## Service Dependencies

```
Identity Service (no dependencies)
    ↓
Wallet Service (depends on Identity Service for user_id)
    ↓
Transaction Service (depends on Wallet Service)
    ↓
Admin Service (depends on Identity Service and Wallet Service)
```

## Environment Variables

### Required for All Services
```bash
NODE_ENV=development
PORT=300X
HOST=0.0.0.0
DB_HOST=service-db
DB_PORT=5432
DB_NAME=service_name
DB_USER=postgres
DB_PASSWORD=password
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=service-name
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
```

### Service-Specific

**Identity Service**:
```bash
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d
```

**Wallet Service**:
```bash
DEFAULT_WALLET_PROVIDER=providus
PROVIDUS_BASE_URL=https://api.xpresswallet.com
PROVIDUS_USE_SANDBOX=true
PROVIDUS_CLIENT_ID=your-client-id
PROVIDUS_CLIENT_SECRET=your-client-secret
```

## Monitoring

### Prometheus Metrics

Access Prometheus at http://localhost:9090

Available metrics:
- HTTP request duration
- Request count by status code
- Database connection pool stats
- Kafka producer/consumer metrics
- Custom business metrics

### Grafana Dashboards

Access Grafana at http://localhost:3000 (admin/admin)

Pre-configured dashboards:
- API Gateway Overview
- Service Health
- Database Performance
- Kafka Metrics

## Troubleshooting

### Services won't start
```bash
# Check logs
docker-compose logs [service-name]

# Rebuild containers
docker-compose build --no-cache [service-name]
docker-compose up -d
```

### Database connection errors
```bash
# Check database is running
docker ps | grep postgres

# Test connection
psql -h localhost -U postgres -d identity_service

# Reset database
docker-compose down -v
docker-compose up -d
./scripts/migrate-all.sh
```

### Kafka connection errors
```bash
# Check Kafka is running
docker-compose logs kafka zookeeper

# Restart Kafka
docker-compose restart kafka zookeeper
```

### Migration errors
```bash
# Check migration logs
ts-node scripts/run-migrations.ts --service=identity-service 2>&1 | tee migration.log

# Manually check schema
psql -h localhost -U postgres -d identity_service -c "\dt"
```

## Development Workflow

1. **Start infrastructure**: `docker-compose up -d kafka redis postgres`
2. **Run migrations**: `./scripts/migrate-all.sh`
3. **Start service locally**: `cd services/identity-service && npm run dev`
4. **Make changes and test**
5. **Create new migration** if schema changes
6. **Run tests**: `npm test`
7. **Commit and push**

## Production Considerations

1. **Security**:
   - Change all default passwords
   - Use secrets management (AWS Secrets Manager, Vault)
   - Enable SSL/TLS for all services
   - Configure proper CORS origins

2. **Scalability**:
   - Increase Kafka partitions for high throughput
   - Scale services horizontally with load balancer
   - Use Redis Cluster for caching
   - Implement read replicas for databases

3. **Reliability**:
   - Set up database backups
   - Configure health checks and auto-restart
   - Implement circuit breakers
   - Add request timeouts

4. **Monitoring**:
   - Set up alerting in Grafana
   - Configure log aggregation (ELK stack)
   - Enable distributed tracing (Jaeger)
   - Monitor resource usage

## Additional Resources

- [API Gateway Documentation](gateway/README.md)
- [Migration Guide](scripts/MIGRATIONS_README.md)
- [Shared Libraries Documentation](libraries/README.md)
- [Provider Integration Guide](services/wallet-service/PROVIDER_INTEGRATION.md)
