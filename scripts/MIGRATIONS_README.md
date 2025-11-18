# Database Migrations

This directory contains database migration scripts and utilities for all microservices.

## Overview

Each service has its own set of migrations located in:
- `services/identity-service/migrations/`
- `services/wallet-service/migrations/`
- `services/admin-service/migrations/`
- `services/transaction-service/migrations/`

## Migration Naming Convention

Migrations follow this naming pattern:
```
XXX_description.sql
```

Where:
- `XXX` is a zero-padded version number (001, 002, etc.)
- `description` is a snake_case description of the migration

Examples:
- `001_initial_schema.sql`
- `002_add_user_preferences.sql`
- `003_update_wallet_constraints.sql`

## Running Migrations

### Run All Services

To run migrations for all services at once:

```bash
./scripts/migrate-all.sh
```

### Run Specific Service

To run migrations for a specific service:

```bash
ts-node scripts/run-migrations.ts --service=identity-service
ts-node scripts/run-migrations.ts --service=wallet-service
ts-node scripts/run-migrations.ts --service=admin-service
ts-node scripts/run-migrations.ts --service=transaction-service
```

### Run in Docker

Migrations are automatically run when services start in Docker.

To manually run migrations in Docker:

```bash
docker exec -it identity-service /bin/sh -c "./scripts/docker-migrate.sh identity-service"
docker exec -it wallet-service /bin/sh -c "./scripts/docker-migrate.sh wallet-service"
docker exec -it admin-service /bin/sh -c "./scripts/docker-migrate.sh admin-service"
docker exec -it transaction-service /bin/sh -c "./scripts/docker-migrate.sh transaction-service"
```

## Environment Variables

Each service needs a `DATABASE_URL` environment variable:

```bash
# Identity Service
export DATABASE_URL="postgresql://postgres:password@localhost:5432/identity_service"

# Wallet Service
export DATABASE_URL="postgresql://postgres:password@localhost:5432/wallet_service"

# Admin Service
export DATABASE_URL="postgresql://postgres:password@localhost:5432/admin_service"

# Transaction Service
export DATABASE_URL="postgresql://postgres:password@localhost:5432/transaction_service"
```

## Creating New Migrations

1. **Determine the next version number** by checking existing migrations
2. **Create a new SQL file** with the naming convention
3. **Write your migration SQL** following these guidelines:
   - Use `CREATE TABLE IF NOT EXISTS` for safety
   - Include proper indexes
   - Add comments for complex logic
   - Use transactions for multi-statement migrations
   - Include rollback logic in comments

Example migration template:

```sql
-- Service Name Migration
-- Version: XXX
-- Description: Description of changes

-- Your migration SQL here
CREATE TABLE IF NOT EXISTS my_new_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_my_new_table_name ON my_new_table(name);

-- Record migration
INSERT INTO schema_migrations (version, name) 
VALUES ('XXX', 'description_of_migration')
ON CONFLICT (version) DO NOTHING;
```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table in each database:

```sql
CREATE TABLE schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

To check applied migrations:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

## Best Practices

1. **Never modify existing migrations** - Create new ones instead
2. **Test migrations locally** before deploying
3. **Make migrations idempotent** - Use `IF NOT EXISTS`, `IF EXISTS`, etc.
4. **Keep migrations small** - One logical change per migration
5. **Use transactions** - Wrap multiple statements in BEGIN/COMMIT
6. **Document complex changes** - Add comments explaining why
7. **Add proper indexes** - Don't forget performance implications
8. **Handle data migrations carefully** - Consider backwards compatibility

## Rollback

Currently, rollbacks must be done manually. To rollback:

1. Create a new migration that reverses the changes
2. Or manually execute SQL to undo changes
3. Delete the record from `schema_migrations` table

Example rollback migration:

```sql
-- Rollback for migration 003_add_user_preferences

DROP TABLE IF EXISTS user_preferences CASCADE;

DELETE FROM schema_migrations WHERE version = '003';
```

## Troubleshooting

### Migration fails partway through

If a migration fails, the transaction will be rolled back automatically. Fix the issue and run migrations again.

### Migrations not running in Docker

1. Check container logs: `docker logs <service-name>`
2. Verify DATABASE_URL is set correctly
3. Ensure database is healthy: `docker ps`
4. Check migration files exist in the container

### Database connection errors

1. Verify database is running: `docker ps | grep postgres`
2. Check database credentials in docker-compose.yml
3. Test connection: `psql -h localhost -U postgres -d identity_service`

## Service-Specific Notes

### Identity Service
- Tables: users, user_profiles, kyc_documents, biometric_data, refresh_tokens
- Dependencies: None

### Wallet Service
- Tables: customers, wallets, transactions, virtual_cards, provider_credentials, balance_history
- Dependencies: Identity Service (user_id references)
- Custom Types: wallet_provider, wallet_type, wallet_status, transaction_status, etc.

### Admin Service
- Tables: support_tickets, ticket_messages, audit_logs, system_settings
- Dependencies: Identity Service (customer_id, admin_user_id references)

### Transaction Service
- Tables: transactions, transaction_logs, transaction_reconciliations, webhook_events
- Dependencies: Wallet Service (wallet_id references)
- Custom Types: transaction_type, transaction_status, transaction_direction
