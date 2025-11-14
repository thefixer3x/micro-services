# API Gateway Documentation

## Overview

The API Gateway is implemented using **Kong API Gateway 3.5**, providing a centralized entry point for all microservices in the platform. It handles authentication, rate limiting, routing, CORS, logging, and monitoring.

## Architecture

```
┌─────────────┐
│   Clients   │
│ (Web/Mobile)│
└──────┬──────┘
       │
       │ HTTPS/HTTP
       │
┌──────▼──────────────────────────────────────────┐
│         Kong API Gateway (Port 8000)            │
│  • JWT Authentication                           │
│  • Rate Limiting                                │
│  • CORS Management                              │
│  • Request/Response Logging                     │
│  • Load Balancing                               │
│  • Health Checks                                │
└─────────────┬───────────────────────────────────┘
              │
     ┌────────┼────────┬──────────┬────────────┐
     │        │        │          │            │
┌────▼───┐ ┌─▼────┐ ┌─▼──────┐ ┌─▼────────┐  │
│Identity│ │Wallet│ │Transaction│Admin     │  │
│Service │ │Service│ │Service │ │Service   │  │
│:3001   │ │:3002 │ │:3003   │ │:3004     │  │
└────────┘ └──────┘ └────────┘ └──────────┘  │
                                              │
                                    ┌─────────▼────────┐
                                    │   Monitoring     │
                                    │ Prometheus:9090  │
                                    │  Grafana:3000    │
                                    └──────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose installed
- Ports available: 8000, 8001, 8002, 9090, 3000
- Services built and ready to run

### Starting the Gateway

```bash
# Start all services including Kong
docker-compose up -d

# Verify Kong is running
docker-compose ps kong-gateway

# Check Kong health
curl http://localhost:8001/status
```

### Accessing Services

All microservices are accessible through the gateway at `http://localhost:8000`:

| Service | Endpoint | Port (Direct) | Gateway Path |
|---------|----------|---------------|--------------|
| Identity | Auth, KYC, Users | 3001 | http://localhost:8000/api/v1/auth/* |
| Wallet | Wallets, Cards | 3002 | http://localhost:8000/api/v1/wallets/* |
| Transaction | Payments, Transfers | 3003 | http://localhost:8000/api/v1/transactions/* |
| Admin | Customer Mgmt | 3004 | http://localhost:8000/api/v1/customers/* |

## Key Features

### 1. Authentication & Authorization

Kong uses **JWT (JSON Web Tokens)** for authentication.

#### Public Endpoints (No JWT Required)
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/forgot-password` - Password reset request
- `POST /api/v1/auth/reset-password` - Password reset

#### Protected Endpoints (JWT Required)
All other endpoints require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

**Example Request:**
```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Rate Limiting

Rate limits are configured per endpoint category:

| Endpoint Type | Requests/Minute | Requests/Hour |
|---------------|-----------------|---------------|
| Public Auth | 20 | 100 |
| Identity (Protected) | 100 | 1,000 |
| Wallet | 100 | 1,000 |
| Transaction | 50 | 500 |
| Admin | 200 | 2,000 |

When rate limit is exceeded:
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

### 3. CORS (Cross-Origin Resource Sharing)

CORS is configured to allow requests from any origin in development. For production, update the Kong configuration:

**Current Configuration:**
```yaml
cors:
  origins: ["*"]
  methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
  credentials: true
  max_age: 3600
```

**Production Configuration (Recommended):**
```yaml
cors:
  origins:
    - "https://yourplatform.com"
    - "https://app.yourplatform.com"
  methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
  credentials: true
  max_age: 3600
```

### 4. Request/Response Logging

All requests and responses are logged for monitoring and debugging.

#### Log Locations
- **Kong Gateway Logs**: `/dev/stdout` (accessible via `docker-compose logs kong-gateway`)
- **File Logs**: `/tmp/kong-logs.json` (inside Kong container)

#### Log Format
```json
{
  "request": {
    "method": "POST",
    "uri": "/api/v1/auth/login",
    "headers": {...},
    "body": {...}
  },
  "response": {
    "status": 200,
    "headers": {...},
    "latency": 145
  },
  "client_ip": "192.168.1.1",
  "request_id": "uuid-here"
}
```

