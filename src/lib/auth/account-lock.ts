import "server-only";
import { db } from "@/prisma/db";

/** A no-op primary-key update holds a PostgreSQL row lock until transaction end.
 * All login issuance and password changes must take this lock before session writes.
 * Never supply a password hash from before the lock as an UPDATE value here.
 */
export async function lockAccount(client: Pick<typeof db, "orm">, userId: number) {
  const rows = await client.orm.public.User.where({ id: userId })
    .select("id", "passwordHash").updateAll({ id: userId });
  return rows[0] ?? null;
}
