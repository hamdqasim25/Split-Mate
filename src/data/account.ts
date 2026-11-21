import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/prisma/db";

/** Read only the signed-in account; browser-supplied identity is never accepted. */
export async function getCurrentAccount(): Promise<{ name: string; email: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.orm.public.User.select("name", "email").first({ id: user.id });
}
