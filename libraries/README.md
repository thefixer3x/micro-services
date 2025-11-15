# Shared Libraries

This directory contains shared libraries used across all microservices in the platform. These libraries eliminate code duplication and ensure consistency across services.

## 📦 Libraries

| Library | Purpose | Version |
|---------|---------|---------|
| **common-auth** | JWT authentication & authorization | 1.0.0 |
| **common-db** | Database utilities & migrations | 1.0.0 |
| **common-events** | Event bus & Kafka integration | 1.0.0 |
| **common-utils** | Logging, errors, validators, HTTP client | 1.0.0 |

---

## 🔐 common-auth

Authentication and authorization utilities for all services.

### Installation

```bash
cd libraries/common-auth
npm install
npm run build
```

### Features

- JWT token generation and validation
- Express middleware for authentication
- Role-based access control
- Password hashing and validation

### Usage Examples

#### JWT Service

```typescript
import { JwtService, TokenPayload } from '@platform/common-auth';

// Create JWT service
const jwtService = new JwtService({
  secret: process.env.JWT_SECRET,
  expiresIn: '15m',
  issuer: 'identity-service',
});

// Generate token
const payload: TokenPayload = {
  userId: 'user-123',
  email: 'user@example.com',
  roles: ['user'],
};
const token = jwtService.generateToken(payload);

// Verify token
try {
  const decoded = jwtService.verifyToken(token);
  console.log('User ID:', decoded.userId);
} catch (error) {
  console.error('Invalid token:', error.message);
}

// Refresh token
const newToken = jwtService.refreshToken(oldToken);
```

#### Authentication Middleware

```typescript
import { authenticateJWT, requireRoles } from '@platform/common-auth';
import express from 'express';

const app = express();

// Initialize JWT service (once)
const jwtService = new JwtService({ secret: process.env.JWT_SECRET });

// Public route (no auth)
app.get('/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

// Protected route (auth required)
app.get('/protected', authenticateJWT(jwtService), (req, res) => {
  const user = (req as any).user;
  res.json({ message: `Hello ${user.email}` });
});

// Admin-only route
app.get(
  '/admin',
  authenticateJWT(jwtService),
  requireRoles('admin'),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);
```

#### Password Service

```typescript
import { PasswordService } from '@platform/common-auth';

const passwordService = new PasswordService(12); // 12 rounds

// Hash password
const hashedPassword = await passwordService.hashPassword('MySecurePass123!');

// Compare password
const isValid = await passwordService.comparePassword(
  'MySecurePass123!',
  hashedPassword
);

// Validate password strength
const validation = passwordService.validatePasswordStrength('weak');
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
}
```

---

## 🗄️ common-db

Database utilities, connection pooling, and migration management.

### Installation

```bash
cd libraries/common-db
npm install
npm run build
```

### Features

- Database connection pooling
- Transaction support
- Migration runner
- Base repository pattern

### Usage Examples

#### Database Connection

```typescript
import { createDatabaseConnection } from '@platform/common-db';

const db = createDatabaseConnection(
  {
    connectionString: process.env.DATABASE_URL,
    max: 20,
  },
  'my-service'
);

// Test connection
await db.testConnection();

// Execute query
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
const newUser = await db.transaction(async (client) => {
  const user = await client.query('INSERT INTO users ...');
  const wallet = await client.query('INSERT INTO wallets ...');
  return user.rows[0];
});

// Get pool stats
console.log(db.getStats());
```

#### Migrations

```typescript
import { MigrationRunner } from '@platform/common-db';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runner = new MigrationRunner(pool);

// Load migrations from directory
const migrations = await MigrationRunner.loadMigrationsFromDirectory(
  './migrations'
);

// Run migrations
await runner.runMigrations(migrations);
```

**Migration File Format** (`migrations/001_create_users.sql`):

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

#### Repository Pattern

