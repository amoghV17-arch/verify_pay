import { z } from 'zod';

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8080),
    APP_BASE_URL: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z
      .string()
      .min(1)
      .default('postgres://milestone:milestone@localhost:5432/milestone'),
    SESSION_SECRET: z.string().min(16).default('development-session-secret-at-least-32-chars'),

    // PayPal configuration - ONLY mock and sandbox are permitted
    PAYPAL_ENV: z.enum(['mock', 'sandbox'], {
      errorMap: (_issue, ctx) => {
        if (ctx.data === 'live') {
          return {
            message:
              'CRITICAL SECURITY GUARD: PAYPAL_ENV cannot be "live". Milestone is strictly a sandbox application.',
          };
        }
        return { message: 'PAYPAL_ENV must be either "mock" or "sandbox".' };
      },
    }).default('mock'),
    PAYPAL_CLIENT_ID: z.string().optional().default(''),
    PAYPAL_CLIENT_SECRET: z.string().optional().default(''),
    PAYPAL_WEBHOOK_ID: z.string().optional().default(''),
    DEMO_FREELANCER_PAYPAL_EMAIL: z.string().optional().default(''),

    // LLM provider
    LLM_PROVIDER: z.enum(['anthropic', 'gemini', 'openai-compatible', 'fixture']).optional(),
    LLM_API_KEY: z.string().optional().default(''),
    LLM_MODEL: z.string().optional().default(''),
    LLM_BASE_URL: z.string().optional().default(''),

    // Review & Autonomy
    REVIEW_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.75),
    ASSISTED_RELEASE_WINDOW_SECONDS: z.coerce.number().int().positive().default(20),

    // Demo & abuse guardrails
    DEMO_MODE: z
      .union([z.boolean(), z.string()])
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        return ['true', '1', 'yes', 'on'].includes(val.trim().toLowerCase());
      })
      .optional()
      .default(false),
    DEMO_SANDBOX_BUYER_EMAIL: z.string().optional(),
    DEMO_SANDBOX_BUYER_PASSWORD: z.string().optional(),
    DAILY_LLM_CAP: z.coerce.number().int().positive().optional(),

    // Accounts, Email & OAuth
    EMAIL_PROVIDER: z.enum(['outbox', 'resend', 'smtp']).default('outbox'),
    EMAIL_FROM: z.string().optional().default('Milestone <noreply@milestone.local>'),
    RESEND_API_KEY: z.string().optional().default(''),
    SMTP_HOST: z.string().optional().default(''),
    SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    EMAIL_VERIFICATION: z.enum(['off', 'soft', 'required']).default('soft'),
    GOOGLE_CLIENT_ID: z.string().optional().default(''),
    GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
    SUPPORT_EMAIL: z.string().optional().default(''),

    // Bryntum
    BRYNTUM_PACKAGE: z.enum(['trial', 'licensed']).default('trial'),
  })
  .superRefine((data, ctx) => {
    // Unsafe combination guards
    if (data.NODE_ENV === 'production') {
      if (data.LLM_PROVIDER === 'fixture') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'CRITICAL SECURITY GUARD: LLM_PROVIDER cannot be "fixture" in production. Fixtures are strictly prohibited in production.',
          path: ['LLM_PROVIDER'],
        });
      }
      if (!data.LLM_PROVIDER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LLM_PROVIDER must be configured in production.',
          path: ['LLM_PROVIDER'],
        });
      }
    }

    if (data.LLM_PROVIDER && data.LLM_PROVIDER !== 'fixture' && !data.LLM_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `LLM_API_KEY must be provided when LLM_PROVIDER is "${data.LLM_PROVIDER}".`,
        path: ['LLM_API_KEY'],
      });
    }

    if (data.PAYPAL_ENV === 'sandbox' && data.NODE_ENV === 'production') {
      if (!data.PAYPAL_CLIENT_ID || !data.PAYPAL_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured when running in sandbox mode in production.',
          path: ['PAYPAL_CLIENT_ID'],
        });
      }
    }
  });

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(envInput: Record<string, string | undefined> = process.env): AppConfig {
  const result = EnvSchema.safeParse(envInput);
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((err) => `  - ${err.path.join('.') || 'root'}: ${err.message}`)
      .join('\n');
    throw new Error(`[Config Error] Invalid environment configuration:\n${formattedErrors}`);
  }
  return result.data;
}

