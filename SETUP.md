# JobHub - Guia Completo de Setup

## 🚀 Opção 1: Setup com Docker (RECOMENDADO) ⭐

### Pré-requisitos:
- Docker Desktop instalado
- Docker Compose

### Passos:

```bash
# 1. Entre no diretório
cd job-aggregator

# 2. Inicie tudo com um comando
docker-compose up --build
```

Isso vai:
- ✅ Criar a imagem do Next.js
- ✅ Iniciar PostgreSQL automaticamente
- ✅ Instalar todas as dependências
- ✅ Rodar migrations
- ✅ Iniciar o servidor de desenvolvimento

### 3. Acesse
```
http://localhost:3000
```

### Comandos úteis com Docker:

```bash
# Ver logs em tempo real
docker-compose logs -f app

# Rodar migrations
docker-compose exec app npm run prisma:migrate

# Acessar o Prisma Studio (UI do banco)
docker-compose exec app npm run prisma:studio

# Parar os containers
docker-compose down

# Reconstruir (se mudar dependências)
docker-compose up --build
```

---

## 🔧 Opção 2: Setup Local (Sem Docker)

Se você preferir não usar Docker, siga os passos abaixo:

### 1. Clonar e Instalar Dependências

```bash
cd job-aggregator
npm install
```

### 2. Configurar PostgreSQL

Você pode usar:
- **Local**: PostgreSQL instalado localmente
- **Docker só do DB**: `docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres`
- **Cloud**: Supabase, Railway, Render

Crie um banco de dados:
```sql
CREATE DATABASE job_aggregator;
```

### 3. Configurar Variáveis de Ambiente

Edite `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/job_aggregator"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Job Sync
SYNC_INTERVAL=21600000 # 6 horas em ms

# LinkedIn (se usar API)
LINKEDIN_API_KEY="YOUR_KEY_HERE"

# Indeed
INDEED_BASE_URL="https://www.indeed.com"
```

### 4. Setup Prisma

```bash
# Criar migrations
npx prisma migrate dev --name init

# (Opcional) Seed do banco
npx prisma db seed
```

### 5. Executar Localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## 📋 Estrutura do Projeto

```
job-aggregator/
├── app/
│   ├── api/                 # API Routes (Next.js)
│   ├── page.tsx            # Home page
│   ├── login/              # Login page
│   ├── register/           # Registro
│   └── jobs/               # Listagem e detalhes de vagas
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── db.ts              # Prisma singleton
│   ├── sync-jobs.ts       # Lógica de sincronização
│   └── scrapers/          # Scrapers (LinkedIn, Indeed)
├── prisma/
│   └── schema.prisma      # Schema do banco
├── Dockerfile             # Configuração Docker
├── docker-compose.yml     # Orquestração Docker
└── middleware.ts          # Proteção de rotas
```

---

## 📝 Funcionalidades Principais

### Para Usuários
- ✅ Cadastro e login com email/senha
- ✅ Buscar vagas com filtros (categoria, localização, texto)
- ✅ Salvar vagas favoritas
- ✅ Visualizar detalhes completos das vagas
- ✅ Dashboard com vagas salvas

### Para Admin
- ✅ Sincronização manual de vagas (`POST /api/admin/sync`)
- ✅ Listar todas as vagas com analytics (`GET /api/admin/jobs`)
- ✅ Deletar vagas (`DELETE /api/admin/jobs/:id`)
- ✅ Inserir vagas em lote (`POST /api/admin/jobs/bulk`)

### Sincronização de Vagas
- 🔄 Automática a cada 6 horas (configurável)
- 🔄 Manual sob demanda (apenas admin)
- 🔄 Deduplicação automática por source + externalId
- 🔄 Suporte a LinkedIn, Indeed e APIs customizadas

---

## 🌐 Deployment

### Option 1: Docker + VPS

```bash
# Build da imagem
docker build -t job-aggregator .

# Rodar container
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e NEXTAUTH_URL="https://seu-dominio.com" \
  -p 3000:3000 \
  job-aggregator
```

