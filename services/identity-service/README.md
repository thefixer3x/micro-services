# Identity Service

## 🎯 Purpose
The Identity Service is the foundation service responsible for user authentication, authorization, and identity verification (KYC/KYB).

## 🔑 Key Responsibilities
- User registration and onboarding
- Authentication (username/password, biometric, 2FA)
- KYC/KYB verification
- Session management
- User profile management
- Multi-language support

## 🏗️ Architecture

### Database Schema
```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    account_type ENUM('individual', 'business', 'joint'),
    status ENUM('pending', 'active', 'suspended', 'closed'),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- KYC Documents
CREATE TABLE kyc_documents (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    document_type VARCHAR(50),
    document_number VARCHAR(100),
    document_url VARCHAR(500),
    verification_status ENUM('pending', 'verified', 'rejected'),
    verified_at TIMESTAMP,
    metadata JSONB
);

-- Biometric Data
CREATE TABLE biometric_data (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    biometric_type ENUM('fingerprint', 'face', 'voice'),
    template_data BYTEA,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/2fa/enable` - Enable 2FA
- `POST /api/v1/auth/2fa/verify` - Verify 2FA code
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `POST /api/v1/kyc/upload` - Upload KYC document
- `GET /api/v1/kyc/status` - Get KYC verification status
- `POST /api/v1/biometric/enroll` - Enroll biometric data
- `POST /api/v1/biometric/verify` - Verify biometric data

### Events Published
- `UserRegistered` - When a new user registers
- `UserVerified` - When KYC is completed
- `UserUpdated` - When user profile is updated
- `UserSuspended` - When account is suspended
- `LoginAttempt` - For security monitoring

## 🔗 Dependencies
- **External Services**:
  - AWS Rekognition (facial recognition)
  - Twillio (SMS for 2FA)
  - SendGrid (Email verification)
  - Document verification API

- **Internal Services**: None (Foundation service)

## 🚀 Running the Service

### Development
```bash
cd services/identity-service
npm install
npm run dev
```

### Testing
```bash
npm test
npm run test:integration
```

### Docker
```bash
docker build -t identity-service:latest .
docker run -p 3001:3001 identity-service:latest
```

## 📊 Monitoring
- Health check: `GET /health`
- Metrics: `GET /metrics`
- Key metrics:
  - Registration rate
  - Login success/failure rate
  - KYC verification time
  - API response times

## 🔒 Security
- JWT tokens with 15-minute expiry
- Refresh tokens stored in Redis
- Password hashing with bcrypt (12 rounds)
- Rate limiting on auth endpoints
- Biometric data encrypted at rest
