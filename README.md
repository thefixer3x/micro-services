# Microservices Platform

A comprehensive financial services platform built with microservices architecture, featuring identity management, wallet services, transaction processing, and administrative capabilities.

## 🏗️ Architecture

This platform uses a microservices architecture with Kong API Gateway as the entry point. For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

### Services

- **Identity Service** (Port 3001) - User authentication, KYC, and identity verification
- **Wallet Service** (Port 3002) - Digital wallet management and virtual cards
- **Transaction Service** (Port 3003) - Payment processing and transfers
- **Admin Service** (Port 3004) - Administrative dashboard and support

### API Gateway

- **Kong API Gateway** (Port 8000) - Central entry point with JWT auth, rate limiting, CORS, and monitoring
- **Kong Admin API** (Port 8001) - Configuration and management
- **Kong Manager** (Port 8002) - Web-based GUI

### Monitoring

- **Prometheus** (Port 9090) - Metrics collection
- **Grafana** (Port 3000) - Monitoring dashboards

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (or use Docker)

### Start All Services

```bash
# Start all services with Docker Compose
docker-compose up -d

# Verify all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### Access the Platform

- API Gateway: http://localhost:8000
- Kong Manager: http://localhost:8002
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090

For detailed setup instructions, see [gateway/QUICK_START.md](gateway/QUICK_START.md)

## 📚 Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [API Gateway Documentation](gateway/README.md)
- [API Gateway Quick Start](gateway/QUICK_START.md)
- [Service Documentation](README_SERVICES.md)
- [Dependency Matrix](DEPENDENCY_MATRIX.md)

## 🧪 Testing

```bash
# Run gateway integration tests
./gateway/scripts/test-gateway.sh

# Run service tests
cd services/identity-service && npm test
cd services/wallet-service && npm test
cd services/transaction-service && npm test
cd services/admin-service && npm test
```

## 🔒 Security Features

- JWT authentication with refresh tokens
- Rate limiting per endpoint
- CORS configuration
- Request size limiting
- IP restrictions (configurable)
- Audit logging
- Health monitoring

## 📊 Monitoring & Observability

- Prometheus metrics for all services
- Grafana dashboards for visualization
- Request/response logging
- Distributed tracing with request IDs
- Health check endpoints

## 🛠️ Development

### Local Development

```bash
# Start individual service
cd services/identity-service
npm install
npm run dev

# Run tests
npm test

# Run with watch mode
npm run test:watch
```

### Configuration Management

```bash
# View Kong configuration
./gateway/scripts/configure-kong.sh all

# Apply configuration changes
./gateway/scripts/configure-kong.sh apply

# Test service health
./gateway/scripts/configure-kong.sh health
```

## 📦 Project Structure

```
.
├── services/
│   ├── identity-service/      # Authentication & KYC
│   ├── wallet-service/         # Wallet management
│   ├── transaction-service/    # Payment processing
│   └── admin-service/          # Admin dashboard
├── gateway/
│   ├── kong.yml               # Kong configuration
│   ├── scripts/               # Helper scripts
│   ├── README.md              # Gateway documentation
│   └── QUICK_START.md         # Quick start guide
├── monitoring/
│   ├── prometheus.yml         # Prometheus config
│   └── grafana/               # Grafana dashboards
├── docker-compose.yml         # All services orchestration
├── ARCHITECTURE.md            # Architecture documentation
└── README.md                  # This file
```

## 🌐 API Endpoints

All endpoints are accessible through the API Gateway at `http://localhost:8000`:

### Identity Service
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/users/me` - Get current user (protected)
- `POST /api/v1/kyc/verify` - KYC verification (protected)

### Wallet Service
- `POST /api/v1/wallets` - Create wallet (protected)
- `GET /api/v1/wallets` - List wallets (protected)
- `GET /api/v1/wallets/{id}/balance` - Get balance (protected)
- `POST /api/v1/cards/virtual` - Create virtual card (protected)

### Transaction Service
- `POST /api/v1/transfers/domestic` - Domestic transfer (protected)
- `POST /api/v1/transfers/international` - International transfer (protected)
- `GET /api/v1/transactions` - Transaction history (protected)
- `GET /api/v1/exchange-rates` - Exchange rates

### Admin Service
- `GET /api/v1/customers` - List customers (protected, admin)
- `GET /api/v1/tickets` - Support tickets (protected, admin)
- `GET /api/v1/reports/daily` - Daily reports (protected, admin)

For complete API documentation, see individual service README files.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Create a pull request

## 📝 License

MIT License - See LICENSE file for details

## 📧 Support

For issues or questions, please check:
- Service logs: `docker-compose logs <service-name>`
- Kong logs: `docker-compose logs kong-gateway`
- Gateway documentation: [gateway/README.md](gateway/README.md)

---

## Original Project Import

This repository was originally generated from **Seyederick Platform functional requirements.xlsx**.

### Import Documentation

- `docs/` – Markdown renderings of each Excel sheet
- `data/issues.csv` – Issues extracted from the workbook
- `data/labels.csv` – Unique labels from the workbook
- `scripts/` – Helper scripts for importing labels and issues using the GitHub CLI

For import details, see [PROJECT_SETUP.md](PROJECT_SETUP.md).
