// ──────────────────────────────────────────────────────────────
// DevBot — OpenTelemetry Tracing Setup
// Instruments Anthropic SDK calls for debugging and monitoring.
// ──────────────────────────────────────────────────────────────

import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { AnthropicInstrumentation } from "@traceloop/instrumentation-anthropic";

const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces";

let provider: NodeTracerProvider | null = null;

/**
 * Initialize OpenTelemetry tracing for the DevBot agent system.
 * Must be called before any Anthropic SDK usage.
 */
export function initTracing(serviceName = "devbot-agents"): void {
  if (provider) {
    console.log("[tracing] Already initialized");
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: OTLP_ENDPOINT,
  });

  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      "service.name": serviceName,
    }),
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  provider.register();

  registerInstrumentations({
    instrumentations: [new AnthropicInstrumentation()],
  });

  console.log(`[tracing] Initialized with endpoint: ${OTLP_ENDPOINT}`);
}

/**
 * Gracefully shutdown the tracing provider.
 * Call this on process exit.
 */
export async function shutdownTracing(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
    console.log("[tracing] Shutdown complete");
  }
}
