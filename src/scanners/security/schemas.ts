import { z } from "zod";

const cookieFactSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    secure: z.boolean(),
    httpOnly: z.boolean(),
    sameSite: z.enum(["strict", "lax", "none"]).optional(),
  })
  .strict();

export const securityPageSnapshotSchema = z
  .object({
    url: z.url(),
    finalUrl: z.url(),
    statusCode: z.number().int().min(100).max(599).optional(),
    isHttps: z.boolean(),
    httpRedirectsToHttps: z.boolean().optional(),
    headers: z.record(z.string(), z.string().max(5_000)),
    cookies: z.array(cookieFactSchema).max(100),
    mixedContentCount: z.number().int().nonnegative(),
    mixedContentSelectors: z.array(z.string().max(200)).max(10),
    hasPrivacyPolicyLink: z.boolean(),
    hasCookieConsentSignal: z.boolean(),
  })
  .strict();
