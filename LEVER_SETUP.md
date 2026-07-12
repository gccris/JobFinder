# 🚀 Integração com Lever API

## 📋 Como funciona?

O JobHub agora se integra com a plataforma **Lever** para sincronizar automaticamente todas as vagas da sua empresa.

## 🔑 Passo 1: Obter o Company ID

1. Acesse [Lever Hire](https://hire.lever.co/)
2. Faça login com sua conta
3. Vá para **Settings** → **Integrations** → **Developer**
4. Procure pela **API URL** que terá o formato:
   ```
   https://api.lever.co/v0/postings/{COMPANY_ID}
   ```
5. Copie o `COMPANY_ID`

## 🔄 Passo 2: Sincronizar as Vagas

### Via API (Recomendado)

```bash
curl -X POST http://localhost:3000/api/jobs/sync/lever \
  -H "Content-Type: application/json" \
  -d '{
    "lever_company_id": "seu-company-id"
  }'
```

### Resposta de Sucesso
```json
{
  "success": true,
  "message": "15 vagas foram sincronizadas da Lever",
  "synced": 15,
  "lever_company_id": "seu-company-id"
}
```

## 📊 O que é sincronizado?

- ✅ Título da vaga
- ✅ Descrição completa
- ✅ Localização
- ✅ Tipo de vaga (Full-time, Part-time, etc)
- ✅ Data de publicação
- ✅ Link original no Lever

## 🤖 Categorização Automática

As vagas são automaticamente categorizadas como:
- **BACKEND**: Backend, API, Server
- **FRONTEND**: React, Vue, Angular, Frontend
- **FULLSTACK**: Fullstack
- **DEVOPS**: DevOps, Infra, SRE
- **DATASCIENCE**: Data Science, Machine Learning
- **PRODUCT**: Product Manager, Designer

## 🔄 Sincronização Automática

Para sincronizar automaticamente a cada 6 horas, você pode usar o endpoint admin:

```bash
POST /api/admin/sync
```

## 📚 Documentação da Lever API

- [Lever Developer Docs](https://hire.lever.co/developer/documentation)
- [API Postings Endpoint](https://api.lever.co/v0/postings)

## ⚙️ Configurações Avançadas

Se quiser sincronizar vagas de múltiplas empresas Lever, chame o endpoint múltiplas vezes com IDs diferentes:

```bash
# Empresa 1
curl -X POST http://localhost:3000/api/jobs/sync/lever \
  -d '{"lever_company_id": "company-1"}'

# Empresa 2
curl -X POST http://localhost:3000/api/jobs/sync/lever \
  -d '{"lever_company_id": "company-2"}'
```

## 🐛 Troubleshooting

**Erro: Company ID não encontrado**
- Verifique se o company ID está correto
- Acesse https://api.lever.co/v0/postings/{COMPANY_ID} no navegador para testar

**Erro: Nenhuma vaga encontrada**
- Certifique-se de que a empresa tem vagas ativas no Lever
- Verifique a URL: https://api.lever.co/v0/postings/{COMPANY_ID}

**Erro de conexão**
- Verifique sua conexão com a internet
- Volte a tentar em alguns minutos
