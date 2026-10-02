import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  // Import inside the runtime check so the edge bundle never pulls in Prisma/pg.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { alertRequestError } = await import("@/lib/ops-alert");
    const error = err as Error & { digest?: string };
    await alertRequestError({
      message: error?.message ?? String(err),
      digest: error?.digest,
      stack: error?.stack,
      method: request.method,
      path: request.path,
      routePath: context.routePath,
      routeType: context.routeType,
    });
  }
};
