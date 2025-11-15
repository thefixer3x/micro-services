#!/bin/bash

# Docker migration script
# This script runs migrations inside Docker containers

set -e

SERVICE_NAME=$1

if [ -z "$SERVICE_NAME" ]; then
  echo "Error: Service name is required"
  echo "Usage: ./docker-migrate.sh <service-name>"
  echo "Example: ./docker-migrate.sh identity-service"
  exit 1
fi

echo "Running migrations for $SERVICE_NAME in Docker..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Run migrations using the migration runner
cd /app
npm install --silent pg @types/node @types/pg ts-node typescript 2>/dev/null || true
npx ts-node /app/scripts/run-migrations.ts --service=$SERVICE_NAME

echo "Migrations completed for $SERVICE_NAME"
