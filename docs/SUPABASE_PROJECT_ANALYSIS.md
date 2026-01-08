# Supabase Project Analysis

**Project:** the-fixer-initiative

## Environment Toggle

| DATABASE_ENV | Database | Usage |
|--------------|----------|-------|
| `dev` | Neon | Local development |
| `staging` | Neon | Test/staging |
| `production` | Supabase | Live production |

**Same schema deployed to both** - toggle via `DATABASE_ENV` environment variable.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
└──────────────┬──────────────┬──────────────┬───────────────────┘
               │              │              │
       ┌───────▼───────┐ ┌────▼────┐ ┌──────▼──────┐
       │ Wallet Service│ │Verify   │ │ Auth        │
       │ /api/wallet/* │ │Service  │ │ Gateway     │
       └───────┬───────┘ │/api/    │ │/api/auth/*  │
               │         │verify/* │ └──────┬──────┘
               │         └────┬────┘        │
               ▼              ▼             ▼
       ┌─────────────────────────────────────────────┐
       │           DATABASE_ENV Toggle               │
       │  ┌─────────────┐      ┌─────────────┐      │
       │  │ Neon        │      │ Supabase    │      │
       │  │ (dev/test)  │  OR  │ (production)│      │
       │  └─────────────┘      └─────────────┘      │
       └─────────────────────────────────────────────┘
```

---

## Current State Overview

### Tables by Category

#### 1. **Wallet Service Tables** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `customers` | ✅ Created | 17 columns, RLS enabled |
| `wallets` | ✅ Created | 16 columns, RLS enabled |
| `transactions` | ✅ Created | 24 columns, RLS enabled |
| `beneficiaries` | ✅ Existed | 9 columns |
| `virtual_cards` | ✅ Existed | Basic structure for card management |

#### 2. **Authentication & OAuth Tables** ✅ EXISTS (auth_gateway schema)
| Table | Schema | Status |
|-------|--------|--------|
| `oauth_clients` | auth_gateway | ✅ OAuth client registrations |
| `oauth_tokens` | auth_gateway | ✅ Access/refresh token storage |
| `oauth_authorization_codes` | auth_gateway | ✅ Auth code flow |
| `oauth_sessions` | auth_gateway | ✅ Session management |
| `oauth_audit_log` | auth_gateway | ✅ Audit trail |
| `auth_events` | auth_gateway | ✅ Auth event logging |
| `sessions` | auth_gateway | ✅ General sessions |
| `user_sessions` | auth_gateway | ✅ User-specific sessions |

#### 3. **API Key Management** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `api_keys` | ✅ | Main API key storage |
| `api_key_projects` | ✅ | Project associations |
| `api_key_scopes` | ✅ | Permission scopes |
| `key_rotation_policies` | ✅ | Key rotation |
| `key_security_events` | ✅ | Security audit |
| `vendor_api_keys` | ✅ | External vendor keys |
| `vendor_api_keys_v2` | ✅ | V2 vendor key format |

#### 4. **MCP (Model Context Protocol)** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `mcp_service_catalog` | ✅ | Available MCP services |
| `mcp_rate_limits` | ✅ | Rate limiting config |
| `mcp_proxy_tokens` | ✅ | Proxy authentication |
| `mcp_process_pool` | ✅ | Process management |
| `mcp_key_sessions` | ✅ | MCP session tracking |
| `mcp_key_tools` | ✅ | Tool registrations |
| `mcp_key_access_requests` | ✅ | Access request logging |
| `user_mcp_services` | ✅ | User service associations |

#### 5. **Memory & AI** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `agent_banks_memories` | ✅ | Memory storage |
| `agent_banks_sessions` | ✅ | Agent sessions |
| `memory_chunks` | ✅ | Chunked memory |
| `memory_versions` | ✅ | Version history |
| `memory_access_patterns` | ✅ | Access analytics |
| `predictive_memory_suggestions` | ✅ | AI suggestions |
| `intelligence_cache` | ✅ | AI response cache |
| `ai_response_cache` | ✅ | General AI cache |
| `smart_recall_history` | ✅ | Recall tracking |
| `smart_recall_schedule` | ✅ | Scheduled recalls |
| `screenshot_memories` | ✅ | Visual memories |
| `voice_memories` | ✅ | Voice recordings |

#### 6. **Business & Analytics** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `business_profiles` | ✅ | Business info |
| `business_metrics` | ✅ | KPIs |
| `business_financial_insights` | ✅ | Financial analysis |
| `pricing_insights` | ✅ | Pricing data |
| `risk_analysis` | ✅ | Risk assessment |

#### 7. **User Management** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `profiles` | ✅ | User profiles |
| `user_preferences` | ✅ | Settings |
| `user_tiers` | ✅ | Subscription tiers |
| `user_roles` | ✅ | RBAC roles |
| `user_consents` | ✅ | Consent tracking |
| `user_config` | ✅ | Configuration |
| `teams` | ✅ | Team management |
| `team_members` | ✅ | Team membership |
| `team_shared_memories` | ✅ | Shared content |
| `organizations` | ✅ | Org structure |

#### 8. **E-Document & Compliance** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `edoc_consents` | ✅ | Document consent |
| `edoc_transactions` | ✅ | Doc transactions |
| `edoc_financial_analysis` | ✅ | Financial docs |

#### 9. **Expert Marketplace** ✅ EXISTS
| Table | Status | Notes |
|-------|--------|-------|
| `expert_sessions` | ✅ | Expert consultations |

---

## What Wallet Service Needs vs What Exists

### ✅ Already Exists - Can Use Directly
1. **Core Wallet Tables** - `customers`, `wallets`, `transactions`, `beneficiaries`
2. **Virtual Cards** - `virtual_cards` (basic structure)
3. **User Management** - `profiles`, `user_preferences`
4. **API Keys** - `api_keys`, `api_key_scopes`
5. **OAuth** - Full auth_gateway schema

### ⚠️ Exists but May Need Enhancement
| Component | Current | Enhancement Needed |
|-----------|---------|-------------------|
| `virtual_cards` | Basic 9 columns | Need: spending_limit, card_brand, expiry, billing_address |
| `transactions` | Created new | Already complete with 24 columns |

### ❌ Needs Development (External Dependencies)

#### 1. **Payment Provider Integrations**
| Provider | Type | Status |
|----------|------|--------|
| Providus Bank | Wallet/Transfer | ✅ Implemented in code |
| Flutterwave | Payment Gateway | ❌ Needs provider implementation |
| Paystack | Payment Gateway | ❌ Needs provider implementation |
| Stripe | Cards/International | ❌ Needs provider implementation |

#### 2. **Verification Service** (REST API)
| Endpoint | Type | Status |
|----------|------|--------|
| `POST /api/verify/identity` | Passport/NIN/BVN | ✅ Schema ready (Neon dev) |
| `POST /api/verify/business` | CAC/TIN | ✅ Schema ready (Neon dev) |
| `POST /api/verify/phone` | SMS/Voice OTP | ✅ Schema ready (Neon dev) |
| `POST /api/verify/address` | Utility/Bank docs | ✅ Schema ready (Neon dev) |
| `POST /api/verify/biometric` | Face/Liveness | ✅ Schema ready (Neon dev) |
| `GET /api/verify/status/:userId` | Aggregated status | ✅ Schema ready (Neon dev) |

**Production:** Deploy verification tables to Supabase + expose via REST API

#### 3. **Webhook Infrastructure**
- ❌ Webhook processing queue
- ❌ Webhook retry logic
- ❌ Provider webhook handlers

---

## Database Schema Relationships

```
┌─────────────────┐     ┌─────────────────┐
│    profiles     │────▶│   customers     │
│   (Supabase)    │     │ (Wallet Service)│
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    wallets      │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
           ┌────────────┐ ┌────────────┐ ┌─────────────┐
           │transactions│ │beneficiaries│ │virtual_cards│
           └────────────┘ └────────────┘ └─────────────┘
```

---

## Integration Points

### 1. **Supabase Auth → Wallet Service**
```typescript
// User creates account via Supabase Auth
// → Triggers function to create wallet customer
// → Returns customerId for wallet operations
```

### 2. **MCP Service → Wallet Service**
```typescript
// MCP client connects with API key
// → Validates via api_keys table
// → Routes to wallet service endpoints
```

### 3. **OAuth Gateway → Services**
```typescript
// OAuth flow via auth_gateway schema
// → Issues JWT tokens
// → Services validate against Supabase
```

---

## Recommended Next Steps

### Phase 1: Complete Wallet Service
1. ✅ Database migrations created (Supabase)
2. ✅ TypeScript types generated
3. ✅ Unit tests (21 ProvidusProvider tests)
4. ✅ Integration tests (13 Supabase tests)
5. ❌ Run wallet migrations against Neon (dev parity)
6. ❌ Run verification migrations against Supabase (prod parity)

### Phase 2: Payment Providers
1. ❌ Implement Flutterwave provider
2. ❌ Implement Paystack provider
3. ❌ Implement Stripe provider
4. ❌ Add provider routing logic

### Phase 3: Verification Service (REST API)
1. ✅ Verification schema exists (12 tables, 10 enums in Neon)
2. ❌ Run verification migrations against Supabase (same schema)
3. ❌ Create verification REST API endpoints
4. ❌ Wallet service calls `/api/verify/status` for KYC checks
5. ❌ Toggle works: dev→Neon, prod→Supabase

### Phase 4: Production Readiness
1. ❌ Webhook infrastructure
2. ❌ Rate limiting
3. ❌ Monitoring & alerting
4. ❌ Load testing

---

## Testing Strategy

### Unit Tests (34 total)
- ✅ ProvidusProvider - 21 tests (Mock HTTP responses)
- ⏳ WalletService - Mock database
- ❌ Controller tests - Mock service layer

### Integration Tests (13 total)
- ✅ Supabase CRUD - customers, wallets, transactions
- ❌ Against Providus sandbox
- ❌ End-to-end transaction flow

### Load Tests
- ❌ Transaction throughput
- ❌ Balance query performance
- ❌ Concurrent transfer handling
