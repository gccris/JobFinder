"use client";

import { AlertCircle, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthShell } from "@/app/components/auth-shell";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError("As senhas não coincidem."); return; }
    if (form.password.length < 6) { setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim() }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Não foi possível criar sua conta."); return; }
      router.push("/login?registered=true");
    } catch {
      setError("Não foi possível criar sua conta agora. Tente novamente.");
    } finally { setLoading(false); }
  }

  return (
    <AuthShell title="Crie sua conta" description="Leva menos de um minuto para começar a organizar suas oportunidades.">
      {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Field id="name" label="Nome" icon={UserRound}><Input id="name" autoComplete="name" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Como podemos chamar você?" className="pl-10" required /></Field>
        <Field id="email" label="Email" icon={Mail}><Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="voce@exemplo.com" className="pl-10" required /></Field>
        <Field id="password" label="Senha" icon={LockKeyhole}><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="Mínimo de 6 caracteres" className="px-10" minLength={6} required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-md bg-transparent p-0 text-muted-foreground hover:bg-muted" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></Field>
        <Field id="confirmPassword" label="Confirmar senha" icon={LockKeyhole}><Input id="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder="Repita sua senha" className="pl-10" minLength={6} required /></Field>
        <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">{loading ? <><span className="loading" /> Criando conta...</> : "Criar minha conta"}</Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">Já tem cadastro? <Link href="/login" className="font-semibold text-primary hover:underline">Entre na sua conta</Link></p>
    </AuthShell>
  );
}

function Field({ id, label, icon: Icon, children }: { id: string; label: string; icon: typeof UserRound; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label htmlFor={id}>{label}</Label><div className="relative"><Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />{children}</div></div>;
}
