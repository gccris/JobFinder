import { db } from "@/lib/db";
import { syncLeverJobs } from "@/lib/scrapers/lever";
import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/api-authorization";

/**
 * POST /api/jobs/sync/lever
 * Sincroniza vagas da plataforma Lever usando a API pública
 *
 * Body: {
 *   "site_name": "nome-da-empresa"
 * }
 *
 * Exemplos de site_name: "lever", "leverdemo", "uber", etc
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeAdmin();
    if (authorization.response) return authorization.response;
    const body = await request.json();
    const { site_name } = body;

    if (!site_name) {
      return NextResponse.json(
        {
          success: false,
          error:
            "site_name é obrigatório. Exemplo: 'lever', 'leverdemo', etc.",
          documentation:
            "https://github.com/lever/postings-api#lever-postings-api",
        },
        { status: 400 }
      );
    }

    console.log(`🔄 Sincronizando vagas da Lever: ${site_name}`);

    const synced = await syncLeverJobs(db, site_name);

    return NextResponse.json({
      success: true,
      message: `${synced} vagas foram sincronizadas da Lever`,
      synced,
      site_name,
      api_used: `https://api.lever.co/v0/postings/${site_name}`,
    });
  } catch (error) {
    console.error("❌ Erro ao sincronizar Lever:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao sincronizar vagas da Lever",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/sync/lever
 * Retorna informações sobre como sincronizar vagas da Lever
 */
export async function GET() {
  const authorization = await authorizeAdmin();
  if (authorization.response) return authorization.response;
  return NextResponse.json({
    service: "Lever Postings API - Public",
    description:
      "Sincroniza vagas da plataforma Lever. Este endpoint exige acesso administrativo.",
    documentation: "https://github.com/lever/postings-api",
    usage: {
      method: "POST",
      endpoint: "/api/jobs/sync/lever",
      body: {
        site_name: "nome-da-empresa",
      },
      example_curl:
        'curl -X POST http://localhost:3000/api/jobs/sync/lever -H "Content-Type: application/json" -d \'{"site_name": "leverdemo"}\'',
    },
    common_site_names: [
      "lever",
      "leverdemo",
      "uber",
      "rippling",
      "carta",
      "notion",
    ],
    how_to_find_site_name: [
      "1. Acesse https://jobs.lever.co/ (ou qualquer job board da Lever)",
      "2. Verifique a URL: https://jobs.lever.co/{SITE_NAME}",
      "3. O SITE_NAME é o que você precisa usar",
      "4. Ou procure no GitHub: https://github.com/lever/postings-api#lever-postings-api",
    ],
    api_endpoint_format:
      "https://api.lever.co/v0/postings/{site_name}?mode=json",
    features: [
      "Acesso administrativo obrigatório",
      "API de origem pública",
      "Deduplicação automática de vagas",
      "✅ Categorização automática",
      "✅ Limpeza de HTML da descrição",
    ],
  });
}
