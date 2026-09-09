type AuthLogMeta = Record<string, unknown>;

function serializeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function authLog(event: string, meta: AuthLogMeta = {}) {
  console.info(
    JSON.stringify({
      scope: "auth",
      level: "info",
      event,
      ts: new Date().toISOString(),
      ...meta,
    }),
  );
}

export function authError(event: string, error: unknown, meta: AuthLogMeta = {}) {
  console.error(
    JSON.stringify({
      scope: "auth",
      level: "error",
      event,
      error: serializeError(error),
      ts: new Date().toISOString(),
      ...meta,
    }),
  );
}
