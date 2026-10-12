import { z } from 'zod';

const baseSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(3000),
  APP_URL: z.url(),
  FRONTEND_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_DAYS: z.coerce.number().int().positive().default(30),
  MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  /** Optional reading assistant; credentials never reach the browser. */
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL: z.url().default('https://api.together.ai/v1'),
  /**
   * Mail goes through Resend's HTTPS API when this is set, otherwise over
   * SMTP. Production needs the API: Railway blocks outbound SMTP below Pro.
   */
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1),
  FETCH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  /**
   * Proxies in front of the API (load balancer, CDN). Rate limits key on the
   * client IP, which is only right if Express knows how many hops to trust.
   * 0 locally; e.g. 1 behind Railway, 2 behind Cloudflare + Railway.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /**
   * Ops alerts to a Telegram chat (new readers, new blogs, errors). Both
   * are optional; without them alerts are skipped.
   */
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export const envSchema = baseSchema.refine(
  (env) => env.RESEND_API_KEY || env.SMTP_HOST,
  {
    message: 'Set RESEND_API_KEY or SMTP_HOST so Tidepool can send email',
    path: ['RESEND_API_KEY'],
  },
);

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** BullMQ wants ioredis options rather than a URL. */
export function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0),
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}
