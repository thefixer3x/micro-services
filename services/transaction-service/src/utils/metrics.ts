import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics for Transaction Service

// Transaction counters
export const transactionCounter = new client.Counter({
  name: 'transactions_total',
  help: 'Total number of transactions processed',
  labelNames: ['type', 'status', 'currency'],
  registers: [register]
});

// Transaction amount histogram
export const transactionAmountHistogram = new client.Histogram({
  name: 'transaction_amount',
  help: 'Transaction amount distribution',
  labelNames: ['type', 'currency'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register]
});

// Transaction processing duration
export const transactionDurationHistogram = new client.Histogram({
  name: 'transaction_processing_duration_seconds',
  help: 'Transaction processing duration in seconds',
  labelNames: ['type', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

// Active transactions gauge
export const activeTransactionsGauge = new client.Gauge({
  name: 'transactions_active',
  help: 'Number of transactions currently being processed',
  registers: [register]
});

// Fee revenue counter
export const feeRevenueCounter = new client.Counter({
  name: 'transaction_fees_total',
  help: 'Total fees collected',
  labelNames: ['fee_type', 'currency'],
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

// Database connection pool metrics
export const dbPoolGauge = new client.Gauge({
  name: 'db_pool_connections',
  help: 'Database connection pool size',
  labelNames: ['state'],
  registers: [register]
});

// Export the register for the /metrics endpoint
export { register };

// Helper functions to record metrics
export function recordTransaction(
  type: string,
  status: string,
  currency: string,
  amount: number,
  durationMs: number
): void {
  transactionCounter.inc({ type, status, currency });
  transactionAmountHistogram.observe({ type, currency }, amount);
  transactionDurationHistogram.observe({ type, status }, durationMs / 1000);
}

export function recordFee(feeType: string, currency: string, amount: number): void {
  feeRevenueCounter.inc({ fee_type: feeType, currency }, amount);
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
