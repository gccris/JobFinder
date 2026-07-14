"use client";

import { AlertCircle, CheckCircle2, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

type Message = { type: "success" | "error"; text: string } | null;

export function ProfileForm({ user }: { user: { name: string; email: string; image: string | null; hasPassword: boolean } }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [hasPassword, setHasPassword] = useState(user.hasPassword);
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [nameMessage, setNameMessage] = useState<Message>(null);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function updateName(event: FormEvent) {
    event.preventDefault();
    setSavingName(true);
    setNameMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o nome.");
      setName(data.user.name);
      setNameMessage({ type: "success", text: "Nome atualizado." });
      router.refresh();
    } catch (error) {
      setNameMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível atualizar o nome." });
    } finally {
      setSavingName(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const response = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar a senha.");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setHasPassword(true);
      setPasswordMessage({ type: "success", text: hasPassword ? "Senha atualizada." : "Senha criada. Agora você também pode entrar com email e senha." });
    } catch (error) {
      setPasswordMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível atualizar a senha." });
    } finally {
      setSavingPassword(false);
    }
  }

  function updatePasswordField(field: keyof typeof passwords, value: string) {
    setPasswords((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> Dados pessoais</CardTitle>
          <CardDescription>O email da conta não pode ser alterado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updateName} className="grid gap-4">
            <div className="grid gap-2"><Label htmlFor="profile-email">Email</Label><Input id="profile-email" value={user.email} disabled /></div>
            <div className="grid gap-2"><Label htmlFor="profile-name">Nome</Label><Input id="profile-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required /></div>
            <Feedback message={nameMessage} />
            <Button type="submit" className="w-fit" disabled={savingName}>{savingName ? <><span className="loading" /> Salvando...</> : "Salvar nome"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" /> {hasPassword ? "Trocar senha" : "Criar senha"}</CardTitle>
          <CardDescription>{hasPassword ? "Confirme sua senha atual antes de escolher uma nova." : "Sua conta usa o Google. Crie uma senha somente se também quiser acessar por email."}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={updatePassword} className="grid gap-4">
            {hasPassword && <div className="grid gap-2"><Label htmlFor="current-password">Senha atual</Label><Input id="current-password" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => updatePasswordField("currentPassword", event.target.value)} required /></div>}
            <div className="grid gap-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => updatePasswordField("newPassword", event.target.value)} minLength={6} required /></div>
            <div className="grid gap-2"><Label htmlFor="confirm-password">Confirmar nova senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={passwords.confirmPassword} onChange={(event) => updatePasswordField("confirmPassword", event.target.value)} minLength={6} required /></div>
            <Feedback message={passwordMessage} />
            <Button type="submit" className="w-fit" disabled={savingPassword}>{savingPassword ? <><span className="loading" /> Salvando...</> : hasPassword ? "Trocar senha" : "Criar senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  const Icon = message.type === "success" ? CheckCircle2 : AlertCircle;
  return <p role={message.type === "error" ? "alert" : "status"} className={message.type === "success" ? "flex items-center gap-2 text-sm text-emerald-600" : "flex items-center gap-2 text-sm text-red-600"}><Icon className="h-4 w-4" />{message.text}</p>;
}
