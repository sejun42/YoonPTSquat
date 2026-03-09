import { z } from "zod";

export const clientInputSchema = z.object({
  name: z.string().trim().min(1, "회원 이름은 필수입니다.").max(60),
  phoneOrIdentifier: z.string().trim().max(80).optional().or(z.literal("")),
  memo: z.string().trim().max(600).optional().or(z.literal("")),
});

export const createSessionSchema = z.object({
  clientId: z.string().min(1),
  selectedView: z.enum(["front", "side", "rear"]),
  recordedAt: z.string().datetime().optional(),
});

export const publishReportSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
  replaceActiveLink: z.boolean().default(true),
});
