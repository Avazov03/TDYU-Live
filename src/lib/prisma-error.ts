export function prismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
}

export function isUniqueConstraint(error: unknown) {
  return prismaErrorCode(error) === "P2002";
}
