// Centralized environment configuration. Secrets are read lazily from
// process.env so `next build` and unit tests that do not hit runtime secrets
// never fail at module import time.

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(value: string | undefined): string {
  return (value ?? "").trim();
}

export const env = {
  get databaseUrl(): string {
    return required("DATABASE_URL", process.env.DATABASE_URL);
  },
  get testDatabaseUrl(): string {
    return optional(process.env.TEST_DATABASE_URL);
  },
  get jwtSecret(): string {
    return required("JWT_SECRET", process.env.JWT_SECRET);
  },
  get googleClientId(): string {
    return optional(process.env.GOOGLE_CLIENT_ID);
  },
  get appUrl(): string {
    return optional(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000";
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get isProduction(): boolean {
    return this.nodeEnv === "production";
  },
  get smtpConfigured(): boolean {
    return Boolean(optional(process.env.SMTP_HOST));
  },
};

export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
