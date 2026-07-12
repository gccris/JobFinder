import { db } from "@/lib/db";
import {
  syncLeverCompaniesFromFile,
} from "@/lib/scrapers/duckduckgo-search";
import { NextResponse } from "next/server";

/**
 * GET /api/lever/companies
 * Retorna lista de empresas Lever cadastradas
 */
export async function GET() {
  try {
    const companies = await db.leverCompany.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao buscar empresas",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lever/companies
 * Sincroniza empresas do arquivo TXT
 */
export async function POST() {
  try {
    console.log("🔄 Iniciando sincronização do arquivo...");

    const synced = await syncLeverCompaniesFromFile(db);

    if (synced === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Nenhuma empresa foi sincronizada. Verifique o arquivo.",
        },
        { status: 400 }
      );
    }

    const companies = await db.leverCompany.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({
      success: true,
      message: `${synced} empresas sincronizadas do arquivo`,
      synced,
      total: companies.length,
      companies,
    });
  } catch (error) {
    console.error("❌ Erro ao sincronizar:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao sincronizar empresas",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lever/companies
 * Remove todas as empresas Lever cadastradas
 */
export async function DELETE() {
  try {
    console.log("🗑️ Deletando todas as empresas Lever...");

    const result = await db.leverCompany.deleteMany({});

    console.log(`✅ ${result.count} empresas deletadas`);

    return NextResponse.json({
      success: true,
      message: `${result.count} empresas removidas`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("❌ Erro ao deletar empresas:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao remover empresas",
      },
      { status: 500 }
    );
  }
}
