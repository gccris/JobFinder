# Job Aggregator - Setup com Docker

## 🚀 Quick Start

### Pré-requisitos:
- Docker Desktop instalado
- Docker Compose

### 1. Clone/Acesse o projeto:
```bash
cd job-aggregator
```

### 2. Inicie tudo com um comando:
```bash
docker-compose up --build
```

O Docker vai:
- ✅ Criar a imagem Next.js
- ✅ Iniciar PostgreSQL
- ✅ Instalar todas as dependências
- ✅ Rodar migrations automaticamente
- ✅ Iniciar o dev server

### 3. Acesse a aplicação:
```
http://localhost:3000
```

### 4. Parar os containers:
```bash
docker-compose down
```

---

## 📊 Acessar banco de dados

### Via pgAdmin (recomendado):
```bash
# Adicione ao docker-compose.yml:
docker-compose exec db psql -U jobuser -d job_aggregator
```

### Ou via CLI:
```bash
docker-compose exec db psql -U jobuser -d job_aggregator
```

---

## 🔧 Comandos úteis

```bash
# Ver logs
docker-compose logs -f app

# Executar migrations
docker-compose exec app npm run prisma:migrate

# Acessar Prisma Studio
docker-compose exec app npm run prisma:studio

# Rebuild (se mudar dependências)
docker-compose up --build
```

---

## 📝 Environment Variables

Estão no `docker-compose.yml`. Para mudar:

```yaml
environment:
  NEXTAUTH_SECRET: "sua-chave-secreta"
  DATABASE_URL: "postgresql://..."
```

---

## ✨ Vantagens dessa abordagem:

✅ Sem conflitos de versão
✅ Funciona igual em qualquer máquina
✅ PostgreSQL isolado
✅ Hot reload funciona
✅ Fácil compartilhar com time
✅ Pronto para produção

