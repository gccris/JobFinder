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
import { getCredentialSignInError, getOAuthSignInError } from "@/lib/login-result";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRegistered(params.get("registered") === "true");
    setError(getOAuthSignInError(params.get("error")) || "");
  }, []);

  function getDestination() {
    const requested = new URLSearchParams(window.location.search).get("callbackUrl");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    try {
      await signIn("google", { redirectTo: getDestination() });
    } catch {
      setError("Não foi possível iniciar o login pelo Google.");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
      const signInError = getCredentialSignInError(result);
      if (signInError) {
        setError(signInError);
        return;
      }
      router.push(getDestination());
      router.refresh();
    } catch {
      setError("Não foi possível entrar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Que bom ter você de volta" description="Entre para continuar sua busca e acompanhar suas candidaturas.">
      {registered && <div className="mb-5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">Cadastro realizado. O administrador liberará seu acesso assim que possível.</div>}
      {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <Button type="button" variant="secondary" size="lg" disabled={googleLoading || loading} className="w-full" onClick={handleGoogleSignIn}>
        {googleLoading ? <><span className="loading" /> Conectando...</> : <><GoogleIcon /> Continuar com Google</>}
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground"><span className="h-px flex-1 bg-border" /><span>ou</span><span className="h-px flex-1 bg-border" /></div>
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="grid gap-2"><Label htmlFor="email">Email</Label><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" className="pl-10" required /></div></div>
        <div className="grid gap-2"><Label htmlFor="password">Senha</Label><div className="relative"><LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" className="px-10" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-muted" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">{loading ? <><span className="loading" /> Entrando...</> : "Entrar"}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">Ainda não tem conta? <Link href="/register" className="font-semibold text-primary hover:underline">Cadastre-se gratuitamente</Link></p>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.7A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.5 14a6 6 0 0 1 0-3.9V7.4H3.1a10 10 0 0 0 0 9.3L6.5 14Z" />
      <path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.4l3.4 2.7A5.9 5.9 0 0 1 12 6Z" />
    </svg>
  );
}
