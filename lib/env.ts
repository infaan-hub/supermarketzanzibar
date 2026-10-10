// Centralized environment configuration. Secrets are read from process.env and
// never committed. `.env.example` documents the variable names only.

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
  databaseUrl: required("DATABASE_URL", process.env.DATABASE_URL),
  testDatabaseUrl: optional(process.env.TEST_DATABASE_URL),
  jwtSecret: required("JWT_SECRET", process.env.JWT_SECRET),
  googleClientId: optional(process.env.GOOGLE_CLIENT_ID),
  appUrl: optional(process.env.NEXT_PUBLIC_APP_URL) || "http://localhost:3000",
  nodeEnv: process.env.NODE_ENV ?? "development",
  get isProduction() {
    return this.nodeEnv === "production";
  },
};

// Token policy preserved from the original SimpleJWT configuration.
export const ACCESS_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
