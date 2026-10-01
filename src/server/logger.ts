/* eslint-disable no-console -- the logger is the one place allowed to write to the console */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  const fields = Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, serialize(value)]),
  );
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields });
  if (level === "error" || level === "warn") {
    console.error(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
