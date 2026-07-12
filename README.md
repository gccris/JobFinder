# JobHub - Agregador de Vagas de Emprego

Um site que agrega anúncios de emprego de múltiplas APIs (LinkedIn, Indeed, customizadas) em uma base de dados centralizada com autenticação de usuários e sistema de admin.

## 🚀 Quick Start (Com Docker)

### Pré-requisitos:
- Docker Desktop instalado
- Docker Compose

### 1. Inicie tudo:
```bash
docker-compose up --build
```

### 2. Acesse:
```
http://localhost:3000
```

Pronto! ✨ Sem conflitos de versão, sem problemas de setup.

---

## 📚 Documentação Completa

Para todos os detalhes de configuração, estrutura do projeto e deployment:

**→ Veja [`SETUP.md`](./SETUP.md)**

---

## 🔑 Funcionalidades Principais

### Para Usuários
- ✅ Cadastro e login com email/senha
- ✅ Buscar vagas com filtros
- ✅ Salvar vagas favoritas
- ✅ Dashboard pessoal

### Para Admin
- ✅ Sincronização de fontes em paralelo, executada em background
- ✅ Gestão de vagas
- ✅ Analytics e estatísticas

---

## 📊 Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **Background jobs**: Redis + BullMQ, em worker isolado
- **Auth**: NextAuth.js
- **Styling**: Tailwind CSS
- **ORM**: Prisma
- **Deployment**: Docker + Docker Compose

Os limites do worker podem ser ajustados por `SYNC_SOURCE_CONCURRENCY`,
`SYNC_COMPANY_CONCURRENCY`, `SYNC_HTTP_CONCURRENCY`,
`SYNC_DB_WRITE_CONCURRENCY`, `SYNC_HTTP_TIMEOUT_MS` e `SYNC_HTTP_RETRIES`.

---

## 🛠️ Mais informações

- [Guia de Setup Completo](./SETUP.md)
- [Configuração com Docker](./DOCKER-SETUP.md)
