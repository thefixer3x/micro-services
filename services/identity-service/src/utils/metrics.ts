import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for Identity Service

// Authentication counters
export const authCounter = new client.Counter({
  name: 'auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status'],
  registers: [register]
});

// Registration counter
export const registrationCounter = new client.Counter({
  name: 'registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['status'],
  registers: [register]
});

// KYC verification counter
export const kycCounter = new client.Counter({
  name: 'kyc_verifications_total',
  help: 'Total number of KYC verification attempts',
  labelNames: ['type', 'status'],
  registers: [register]
});

// Biometric enrollment counter
export const biometricCounter = new client.Counter({
  name: 'biometric_operations_total',
  help: 'Total number of biometric operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

// Active sessions gauge
export const activeSessionsGauge = new client.Gauge({
  name: 'active_sessions',
  help: 'Number of active user sessions',
  registers: [register]
});

// HTTP request metrics
export const httpRequestDurationHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Token operations
export const tokenCounter = new client.Counter({
  name: 'token_operations_total',
  help: 'Total number of token operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

// Export the register for the /metrics endpoint
export { register };

// Helper functions
export function recordAuth(type: string, success: boolean): void {
  authCounter.inc({ type, status: success ? 'success' : 'failure' });
}

export function recordRegistration(success: boolean): void {
  registrationCounter.inc({ status: success ? 'success' : 'failure' });
}

export function recordKyc(type: string, success: boolean): void {
  kycCounter.inc({ type, status: success ? 'success' : 'failure' });
}

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
): void {
  const labels = { method, route, status_code: statusCode.toString() };
  httpRequestsTotal.inc(labels);
  httpRequestDurationHistogram.observe(labels, durationMs / 1000);
}
