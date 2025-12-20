import client, { Histogram, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'quickapi_',
});

export const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 15, 50, 100, 250, 500, 1000],
});

metricsRegistry.registerMetric(httpRequestCounter);
metricsRegistry.registerMetric(httpRequestDuration);