```typescript
import { BaseRepository } from '@platform/common-db';
import { Pool } from 'pg';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

class UserRepository extends BaseRepository<User> {
  constructor(pool: Pool) {
    super(pool, 'users');
  }

  // Custom method
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }
}

// Usage
const userRepo = new UserRepository(pool);

const user = await userRepo.findById('user-123');
const allUsers = await userRepo.findAll({ status: 'active' }, 50);
const newUser = await userRepo.create({ email: 'user@example.com', ... });
await userRepo.update('user-123', { firstName: 'John' });
await userRepo.delete('user-123');
```

---

## 📡 common-events

Event bus integration with Kafka for async service communication.

### Installation

```bash
cd libraries/common-events
npm install
npm run build
```

### Features

- Event producer (publish events)
- Event consumer (subscribe to events)
- Predefined event schemas
- Type-safe event handling

### Usage Examples

#### Event Producer

```typescript
import { EventProducer, EventTypes } from '@platform/common-events';

const producer = new EventProducer({
  brokers: ['localhost:9092'],
  clientId: 'identity-service',
  serviceName: 'identity-service',
});

await producer.connect();

// Publish an event
await producer.publish(
  'user-events', // topic
  EventTypes.USER_REGISTERED, // event type
  {
    userId: 'user-123',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
  },
  { source: 'web-app' } // optional metadata
);

// Publish batch
await producer.publishBatch('wallet-events', [
  {
    eventType: EventTypes.WALLET_CREATED,
    data: { walletId: 'w1', customerId: 'c1', ... },
  },
  {
    eventType: EventTypes.BALANCE_UPDATED,
    data: { walletId: 'w1', newBalance: 100, ... },
  },
]);

await producer.disconnect();
```

#### Event Consumer

```typescript
import { EventConsumer, EventTypes, EventPayload } from '@platform/common-events';

const consumer = new EventConsumer({
  brokers: ['localhost:9092'],
  groupId: 'wallet-service-group',
  clientId: 'wallet-service',
  serviceName: 'wallet-service',
});

await consumer.connect();
await consumer.subscribe(['user-events', 'transaction-events']);

// Register event handlers
consumer.on(EventTypes.USER_REGISTERED, async (event: EventPayload) => {
  console.log('User registered:', event.data);

  // Create wallet for new user
  await createWalletForUser(event.data.userId);
});

consumer.on(EventTypes.TRANSACTION_COMPLETED, async (event: EventPayload) => {
  console.log('Transaction completed:', event.data);

  // Update wallet balance
  await updateWalletBalance(event.data);
});

// Start consuming
await consumer.start();
```

#### Event Types

```typescript
import { EventTypes } from '@platform/common-events';

// Identity Service Events
EventTypes.USER_REGISTERED    // 'identity.user.registered'
EventTypes.USER_VERIFIED      // 'identity.user.verified'
EventTypes.USER_UPDATED       // 'identity.user.updated'

// Wallet Service Events
EventTypes.WALLET_CREATED     // 'wallet.created'
EventTypes.BALANCE_UPDATED    // 'wallet.balance.updated'
EventTypes.CARD_ISSUED        // 'wallet.card.issued'

// Transaction Service Events
EventTypes.TRANSACTION_INITIATED   // 'transaction.initiated'
EventTypes.TRANSACTION_COMPLETED   // 'transaction.completed'
EventTypes.SETTLEMENT_COMPLETED    // 'transaction.settlement.completed'

// Admin Service Events
EventTypes.TICKET_CREATED     // 'admin.ticket.created'
EventTypes.ADMIN_ACTION       // 'admin.action'
```

---

## 🛠️ common-utils

General utilities including logging, error handling, validators, and HTTP client.

### Installation

```bash
cd libraries/common-utils
npm install
npm run build
```

### Features

- Winston-based logger
- Standard error classes
- Express validators
- HTTP client with retry logic

### Usage Examples

#### Logger

```typescript
import { createLogger } from '@platform/common-utils';

const logger = createLogger({
  serviceName: 'my-service',
  level: 'info',
  logFile: 'logs/my-service.log',
  consoleOutput: true,
});

logger.info('Service started');
logger.warn('High memory usage', { memory: process.memoryUsage() });
logger.error('Failed to connect', { error: error.message });
logger.debug('Debug information');
```

