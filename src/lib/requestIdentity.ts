import { headers } from "next/headers";

/** Best-effort caller identity for rate limiting — falls back to a constant key in local dev. */
export async function getRateLimitKey(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
