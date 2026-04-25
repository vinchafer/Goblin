export function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  }));
}