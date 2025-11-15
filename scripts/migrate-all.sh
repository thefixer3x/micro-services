#!/bin/bash

# Migration script for all microservices
# This script runs database migrations for all services

set -e

echo "==================================="
echo "Running Database Migrations"
echo "==================================="
echo ""

SERVICES=("identity-service" "wallet-service" "admin-service" "transaction-service")

for SERVICE in "${SERVICES[@]}"; do
  echo "-----------------------------------"
  echo "Migrating: $SERVICE"
  echo "-----------------------------------"
  
  # Set service-specific database URL
  case $SERVICE in
    "identity-service")
      export DATABASE_URL="postgresql://postgres:password@localhost:5432/identity_service"
      ;;
    "wallet-service")
      export DATABASE_URL="postgresql://postgres:password@localhost:5432/wallet_service"
      ;;
    "admin-service")
      export DATABASE_URL="postgresql://postgres:password@localhost:5432/admin_service"
      ;;
    "transaction-service")
      export DATABASE_URL="postgresql://postgres:password@localhost:5432/transaction_service"
      ;;
  esac
  
  # Run migrations
  ts-node scripts/run-migrations.ts --service=$SERVICE
  
  echo ""
done

echo "==================================="
echo "All migrations completed!"
echo "==================================="
