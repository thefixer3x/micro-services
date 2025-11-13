# API Gateway Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Start All Services

```bash
# From the project root directory
docker-compose up -d
```

This will start:
- Kong API Gateway (Port 8000)
- Kong Admin API (Port 8001)
- Kong Manager GUI (Port 8002)
- All 4 microservices
- PostgreSQL databases
- Prometheus (Port 9090)
- Grafana (Port 3000)

### Step 2: Verify Kong is Running

```bash
# Check Kong status
curl http://localhost:8001/status

# Should return:
# {
#   "database": {
#     "reachable": true
#   },
#   ...
# }
```

### Step 3: Test a Public Endpoint

```bash
# Test user registration (no auth required)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }'
```

### Step 4: Get a JWT Token

```bash
# Login to get JWT token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'

# Save the token from the response
# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refreshToken": "...",
#   "user": {...}
# }
```

### Step 5: Test a Protected Endpoint

```bash
# Replace YOUR_JWT_TOKEN with the token from Step 4
curl http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🎯 Common Operations

### Access Gateway Components

| Component | URL | Credentials |
|-----------|-----|-------------|
| Kong Proxy | http://localhost:8000 | - |
| Kong Admin API | http://localhost:8001 | - |
| Kong Manager GUI | http://localhost:8002 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |

### View Logs

```bash
# All services
docker-compose logs -f

# Kong only
docker-compose logs -f kong-gateway

# Specific service
docker-compose logs -f identity-service
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Configuration Management

```bash
# Make the script executable (first time only)
chmod +x gateway/scripts/configure-kong.sh

# View all Kong information
./gateway/scripts/configure-kong.sh all

# Test service health
./gateway/scripts/configure-kong.sh health
```

## 📊 Monitoring

### Prometheus Metrics

Open http://localhost:9090 and try these queries:

```promql
# Request rate per service
rate(kong_http_status[5m])

# Average latency
avg(kong_latency)

# Error rate
rate(kong_http_status{code=~"5.."}[5m])
```

### Grafana Dashboards

1. Open http://localhost:3000
2. Login with `admin/admin`
3. Navigate to Dashboards → API Gateway & Services

## 🧪 Testing Rate Limiting

```bash
# Send 25 requests rapidly to trigger rate limit
for i in {1..25}; do
  echo "Request $i:"
  curl -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n" \
    -s -o /dev/null
  sleep 0.5
done

# After ~20 requests, you should see:
# Status: 429 (Too Many Requests)
```

## 🔧 Troubleshooting

### Kong Not Starting?

```bash
# Check if migration completed
docker-compose logs kong-migration

# Check database connection
docker-compose logs kong-database

# Restart Kong
docker-compose restart kong-gateway
```

### Service Unreachable?

```bash
# Check service is running
docker-compose ps

# Test service directly (bypass gateway)
curl http://localhost:3001/health

# Check Kong routes
curl http://localhost:8001/routes
```

### JWT Authentication Failing?

```bash
# Verify token format
echo "YOUR_JWT_TOKEN" | cut -d'.' -f2 | base64 -d

# Check token not expired
# Token expiry is 15 minutes by default

# Get a fresh token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'
```

## 📱 Testing All Services

### Identity Service

```bash
# Register user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!","fullName":"John Doe"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!"}'
```

### Wallet Service

```bash
# Create wallet (requires JWT)
curl -X POST http://localhost:8000/api/v1/wallets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"walletType":"personal","currencyCode":"USD"}'

# Get wallet balance
curl http://localhost:8000/api/v1/wallets/WALLET_ID/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Transaction Service

```bash
# Initiate transfer (requires JWT)
curl -X POST http://localhost:8000/api/v1/transfers/domestic \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceWalletId":"WALLET_ID",
    "destinationWalletId":"RECIPIENT_WALLET_ID",
    "amount":100.00,
    "currency":"USD"
  }'

# Get transaction history
curl http://localhost:8000/api/v1/transactions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Admin Service

```bash
# List customers (requires admin JWT)
curl http://localhost:8000/api/v1/customers \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"

# Get customer details
curl http://localhost:8000/api/v1/customers/CUSTOMER_ID \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

## 🎓 Next Steps

1. Read the full documentation: [gateway/README.md](README.md)
2. Explore Kong Manager GUI: http://localhost:8002
3. Set up custom Grafana dashboards
4. Configure production settings
5. Implement custom plugins if needed

## 📚 Additional Resources

- [Kong Documentation](https://docs.konghq.com/)
- [API Gateway README](README.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [Service Documentation](../README_SERVICES.md)

## ❓ Need Help?

Check logs for errors:
```bash
docker-compose logs -f kong-gateway
```

Or view Kong status:
```bash
./gateway/scripts/configure-kong.sh all
```
