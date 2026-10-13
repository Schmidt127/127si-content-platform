import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "..", "supabase", "migrations");

// Minimal stand-ins for the Supabase-managed objects the migrations reference.
// Default privileges mirror Supabase: anon and authenticated receive table
// grants, so row-level security is the effective barrier.
const SUPABASE_STUBS = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort();
}

export async function createMigratedDatabase(options: { through?: string } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    if (options.through && file === options.through) break;
  }
  return db;
}

export async function runMigration(db: PGlite, file: string) {
  await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
}

/** Run a query as a Supabase API role so row-level security applies. */
export async function asRole<T>(db: PGlite, role: "anon" | "authenticated", fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
