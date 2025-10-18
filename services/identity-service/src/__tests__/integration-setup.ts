import { config } from 'dotenv';
import { initializeDatabase, closeDatabase } from '../database/connection';
import { initializeI18n } from '../utils/i18n';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.DB_NAME = 'identity_service_test';
process.env.LOG_LEVEL = 'error';

// Global setup for integration tests
beforeAll(async () => {
  await initializeI18n();
  await initializeDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Clean up database between tests
afterEach(async () => {
  // This would clean up test data between tests
  // For now, it's a placeholder
});