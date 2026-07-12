import { BriefcaseBusiness, CheckCircle2, Layers3, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] w-full max-w-7xl items-stretch lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,.42),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(14,165,233,.26),transparent_30%)]" />
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5 font-bold text-white hover:no-underline">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><BriefcaseBusiness className="h-5 w-5" /></span>
            JobHub
          </Link>
          <h2 className="mt-20 max-w-lg text-4xl font-bold leading-tight text-white">Sua busca profissional, reunida e organizada.</h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">Descubra oportunidades em múltiplas fontes e acompanhe cada candidatura sem perder o contexto.</p>
        </div>
        <div className="relative grid gap-4 text-sm text-slate-200">
          <AuthBenefit icon={Search} text="Vagas de diferentes plataformas" />
          <AuthBenefit icon={Layers3} text="Filtros e organização em um só lugar" />
          <AuthBenefit icon={ShieldCheck} text="Área pessoal protegida" />
        </div>
      </aside>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8 lg:px-14">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Link href="/" className="inline-flex items-center gap-2 font-bold text-foreground hover:no-underline"><BriefcaseBusiness className="h-5 w-5 text-primary" /> JobHub</Link></div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </div>
  );
}

function AuthBenefit({ icon: Icon, text }: { icon: typeof CheckCircle2; text: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-blue-300"><Icon className="h-4 w-4" /></span>{text}</div>;
}
