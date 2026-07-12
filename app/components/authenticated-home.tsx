import { ArrowRight, Building2, CheckCircle2, Database, LayoutDashboard, Search, Sparkles } from "lucide-react";
import Link from "next/link";

import type { getHomeStats } from "@/lib/home-stats";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

type HomeStats = Awaited<ReturnType<typeof getHomeStats>>;

export default function AuthenticatedHome({ userName, stats }: { userName: string; stats: HomeStats }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> Sua central de oportunidades</span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Olá, {firstName(userName)}.</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Encontre vagas, conheça as empresas monitoradas e acompanhe cada candidatura sem perder o contexto.</p>
        </div>
        <Button asChild size="lg"><Link href="/jobs"><Search className="h-4 w-4" /> Buscar vagas</Link></Button>
      </div>

      <section aria-label="Resumo" className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Search} label="Vagas abertas" value={stats.totalOpenJobs.toLocaleString("pt-BR")} detail="disponíveis agora" />
        <MetricCard icon={Database} label="Fontes ativas" value={String(stats.activeSources)} detail={`de ${stats.sources.length} integrações`} />
        <MetricCard icon={Building2} label="Plataformas" value={String(stats.sources.length)} detail="monitoradas pelo JobHub" />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div><h2 className="text-lg font-bold text-foreground">Vagas por fonte</h2><p className="mt-1 text-sm text-muted-foreground">Quantidade de oportunidades abertas atualmente no sistema.</p></div>
            <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Atualizado em tempo real</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">Fonte</th><th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-6">Vagas abertas</th></tr></thead>
              <tbody>
                {stats.sources.map((source, index) => (
                  <tr key={source.source} className="border-b border-border/70 last:border-0 hover:bg-muted/35">
                    <td className="px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{String(index + 1).padStart(2, "0")}</span><div><p className="font-semibold text-foreground">{source.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{source.source}</p></div></div></td>
                    <td className="px-5 py-4 text-right sm:px-6"><span className="inline-flex min-w-14 justify-center rounded-lg bg-muted px-3 py-1.5 font-bold tabular-nums text-foreground">{source.openJobs.toLocaleString("pt-BR")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold text-foreground">Como começar</h2>
              <p className="mt-1 text-sm text-muted-foreground">Três passos para aproveitar o JobHub.</p>
              <div className="mt-6 grid gap-5">
                <OnboardingStep number="1" title="Encontre" text="Pesquise por cargo, localização e modalidade." />
                <OnboardingStep number="2" title="Salve" text="Guarde vagas interessantes para revisar depois." />
                <OnboardingStep number="3" title="Acompanhe" text="Organize candidaturas no seu dashboard." />
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              <h2 className="mt-4 font-bold text-foreground">Seu processo em um só painel</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Veja vagas salvas, candidaturas e evolução por etapa.</p>
              <Button asChild variant="secondary" className="mt-5 w-full"><Link href="/dashboard">Abrir dashboard <ArrowRight className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Search; label: string; value: string; detail: string }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><div><p className="text-sm font-medium text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-2xl font-bold text-foreground">{value}</strong><span className="text-xs text-muted-foreground">{detail}</span></div></div></CardContent></Card>;
}

function OnboardingStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><div><h3 className="text-sm font-bold text-foreground">{title}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p></div><CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-primary/45" /></div>;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Olá";
}
