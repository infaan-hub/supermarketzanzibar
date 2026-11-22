#!/usr/bin/env node
// Non-destructive additive schema applier run during production deploys
// (`npm run build`) or manually (`npm run prisma:deploy:safe`).
//
// Reads the exact idempotent SQL in
// `prisma/migrations/20261122000000_add_digital_twin_models/migration.sql`
// and executes each statement safely without requiring a baselined
// `_prisma_migrations` table on legacy Django-origin Neon databases.
// Skips cleanly during offline/placeholder builds.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  __dirname,
  "../prisma/migrations/20261122000000_add_digital_twin_models/migration.sql",
);

function isUsableDatabaseUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("postgres://") && !trimmed.startsWith("postgresql://")) {
    return false;
  }
  if (trimmed.includes("placeholder:placeholder")) return false;
  return true;
}

/**
 * Split a PostgreSQL migration file into individual statements while keeping
 * `DO $$ ... $$;` dollar-quoted blocks intact.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inDollarQuote = false;
  const lines = sql.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!inDollarQuote && (trimmed === "" || trimmed.startsWith("--"))) {
      continue;
    }

    const dollarMatches = rawLine.match(/\$\$/g);
    if (dollarMatches && dollarMatches.length % 2 === 1) {
      inDollarQuote = !inDollarQuote;
    }

    current += `${rawLine}\n`;

    if (!inDollarQuote && trimmed.endsWith(";")) {
      const cleaned = current.trim().replace(/;$/, "").trim();
      if (cleaned) statements.push(cleaned);
      current = "";
    }
  }

  const tail = current.trim().replace(/;$/, "").trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!isUsableDatabaseUrl(dbUrl)) {
    console.log(
      "[ensure-schema] Skipping additive schema sync (no live DATABASE_URL configured).",
    );
    return;
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  const statements = splitSqlStatements(sql);
  const prisma = new PrismaClient();

  try {
    console.log(
      `[ensure-schema] Applying ${statements.length} idempotent additive statements...`,
    );
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }
    console.log(
      "[ensure-schema] Digital Twin additive tables & columns are up to date.",
    );
  } catch (error) {
    console.warn(
      "[ensure-schema] Warning: could not reach database during build; runtime auto-bootstrap will retry on first request.",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
