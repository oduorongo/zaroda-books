import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
// Explicit .ts extensions so this module also loads under plain node (the seed script).
import * as schema from "./schema.ts";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
export * as schema from "./schema.ts";
