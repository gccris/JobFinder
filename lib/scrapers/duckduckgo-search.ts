import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Lê a lista de empresas Lever do arquivo público
 * Formato: https://jobs.lever.co/[company-name]
 */
async function readLeverCompaniesFromFile(): Promise<string[]> {
  const companies = new Set<string>();

  try {
    console.log("📖 Lendo lista de empresas do arquivo...");

    // Ler arquivo da pasta public
    const filePath = join(process.cwd(), "public", "lever_companies.txt");
    const content = await readFile(filePath, "utf-8");

    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extrair company name da URL
      // Formato: https://jobs.lever.co/company-name
      const match = trimmed.match(/https?:\/\/jobs\.lever\.co\/([a-zA-Z0-9-]+)/i);

      if (match && match[1]) {
        const companyName = match[1].toLowerCase();
        companies.add(companyName);
      }
    }

    console.log(`✅ Found ${companies.size} companies from file`);
  } catch (error) {
    console.error("❌ Erro ao ler arquivo:", error);
  }

  return Array.from(companies);
}

/**
 * Sincroniza empresas Lever com o banco de dados
 * Lê do arquivo public/lever_companies.txt
 */
export async function syncLeverCompaniesFromFile(
  db: Pick<PrismaClient, "leverCompany">
): Promise<number> {
  try {
    console.log("🔄 Sincronizando do arquivo...");

    const companies = await readLeverCompaniesFromFile();

    if (companies.length === 0) {
      console.log("📭 Nenhuma empresa encontrada no arquivo");
      return 0;
    }

    console.log(`📊 Sincronizando ${companies.length} empresas...`);

    let syncedCount = 0;
    for (const siteNameValue of companies) {
      try {
        await db.leverCompany.upsert({
          where: { siteName: siteNameValue },
          update: { lastSync: new Date() },
          create: {
            siteName: siteNameValue,
            name: siteNameValue,
            url: `https://${siteNameValue}.jobs.lever.co`,
            lastSync: new Date(),
          },
        });
        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing ${siteNameValue}:`, error);
      }
    }

    console.log(`✅ Synced ${syncedCount} companies from file`);
    return syncedCount;
  } catch (error) {
    console.error("❌ Erro durante sincronização:", error);
    return 0;
  }
}

// Manter compatibilidade com código antigo
export const syncLeverCompanies = syncLeverCompaniesFromFile;
