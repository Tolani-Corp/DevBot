type SpanOptions = {
  attributes?: Record<string, unknown>;
};

type Span = {
  setAttribute: (key: string, value: unknown) => void;
  recordException: (error: Error) => void;
  end: () => void;
};

function createNoopSpan(_name: string, _options?: SpanOptions): Span {
  return {
    setAttribute: () => undefined,
    recordException: (error) => {
      console.error(`[trace] ${error.message}`);
    },
    end: () => undefined,
  };
}

export const tracer = {
  startSpan(name: string, options?: SpanOptions): Span {
    return createNoopSpan(name, options);
  },
};

