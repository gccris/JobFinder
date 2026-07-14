import { getCurrentAdmin } from "@/lib/current-user";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getCurrentAdmin();

  // Apenas verificar se está logado
  if (!admin) {
    redirect("/login");
  }

  return <>{children}</>;
}
