/** @type {import('jest').Config} */
module.exports = {
  displayName: 'wallet-service-integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/integration/**/*.test.ts',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Integration tests may take longer
  testTimeout: 30000,
  // Run tests serially to avoid database conflicts
  maxWorkers: 1,
  clearMocks: true,
  restoreMocks: true,
  // Don't collect coverage for integration tests
  collectCoverage: false,
  // Verbose output for integration tests
  verbose: true,
};
