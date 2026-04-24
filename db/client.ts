import { neon } from "@netlify/neon";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

const sqlClient = neon();
export const db = drizzle(sqlClient, { schema });
export { schema };
