"use client";

import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthShell } from "@/app/components/auth-shell";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => setRegistered(new URLSearchParams(window.location.search).get("registered") === "true"), []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
      if (!result?.ok) {
        setError("Email ou senha incorretos. Verifique os dados e tente novamente.");
        return;
      }
      const requested = new URLSearchParams(window.location.search).get("callbackUrl");
      const destination = requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.push(destination);
      router.refresh();
    } catch {
      setError("Não foi possível entrar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Que bom ter você de volta" description="Entre para continuar sua busca e acompanhar suas candidaturas.">
      {registered && <div className="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">Conta criada com sucesso. Faça seu login para continuar.</div>}
      {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" className="pl-10" required /></div></div>
        <div className="grid gap-2"><Label htmlFor="password">Senha</Label><div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className="px-10" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-muted" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">{loading ? <><span className="loading" /> Entrando...</> : "Entrar"}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">Ainda não tem conta? <Link href="/register" className="font-semibold text-primary hover:underline">Cadastre-se gratuitamente</Link></p>
    </AuthShell>
  );
}
