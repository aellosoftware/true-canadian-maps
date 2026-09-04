import { count } from "drizzle-orm";
import { users } from "@tcm/db";
import { db } from "../db";

/** The installation needs first-run setup while no user exists. */
export async function needsSetup(): Promise<boolean> {
  const [row] = await db().select({ n: count() }).from(users);
  return Number(row?.n ?? 0) === 0;
}
