import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/profile");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meu perfil</h1>
        <p className="mt-2 text-muted-foreground">Atualize seus dados pessoais e as opções de acesso.</p>
      </div>
      <ProfileForm
        user={{
          name: user.name || "",
          email: user.email,
          image: user.image,
          hasPassword: Boolean(user.password),
        }}
      />
    </div>
  );
}
