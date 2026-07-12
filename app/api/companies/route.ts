import { getRegisteredCompanies } from "@/lib/companies";
import { authorizeUser } from "@/lib/api-authorization";
import { NextResponse } from "next/server";

export async function GET() {
  const authorization = await authorizeUser();
  if (authorization.response) return authorization.response;
  try {
    const companies = await getRegisteredCompanies();

    return NextResponse.json({
      success: true,
      count: companies.length,
      companies,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao extrair empresas dos arquivos JSON",
      },
      { status: 500 }
    );
  }
}