Ou use `docker-compose.yml` em produção (mais recomendado).

### Option 2: Vercel (Recomendado para Next.js)

```bash
# 1. Push para GitHub
git push origin main

# 2. Conectar Vercel
vercel

# 3. Configurar variáveis de ambiente no painel Vercel
# DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

# 4. Deploy automático
```

### Option 3: Railway/Render

1. **PostgreSQL**:
   - Railway: Criar database PostgreSQL
   - Render: Criar Postgres Database

2. **Next.js App**:
   - Railway: Conectar repositório e fazer deploy
   - Render: Conectar repositório e fazer deploy

3. **Variáveis de Ambiente**:
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_SECRET=...
   NEXTAUTH_URL=https://seu-dominio.com
   NODE_ENV=production
   ```

---

## 📊 Modelos de Dados

### User
```
id: String (PK)
email: String (unique)
name: String
password: String (hashed)
role: UserRole (USER | ADMIN)
createdAt: DateTime
updatedAt: DateTime
```

### Job
```
id: String (PK)
title: String
description: String
company: String
location: String
salary: String (opcional)
source: String (linkedin|indeed|custom)
externalId: String
url: String
category: JobCategory (BACKEND|FRONTEND|FULLSTACK|DEVOPS|DATASCIENCE|PRODUCT)
tags: String[]
postedAt: DateTime
expiresAt: DateTime (opcional)
createdAt: DateTime
updatedAt: DateTime
```

### SavedJob
```
id: String (PK)
userId: String (FK)
jobId: String (FK)
savedAt: DateTime
unique: (userId, jobId)
```

---

## 🔌 Integração com APIs

### LinkedIn
- Atualmente com placeholder
- Futuros: usar Python scraper ou Bright Data proxy

### Indeed
- Atualmente com placeholder
- Futuros: usar web scraping com puppeteer/cheerio

### APIs Customizadas
- Endpoint: `POST /api/admin/jobs/bulk`
- Format esperado:
```json
[
  {
    "title": "Senior Backend Developer",
    "description": "...",
    "company": "TechCorp",
    "location": "São Paulo, SP",
    "salary": "R$ 15.000-20.000",
    "category": "BACKEND",
    "source": "custom",
    "externalId": "unique-id",
    "url": "https://...",
    "postedAt": "2026-04-09T00:00:00Z"
  }
]
```

---

## 🛠️ Próximos Passos / Melhorias

- [ ] Implementar scraping real de Indeed (puppeteer)
- [ ] Implementar scraping real de LinkedIn (API ou proxy)
- [ ] Adicionar notificações por email para vagas salvas
- [ ] Analytics dashboard para admin
- [ ] Integração com Slack/Discord
- [ ] Exportar vagas para CSV/PDF
- [ ] Recomendações baseadas em preferências
- [ ] Sistema de aplicações (salvar + enviar para plataforma)
- [ ] Admin panel com UI (não apenas APIs)

---

## 🐛 Troubleshooting

### Com Docker:

**Erro de porta já em uso:**
```bash
# Mudar portas no docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
  - "5433:5432"  # Host:Container
```

**Rebuild completo:**
```bash
docker-compose down -v  # Remove volumes também
docker-compose up --build
```

### Setup Local:

**Erro de conexão com banco:**
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Testar conexão
npx prisma db execute --stdin < /dev/null
```

**Erro de autenticação:**
- Verificar NEXTAUTH_SECRET está definido
- Verificar NEXTAUTH_URL está correto
- Limpar cookies do navegador

**Migrations travadas:**
```bash
npx prisma migrate resolve --rolled-back
npx prisma migrate dev
```

---

## 📞 Contato / Suporte

Para problemas:
1. Verificar logs: `docker-compose logs app` ou `npx prisma studio`
2. Verificar browser console para erros no frontend
3. Verificar servidor Node para erros do backend

---

## 📜 Licença

MIT