#### Viewing Logs
```bash
# Stream Kong logs
docker-compose logs -f kong-gateway

# View logs inside container
docker exec -it kong-gateway tail -f /tmp/kong-logs.json
```

### 5. Health Checks

Each service exposes a `/health` endpoint that Kong monitors.

#### Gateway Health Check
```bash
curl http://localhost:8001/status
```

**Response:**
```json
{
  "database": {
    "reachable": true
  },
  "server": {
    "connections_accepted": 1234,
    "connections_active": 5,
    "connections_handled": 1234,
    "total_requests": 5678
  }
}
```

#### Service Health Checks via Gateway
```bash
# Identity Service
curl http://localhost:8000/health

# Or use the configuration script
./gateway/scripts/configure-kong.sh health
```

### 6. Load Balancing

Kong provides load balancing with health checks for each service:

**Configuration:**
- Algorithm: Round-robin
- Active health checks: Every 5 seconds
- Passive health checks: Monitor failed requests
- Auto-removal of unhealthy targets

**Health Check Thresholds:**
- Healthy: 2 consecutive successes
- Unhealthy: 3 consecutive failures or timeouts

### 7. Monitoring & Metrics

#### Prometheus Metrics

Kong exports metrics to Prometheus at: `http://localhost:8001/metrics`

**Key Metrics:**
- `kong_http_status` - HTTP status codes
- `kong_latency` - Request latency
- `kong_bandwidth` - Bytes in/out
- `kong_requests_total` - Total requests

**Access Prometheus:**
```bash
# Prometheus UI
http://localhost:9090

# Query examples:
# - Rate of requests: rate(kong_http_status[5m])
# - Average latency: avg(kong_latency)
```

#### Grafana Dashboard

**Access Grafana:**
```bash
URL: http://localhost:3000
Username: admin
Password: admin
```

**Pre-configured Dashboards:**
- API Gateway Overview
- Service Performance Metrics
- Request Rate & Latency
- Error Rate Tracking

## Configuration Management

### Kong Admin API

Access Kong's Admin API at `http://localhost:8001`

**Common Operations:**

```bash
# List all services
curl http://localhost:8001/services

# List all routes
curl http://localhost:8001/routes

# List all plugins
curl http://localhost:8001/plugins

# View specific service
curl http://localhost:8001/services/identity-service
```

### Kong Manager (GUI)

Access Kong Manager at `http://localhost:8002` for visual configuration management.

### Declarative Configuration

The gateway uses declarative configuration stored in `gateway/kong.yml`.

**Applying Configuration Changes:**

```bash
# Method 1: Use the configuration script
./gateway/scripts/configure-kong.sh apply

# Method 2: Restart Kong container
docker-compose restart kong-gateway
```

### Configuration Script Usage

```bash
# Show all information
./gateway/scripts/configure-kong.sh all

# Apply configuration
./gateway/scripts/configure-kong.sh apply

# List services
./gateway/scripts/configure-kong.sh services

# List routes
./gateway/scripts/configure-kong.sh routes

# List plugins
./gateway/scripts/configure-kong.sh plugins

# Show Kong status
./gateway/scripts/configure-kong.sh status

# Test health checks
./gateway/scripts/configure-kong.sh health
```

## Security Best Practices

### 1. JWT Configuration

**Current Setup (Development):**
- Secret: `your-super-secret-jwt-key-change-in-production`
- Algorithm: HS256
- Expiry: 15 minutes (access token), 7 days (refresh token)

**Production Recommendations:**
- Use strong, random secrets (min 32 characters)
- Store secrets in environment variables or secret management system
- Consider using RS256 (asymmetric) for better security
- Implement token rotation
- Use short expiry times with refresh tokens

### 2. Rate Limiting

Adjust rate limits based on your needs:

```yaml
plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 1000
      policy: redis  # Use Redis for distributed rate limiting in production
```

### 3. IP Restrictions (Optional)

For admin endpoints, consider IP whitelisting:

```yaml
plugins:
  - name: ip-restriction
    config:
      allow:
        - 10.0.0.0/8
        - 192.168.0.0/16
```

### 4. Request Size Limiting

Prevent large payload attacks:

```yaml
plugins:
  - name: request-size-limiting
    config:
      allowed_payload_size: 10  # MB
```