#### Error Handling

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  errorHandlerMiddleware,
} from '@platform/common-utils';
import express from 'express';

const app = express();

// Route handlers
app.get('/users/:id', async (req, res) => {
  const user = await findUser(req.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json(user);
});

app.post('/users', async (req, res) => {
  if (!req.body.email) {
    throw new BadRequestError('Email is required');
  }

  const user = await createUser(req.body);
  res.status(201).json(user);
});

// Error handler middleware (must be last)
app.use(errorHandlerMiddleware());
```

#### Validators

```typescript
import { validators, validate } from '@platform/common-utils';
import { Router } from 'express';

const router = Router();

router.post(
  '/users',
  [
    validators.requiredString('firstName', 2, 50),
    validators.requiredString('lastName', 2, 50),
    validators.email('email'),
    validators.phoneNumber('phoneNumber'),
    validators.enum('accountType', ['individual', 'business']),
    validate(), // Middleware to check validation results
  ],
  async (req, res) => {
    // If we reach here, validation passed
    const user = await createUser(req.body);
    res.status(201).json(user);
  }
);

router.put(
  '/users/:userId',
  [
    validators.uuid('userId', 'param'),
    validators.optionalString('firstName', 2, 50),
    validators.optionalString('lastName', 2, 50),
    validate(),
  ],
  async (req, res) => {
    const user = await updateUser(req.params.userId, req.body);
    res.json(user);
  }
);
```

#### HTTP Client

```typescript
import { HttpClient } from '@platform/common-utils';

const client = new HttpClient({
  baseURL: 'https://api.example.com',
  timeout: 30000,
  headers: {
    'Authorization': 'Bearer token',
  },
  retries: 3,
});

// GET request
const users = await client.get('/users');

// POST request
const newUser = await client.post('/users', {
  firstName: 'John',
  lastName: 'Doe',
});

// PUT request
const updated = await client.put('/users/123', { status: 'active' });

// DELETE request
await client.delete('/users/123');
```

---

## 🚀 Building Libraries

Build all libraries at once:

```bash
# From the libraries directory
for dir in common-*; do
  cd $dir
  npm install
  npm run build
  cd ..
done
```

Or build individually:

```bash
cd libraries/common-auth && npm install && npm run build
cd libraries/common-db && npm install && npm run build
cd libraries/common-events && npm install && npm run build
cd libraries/common-utils && npm install && npm run build
```

---

## 📝 Using in Services

### Option 1: npm link (Development)

```bash
# In library directory
cd libraries/common-auth
npm link

# In service directory
cd services/identity-service
npm link @platform/common-auth
```

### Option 2: Local path (package.json)

```json
{
  "dependencies": {
    "@platform/common-auth": "file:../../libraries/common-auth",
    "@platform/common-db": "file:../../libraries/common-db",
    "@platform/common-events": "file:../../libraries/common-events",
    "@platform/common-utils": "file:../../libraries/common-utils"
  }
}
```

### Option 3: Workspace (Recommended for monorepo)

Root `package.json`:

```json
{
  "private": true,
  "workspaces": [
    "libraries/*",
    "services/*"
  ]
}
```

Then just `npm install` in the root directory.

---

## 🎯 Best Practices

1. **Version Management**: Update library versions when making breaking changes
2. **Build Before Use**: Always build libraries after making changes
3. **Type Safety**: All libraries are TypeScript with full type definitions
4. **Error Handling**: Use common error classes for consistency
5. **Logging**: Use common logger for uniform log format
6. **Events**: Use predefined event types for type safety
7. **Testing**: Test libraries independently before using in services

---

## 📚 Contributing

When adding new functionality to shared libraries:

1. Add to the appropriate library (or create a new one)
2. Update TypeScript definitions
3. Build the library (`npm run build`)
4. Update this README with usage examples
5. Test in at least one service before committing

---

## 🔗 Dependencies

All libraries use:
- TypeScript 5.2+
- Node.js 18+
- CommonJS module format

Service-specific dependencies are peer dependencies.
