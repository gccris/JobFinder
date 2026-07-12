import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";

const sources = ["Lever", "Greenhouse", "Ashby", "Teamtailor", "Workable", "JazzHR", "SmartRecruiters"];
const benefits = [
  [Search, "Busca centralizada", "Explore oportunidades de diferentes plataformas sem alternar entre dezenas de sites."],
  [SlidersHorizontal, "Filtros que ajudam", "Refine por área, localização, modalidade, senioridade e características importantes."],
  [LayoutDashboard, "Acompanhe sua jornada", "Salve vagas e organize candidaturas em um painel visual, do interesse até a aprovação."],
] as const;

export default function MarketingHome() {
  return (
    <div className="overflow-hidden bg-background">
      <section className="relative isolate border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_85%_30%,rgba(14,165,233,0.12),transparent_28%)]" />
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" /> Mais fontes. Menos abas abertas.
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-[-0.035em] text-foreground sm:text-6xl lg:text-7xl">
              Encontre oportunidades que combinam com você.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              O JobHub reúne vagas de diferentes plataformas e ajuda você a buscar, salvar e acompanhar cada candidatura em um só lugar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/register">Criar conta gratuita <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild variant="secondary" size="lg"><Link href="/login">Já tenho uma conta</Link></Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              {["Cadastro rápido", "Busca avançada", "Painel de candidaturas"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> {item}</span>
              ))}
            </div>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-b border-border bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Fontes integradas</p>
          <div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {sources.map((source) => <span key={source} className="text-sm font-semibold text-foreground/70">{source}</span>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Uma busca mais simples</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Tudo para organizar sua procura</h2>
          <p className="mt-4 text-muted-foreground">Da descoberta da vaga ao acompanhamento do processo seletivo.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {benefits.map(([Icon, title, description]) => (
            <Card key={title} className="group transition hover:-translate-y-1 hover:shadow-md">
              <CardContent className="p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <span className="text-sm font-bold uppercase tracking-[0.16em] text-primary">Seu processo, sob controle</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Comece em três passos</h2>
            <div className="mt-8 grid gap-6">
              <Step icon={Search} title="1. Encontre" text="Use filtros para chegar às oportunidades mais relevantes." />
              <Step icon={Bookmark} title="2. Organize" text="Salve o que chamou atenção e registre suas candidaturas." />
              <Step icon={LayoutDashboard} title="3. Acompanhe" text="Mova cada processo pelo painel e visualize sua evolução." />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-background p-3 shadow-lg">
            <div className="grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-2">
              {[['Salvas', 12], ['Aplicadas', 7], ['Entrevistas', 3], ['Aprovadas', 1]].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold text-foreground">{value}</p></div>
              ))}
            </div>
            <p className="px-2 pt-3 text-center text-xs text-muted-foreground">Prévia ilustrativa — dados de exemplo</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center text-white shadow-xl sm:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,.42),transparent_35%)]" />
          <div className="relative">
            <ShieldCheck className="mx-auto h-9 w-9 text-blue-300" />
            <h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">Sua próxima oportunidade começa aqui.</h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">Transforme uma busca espalhada em um processo claro e organizado.</p>
            <Button asChild size="lg" className="mt-7 bg-white text-slate-950 hover:bg-slate-100"><Link href="/register">Começar agora <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return <div className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon className="h-5 w-5" /></span><div><h3 className="font-bold text-foreground">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{text}</p></div></div>;
}

function ProductPreview() {
  const jobs = [["Product Designer", "Aurora Labs", "São Paulo · Híbrido"], ["Analista Financeiro", "Norte & Co.", "Remoto"], ["Pessoa Desenvolvedora", "Orbit Systems", "Curitiba · Remoto"]];
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-primary/15 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="ml-auto rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">Prévia ilustrativa</span></div>
        <div className="grid gap-4 p-5 sm:grid-cols-[150px_1fr]">
          <div className="hidden rounded-2xl bg-muted p-4 sm:block"><div className="mb-4 flex items-center gap-2 text-xs font-bold text-foreground"><SlidersHorizontal className="h-4 w-4" /> Filtros</div>{["Área", "Localização", "Modalidade", "Senioridade"].map((item) => <div key={item} className="mb-2.5 rounded-lg bg-card px-3 py-2 text-[11px] text-muted-foreground">{item}</div>)}</div>
          <div className="grid gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground"><Search className="h-4 w-4" /> Busque por cargo ou habilidade</div>
            {jobs.map(([title, company, location], index) => <div key={title} className="rounded-xl border border-border bg-background p-4"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{index === 0 ? <BriefcaseBusiness className="h-4 w-4" /> : index === 1 ? <Building2 className="h-4 w-4" /> : <Search className="h-4 w-4" />}</span><div><h3 className="text-sm font-bold text-foreground">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{company}</p><p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> {location}</p></div></div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