## Troubleshooting

### Kong Gateway Not Starting

```bash
# Check logs
docker-compose logs kong-gateway

# Verify database migration
docker-compose logs kong-migration

# Restart Kong
docker-compose restart kong-gateway
```

### Service Unreachable Through Gateway

```bash
# 1. Check service is running
docker-compose ps

# 2. Test service directly
curl http://localhost:3001/health

# 3. Check Kong routes
curl http://localhost:8001/routes

# 4. View Kong logs
docker-compose logs -f kong-gateway
```

### JWT Authentication Failing

**Common Issues:**
- Token expired
- Invalid signature
- Missing Authorization header
- Incorrect secret configuration

**Debug Steps:**
```bash
# 1. Verify JWT plugin is enabled
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="jwt")'

# 2. Check consumer configuration
curl http://localhost:8001/consumers

# 3. Test with verbose output
curl -v -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/v1/users/me
```

### Rate Limit Issues

```bash
# Check current rate limit configuration
curl http://localhost:8001/plugins | jq '.data[] | select(.name=="rate-limiting")'

# View rate limit headers in response
curl -v http://localhost:8000/api/v1/auth/login
# Look for:
# X-RateLimit-Limit-Minute: 20
# X-RateLimit-Remaining-Minute: 19
```

## Performance Tuning

### Database Connection Pool

For production, optimize PostgreSQL connections:

```yaml
environment:
  KONG_PG_MAX_CONCURRENT_QUERIES: 100
  KONG_PG_SEMAPHORE_TIMEOUT: 60000
```

### Worker Processes

Adjust Kong worker processes based on CPU cores:

```yaml
environment:
  KONG_NGINX_WORKER_PROCESSES: 4  # Set to number of CPU cores
```

### Caching

Enable proxy caching for GET requests:

```yaml
plugins:
  - name: proxy-cache
    config:
      cache_ttl: 300
      strategy: memory
```

## Maintenance

### Backup Kong Configuration

```bash
# Export current configuration
curl http://localhost:8001/config > kong-backup-$(date +%Y%m%d).json
```

### Update Kong

```bash
# 1. Backup configuration
curl http://localhost:8001/config > kong-backup.json

# 2. Update Kong image version in docker-compose.yml
# 3. Pull new image
docker-compose pull kong-gateway

# 4. Restart Kong
docker-compose up -d kong-gateway
```

### Log Rotation

Configure log rotation to prevent disk space issues:

```bash
# Add to docker-compose.yml for kong-gateway
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Testing

### Integration Tests

```bash
# Test authentication flow
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test protected endpoint
TOKEN="your-jwt-token"
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer $TOKEN"

# Test rate limiting
for i in {1..25}; do
  curl -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### Load Testing

Use Apache Bench or k6 for load testing:

```bash
# Install k6
# https://k6.io/docs/getting-started/installation/

# Create test script
cat > load-test.js <<EOF
import http from 'k6/http';
import { check } from 'k6';

export default function() {
  const res = http.get('http://localhost:8000/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
EOF

# Run load test
k6 run --vus 100 --duration 30s load-test.js
```

## Production Checklist

Before deploying to production:

- [ ] Change all default passwords and secrets
- [ ] Configure production CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Enable Redis for distributed rate limiting
- [ ] Configure external logging service
- [ ] Set up monitoring alerts
- [ ] Implement IP restrictions for admin endpoints
- [ ] Configure database backup strategy
- [ ] Enable audit logging
- [ ] Test disaster recovery procedures
- [ ] Document runbooks for common issues
- [ ] Configure auto-scaling policies
- [ ] Set up CDN for static assets
- [ ] Enable DDoS protection
- [ ] Configure firewall rules

## References

- [Kong Documentation](https://docs.konghq.com/)
- [Kong Plugin Hub](https://docs.konghq.com/hub/)
- [Kong Admin API Reference](https://docs.konghq.com/gateway/latest/admin-api/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

## Support

For issues or questions:
- Check Kong logs: `docker-compose logs kong-gateway`
- Review service logs: `docker-compose logs <service-name>`
- Check Kong status: `curl http://localhost:8001/status`
- Consult Kong documentation: https://docs.konghq.com/

## License

This API Gateway configuration is part of the microservices platform project.
