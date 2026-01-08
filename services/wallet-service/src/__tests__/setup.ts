/**
 * Jest Test Setup
 * Configures mocks and environment for unit tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PROVIDUS_CLIENT_ID = 'test-client-id';
process.env.PROVIDUS_CLIENT_SECRET = 'test-client-secret';
process.env.PROVIDUS_BASE_URL = 'https://sandbox.api.xpresswallet.com';
process.env.PROVIDUS_USE_SANDBOX = 'true';
process.env.DEFAULT_WALLET_PROVIDER = 'providus';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Mock winston logger to avoid console noise during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
