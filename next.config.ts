import type { NextConfig } from "next";

/**
 * LEXIFY_SKIP_BUILD_TYPECHECK=1 — staging-only escape hatch when the
 * Lightsail box OOMs during `next build` typecheck. Local `npm run type-check`
 * remains the SoT. Never set on production.
 */
const skipBuildTypecheck =
  process.env.LEXIFY_SKIP_BUILD_TYPECHECK === "1" ||
  process.env.LEXIFY_SKIP_BUILD_TYPECHECK === "true";

const nextConfig: NextConfig = {
  typescript: skipBuildTypecheck ? { ignoreBuildErrors: true } : undefined,
};

export default nextConfig;
