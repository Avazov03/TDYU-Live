import { z } from "zod";

/**
 * Database ids are UUID-shaped. Zod 4 `z.uuid()` rejects ids whose variant
 * nibble is not RFC 4122 (local fixtures use that shape). Lookup still
 * requires the row to exist.
 */
export const entityIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
