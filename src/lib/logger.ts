type LogContext = Record<string, unknown>;

function serialize(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return " [unserializable context]";
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    console.debug(`${message}${serialize(context)}`);
  },
  info(message: string, context?: LogContext): void {
    console.info(`${message}${serialize(context)}`);
  },
  warn(message: string, context?: LogContext): void {
    console.warn(`${message}${serialize(context)}`);
  },
  error(message: string, context?: LogContext): void {
    console.error(`${message}${serialize(context)}`);
  },
};

