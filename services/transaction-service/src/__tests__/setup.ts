// Jest test setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/transaction_test';
process.env.JWT_SECRET = 'test-secret';
process.env.LOG_LEVEL = 'error';

// Mock database connection for unit tests
jest.mock('../database/connection', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  closePool: jest.fn()
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global teardown
afterAll(async () => {
  // Cleanup resources
});
