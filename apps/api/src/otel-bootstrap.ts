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
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');
  const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http');
  const { NestInstrumentation } = await import('@opentelemetry/instrumentation-nestjs-core');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instrumentations: any[] = [new HttpInstrumentation(), new NestInstrumentation()];
  try {
    const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg');
    instrumentations.push(new PgInstrumentation());
  } catch {
    /* optional dependency */
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations,
  });

  await sdk.start();
  // eslint-disable-next-line no-console
  console.log(`OpenTelemetry tracing enabled (${serviceName} → ${endpoint})`);
}
