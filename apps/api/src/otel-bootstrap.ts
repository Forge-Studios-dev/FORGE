/**
 * Optional OpenTelemetry — loads only when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 * Import from instrument.ts before Nest boots.
 */
export async function bootstrapOpenTelemetry(): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;

  const serviceName = process.env.OTEL_SERVICE_NAME || 'forge-api';

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const { Resource } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http');
  const { NestInstrumentation } = await import('@opentelemetry/instrumentation-nestjs-core');

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [new HttpInstrumentation(), new NestInstrumentation()],
  });

  await sdk.start();
  // eslint-disable-next-line no-console
  console.log(`OpenTelemetry tracing enabled (${serviceName} → ${endpoint})`);
}
