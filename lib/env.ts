import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-5"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_LOCK_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value.toLowerCase() === "true"),
  APP_ACCESS_TOKEN: z.string().optional()
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_LOCK_ENABLED: process.env.APP_LOCK_ENABLED,
    APP_ACCESS_TOKEN: process.env.APP_ACCESS_TOKEN
  });

  return cachedEnv;
}

export function assertProductionEnv() {
  const env = getServerEnv();
  const shouldEnforce =
    process.env.VERCEL_ENV === "production" ||
    process.env.ENFORCE_PRODUCTION_ENV_VALIDATION === "true";

  if (env.NODE_ENV !== "production" || !shouldEnforce) {
    return;
  }

  const missing: string[] = [];

  if (!env.NEXT_PUBLIC_APP_URL) missing.push("NEXT_PUBLIC_APP_URL");
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!env.APP_LOCK_ENABLED) missing.push("APP_LOCK_ENABLED=true");
  if (!env.APP_ACCESS_TOKEN) missing.push("APP_ACCESS_TOKEN");

  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(", ")}`
    );
  }
}
