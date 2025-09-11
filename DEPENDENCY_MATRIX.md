# Service Dependency Matrix & Build Plan

## 🔗 Dependency Matrix

### Service Dependencies Chart

| Service | Depends On | Called By | Can Deploy Independently |
|---------|------------|-----------|--------------------------|
| **Identity Service** | None | Wallet, Transaction, Admin | ✅ Yes (Foundation) |
| **Wallet Service** | Identity | Transaction, Admin | ✅ Yes (after Identity) |
| **Transaction Service** | Identity, Wallet | Admin | ✅ Yes (after Wallet) |
| **Admin Service** | Identity, Wallet, Transaction | None | ✅ Yes (after core services) |
| **Notification Service** | None (Event Bus only) | None | ✅ Yes (anytime) |
| **Compliance Service** | Identity, Transaction | Admin | ✅ Yes (Phase 2) |
| **Analytics Service** | All (read-only) | Admin | ✅ Yes (Phase 2) |
| **Ledger Service** | Transaction, Wallet | Admin | ✅ Yes (Phase 2) |

### Dependency Types

1. **Hard Dependencies** (Service won't function without)
   - Wallet → Identity (user authentication)
   - Transaction → Identity & Wallet (auth & balance checks)
   - Admin → All user services (management functions)

2. **Soft Dependencies** (Degraded functionality)
   - All Services → Notification (alerts won't send)
   - Transaction → Compliance (risk checks disabled)

3. **Data Dependencies** (Read-only access)
   - Analytics → All services (reporting)
   - Admin → All services (monitoring)

## 📊 Inter-Service Communication

```
┌─────────────┐
│  Identity   │ ◄──── Foundation (No dependencies)
└─────┬───────┘
      │ Validates users
      ▼
┌─────────────┐
│   Wallet    │ ◄──── Depends on Identity for user validation
└─────┬───────┘
      │ Manages balances
      ▼
┌─────────────┐
│ Transaction │ ◄──── Depends on Identity + Wallet
└─────┬───────┘
      │ Processes payments
      ▼
┌─────────────┐
│    Admin    │ ◄──── Orchestrates all services
└─────────────┘
```

## 🏗️ Phased Build Plan

### Phase 1: Foundation (Week 1-2)
**Goal**: Basic user management and authentication

#### Week 1: Identity Service
- [ ] Database schema setup
- [ ] Basic CRUD APIs
- [ ] JWT authentication
- [ ] User registration flow
- [ ] Basic KYC upload
- [ ] Unit tests

#### Week 2: API Gateway & Common Libraries
- [ ] Setup Kong/Nginx gateway
- [ ] Common auth library
- [ ] Event bus setup (Kafka/RabbitMQ)
- [ ] Shared utilities
- [ ] Integration tests

**Deliverable**: Users can register and authenticate

---

### Phase 2: Core Financial Services (Week 3-4)
**Goal**: Basic wallet and transaction capabilities

#### Week 3: Wallet Service
- [ ] Database schema
- [ ] Wallet creation on user registration
- [ ] Balance management APIs
- [ ] Multi-currency support
- [ ] Virtual card stub
- [ ] Integration with Identity

#### Week 4: Transaction Service (Basic)
- [ ] Database schema
- [ ] Domestic transfer API
- [ ] Balance validation
- [ ] Transaction status tracking
- [ ] Basic fee calculation
- [ ] Integration tests

**Deliverable**: Users can create wallets and make basic transfers

---

### Phase 3: Operations & Support (Week 5-6)
**Goal**: Admin capabilities and customer support

#### Week 5: Admin Service
- [ ] Database schema
- [ ] Admin authentication
- [ ] Customer 360 view
- [ ] Basic ticket system
- [ ] Account management APIs
- [ ] Role-based access

#### Week 6: Notification Service
- [ ] Event consumer setup
- [ ] Email integration
- [ ] SMS integration
- [ ] In-app notifications
- [ ] Template management
- [ ] Delivery tracking

**Deliverable**: Admins can manage users and send notifications

---

### Phase 4: Enhanced Features (Week 7-8)
**Goal**: International transfers and compliance

#### Week 7: Transaction Service (Enhanced)
- [ ] International remittance
- [ ] Exchange rate integration
- [ ] Partner API integration
- [ ] Settlement processing
- [ ] Advanced routing

#### Week 8: Compliance Service (Basic)
- [ ] KYC verification workflow
- [ ] Transaction monitoring
- [ ] Risk scoring
- [ ] Sanctions screening stub
- [ ] Basic AML rules

**Deliverable**: Full payment capabilities with basic compliance

---

### Phase 5: Analytics & Accounting (Week 9-10)
**Goal**: Reporting and financial management

#### Week 9: Analytics Service
- [ ] Data warehouse setup
- [ ] ETL pipelines
- [ ] Basic dashboards
- [ ] Transaction reports
- [ ] Customer reports
- [ ] Revenue reports

#### Week 10: Ledger Service
- [ ] Double-entry setup
- [ ] Journal entries
- [ ] Account reconciliation
- [ ] Financial statements
- [ ] Audit trail

**Deliverable**: Complete financial reporting and accounting

---

### Phase 6: Production Readiness (Week 11-12)
**Goal**: Security, performance, and deployment

#### Week 11: Security & Performance
- [ ] Security audit
- [ ] Performance testing
- [ ] Load testing
- [ ] Penetration testing
- [ ] Monitoring setup
- [ ] Alerting rules

#### Week 12: Deployment & Documentation
- [ ] CI/CD pipeline
- [ ] Kubernetes configs
- [ ] API documentation
- [ ] Runbooks
- [ ] Disaster recovery
- [ ] Launch preparation

**Deliverable**: Production-ready microservices platform

## 🚀 Deployment Order

### Environment Setup Order:
1. **Infrastructure**: Database, Message Bus, Cache
2. **Identity Service**: No dependencies
3. **Notification Service**: Can deploy anytime
4. **Wallet Service**: After Identity
5. **Transaction Service**: After Wallet
6. **Admin Service**: After core services
7. **Compliance Service**: After Transaction
8. **Analytics Service**: After data accumulation
9. **Ledger Service**: Last (requires all financial services)

### Rollback Strategy:
- Each service can be rolled back independently
- Database migrations must be backward compatible
- Event schema changes need versioning
- API versioning for breaking changes

## 📋 Development Guidelines

1. **Service Isolation**
   - No shared databases
   - Communication only via APIs/events
   - Own your data

2. **API Design**
   - RESTful APIs with OpenAPI specs
   - Consistent error responses
   - Pagination for list endpoints
   - Rate limiting

3. **Event Design**
   - Schema registry for events
   - Event versioning
   - Idempotent consumers
   - Dead letter queues

4. **Testing Strategy**
   - Unit tests: 80% coverage minimum
   - Integration tests for APIs
   - Contract tests between services
   - End-to-end tests for critical flows

5. **Monitoring**
   - Health endpoints
   - Metrics endpoints
   - Distributed tracing
   - Centralized logging
