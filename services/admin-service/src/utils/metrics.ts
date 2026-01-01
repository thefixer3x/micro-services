import client from 'prom-client';

// Create a Registry to register metrics
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Support ticket metrics
export const ticketCounter = new client.Counter({
  name: 'support_tickets_total',
  help: 'Total number of support tickets',
  labelNames: ['category', 'priority', 'status'],
  registers: [register]
});

export const ticketResolutionTime = new client.Histogram({
  name: 'ticket_resolution_time_hours',
  help: 'Ticket resolution time in hours',
  labelNames: ['category', 'priority'],
  buckets: [1, 4, 8, 24, 48, 72, 168], // 1h, 4h, 8h, 1d, 2d, 3d, 1w
  registers: [register]
});

export const activeTicketsGauge = new client.Gauge({
  name: 'active_tickets',
  help: 'Number of currently active tickets',
  labelNames: ['status'],
  registers: [register]
});

// Audit log metrics
export const auditLogCounter = new client.Counter({
  name: 'audit_logs_total',
  help: 'Total number of audit log entries',
  labelNames: ['action_type', 'resource_type'],
  registers: [register]
});

// Admin activity metrics
export const adminActionsCounter = new client.Counter({
  name: 'admin_actions_total',
  help: 'Total admin actions performed',
  labelNames: ['action', 'admin_role'],
  registers: [register]
});

export const activeAdminsGauge = new client.Gauge({
  name: 'active_admin_sessions',
  help: 'Number of active admin sessions',
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

// Customer service metrics
export const customerLookupDuration = new client.Histogram({
  name: 'customer_lookup_duration_seconds',
  help: 'Duration of customer lookup operations',
  labelNames: ['source'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Export the register
export { register };

// Helper functions
export function recordTicketCreated(category: string, priority: string): void {
  ticketCounter.inc({ category, priority, status: 'open' });
}

export function recordTicketResolved(
  category: string,
  priority: string,
  resolutionTimeHours: number
): void {
  ticketCounter.inc({ category, priority, status: 'resolved' });
  ticketResolutionTime.observe({ category, priority }, resolutionTimeHours);
}

export function recordAuditLog(actionType: string, resourceType: string): void {
  auditLogCounter.inc({ action_type: actionType, resource_type: resourceType });
}

export function recordAdminAction(action: string, adminRole: string): void {
  adminActionsCounter.inc({ action, admin_role: adminRole });
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

export function updateActiveTickets(status: string, count: number): void {
  activeTicketsGauge.set({ status }, count);
}
