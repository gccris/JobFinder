import MarketingHome from "@/app/components/marketing-home";
import AuthenticatedHome from "@/app/components/authenticated-home";
import { auth } from "@/lib/auth";
import { getHomeStats } from "@/lib/home-stats";

export default async function Home() {
  const session = await auth();
  if (!session?.user) return <MarketingHome />;

  const stats = await getHomeStats();
  return <AuthenticatedHome userName={session.user.name || "Olá"} stats={stats} />;
}
