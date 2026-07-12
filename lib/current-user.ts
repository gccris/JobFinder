import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return db.user.findFirst({
    where: { email: { equals: session.user.email.trim(), mode: "insensitive" } },
  });
}

export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "ADMIN" ? user : null;
}
