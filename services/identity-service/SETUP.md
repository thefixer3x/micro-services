# Identity Service Setup Guide

## Overview
The Identity Service is a Node.js/Express service that handles user authentication, KYC verification, and biometric data management for the platform.

## Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 12
- Redis (optional, for refresh token storage)
- Docker & Docker Compose (for containerized deployment)

## Quick Start

### 1. Environment Setup
```bash
# Copy environment variables
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Make sure PostgreSQL is running
# Create database
createdb identity_service

# Run migrations (automatic on start)
npm run migrate
```

### 4. Development
```bash
# Start in development mode
npm run dev

# Or build and start
npm run build
npm start
```

### 5. Testing
```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Docker Development

### Using Docker Compose
```bash
# Start all services (app, database, redis, adminer)
docker-compose -f docker-compose.dev.yml up

# Access the service at http://localhost:3001
# Access database admin at http://localhost:8080
```

### Building Docker Image
```bash
# Build production image
docker build -t identity-service:latest .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e JWT_SECRET=your-secret \
  identity-service:latest
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh access token

### User Profile
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `GET /api/v1/users/profile/settings` - Get user settings

### KYC Management
- `POST /api/v1/kyc/upload` - Upload KYC document
- `GET /api/v1/kyc/status` - Get KYC verification status
- `GET /api/v1/kyc/documents` - List user documents

### Biometric Authentication
- `POST /api/v1/biometric/enroll` - Enroll biometric data
- `POST /api/v1/biometric/verify` - Verify biometric data
- `GET /api/v1/biometric/status` - Get enrolled biometric types

## Configuration

### Environment Variables

#### Server Configuration
- `NODE_ENV` - Environment (development, production, test)
- `PORT` - Server port (default: 3001)
- `HOST` - Server host (default: localhost)

#### Database Configuration
- `DATABASE_URL` - Full PostgreSQL connection string
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username  
- `DB_PASSWORD` - Database password

#### JWT Configuration
- `JWT_SECRET` - JWT signing secret (required)
- `JWT_EXPIRES_IN` - Access token expiry (default: 15m)
- `JWT_REFRESH_SECRET` - Refresh token secret (required)
- `JWT_REFRESH_EXPIRES_IN` - Refresh token expiry (default: 7d)

#### Security Configuration
- `BCRYPT_ROUNDS` - Password hashing rounds (default: 12)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

#### File Upload Configuration
- `UPLOAD_DIR` - Upload directory (default: ./uploads)
- `MAX_FILE_SIZE` - Maximum file size in bytes (default: 5MB)
- `ALLOWED_FILE_TYPES` - Comma-separated allowed MIME types

## Database Schema

The service automatically creates the following tables:

### `users`
- Core user information (email, phone, password, account type, status)

### `user_profiles`  
- Extended user profile data (names, address, language, KYC status)

### `kyc_documents`
- KYC document storage and verification status

### `biometric_data`
- Biometric template storage (fingerprint, face, voice)

### `refresh_tokens`
- JWT refresh token management

## Development Notes

### Project Structure
```
src/
├── controllers/     # Route handlers
├── services/        # Business logic
├── repositories/    # Data access layer
├── middleware/      # Express middleware
├── utils/          # Utility functions
├── database/       # Database connection and migrations
├── types/          # TypeScript type definitions
├── locales/        # Internationalization files
└── __tests__/      # Test files
```

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Jest for unit and integration testing
- Winston for structured logging
- Proper error handling with custom error types

### Security Features
- JWT-based authentication with refresh tokens
- Password hashing with bcrypt
- Request validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers

### Multi-language Support
Currently supports:
- English (en)
- Pidgin English (pcm)
- Yoruba (yo) - placeholder
- French (fr) - placeholder

## Production Deployment

### Environment Setup
1. Set production environment variables
2. Configure PostgreSQL with SSL
3. Set up Redis for session storage
4. Configure external services (AWS S3, SendGrid, Twilio)

### Docker Deployment
```bash
# Build production image
docker build -t identity-service:v1.0.0 .

# Deploy with proper secrets
docker run -d \
  --name identity-service \
  -p 3001:3001 \
  --env-file .env.production \
  identity-service:v1.0.0
```

### Health Monitoring
- Health check endpoint: `GET /health`
- Metrics endpoint: `GET /metrics` (if enabled)
- Structured logging to files and external services

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check PostgreSQL status
pg_isready -h localhost -p 5432

# Verify database exists
psql -h localhost -U postgres -l
```

#### JWT Token Issues
- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- Check token expiration settings
- Verify token format in requests

#### File Upload Issues
- Check `UPLOAD_DIR` permissions
- Verify file size limits
- Ensure allowed file types are configured

#### Build Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear TypeScript cache
rm -rf dist
npm run build
```

## Support
For issues and questions, refer to the main project documentation or create an issue in the repository.