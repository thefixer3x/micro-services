import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for Wallet Service

// Wallet operations counter
export const walletOperationsCounter = new client.Counter({
  name: 'wallet_operations_total',
  help: 'Total number of wallet operations',
  labelNames: ['operation', 'status', 'provider'],
  registers: [register]
});

// Wallet balance gauge (per currency)
export const walletBalanceGauge = new client.Gauge({
  name: 'wallet_total_balance',
  help: 'Total balance across all wallets',
  labelNames: ['currency'],
  registers: [register]
});

// Active wallets gauge
export const activeWalletsGauge = new client.Gauge({
  name: 'active_wallets',
  help: 'Number of active wallets',
  labelNames: ['status'],
  registers: [register]
});

// Card operations counter
export const cardOperationsCounter = new client.Counter({
  name: 'card_operations_total',
  help: 'Total number of card operations',
  labelNames: ['operation', 'status'],
  registers: [register]
});

// Provider API call duration
export const providerApiDuration = new client.Histogram({
  name: 'provider_api_duration_seconds',
  help: 'Duration of provider API calls',
  labelNames: ['provider', 'operation', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
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

// Export the register for the /metrics endpoint
export { register };

// Helper functions
export function recordWalletOperation(
  operation: string,
  success: boolean,
  provider: string
): void {
  walletOperationsCounter.inc({
    operation,
    status: success ? 'success' : 'failure',
    provider
  });
}

export function recordCardOperation(operation: string, success: boolean): void {
  cardOperationsCounter.inc({
    operation,
    status: success ? 'success' : 'failure'
  });
}

export function recordProviderApiCall(
  provider: string,
  operation: string,
  success: boolean,
  durationMs: number
): void {
  providerApiDuration.observe(
    { provider, operation, status: success ? 'success' : 'failure' },
    durationMs / 1000
  );
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
