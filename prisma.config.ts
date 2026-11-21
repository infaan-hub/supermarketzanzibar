// Prisma configuration. Loads `.env` automatically when present and uses a
// syntactically valid placeholder only when running offline commands like
// `prisma generate` / `prisma validate` without a live database URL.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/supermarketzanzibar",
  },
});
