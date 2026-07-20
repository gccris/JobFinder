# Entrega 3 — staging

Este root cria o control plane descartável de staging. O workflow `Release` empacota o mesmo data plane de produção com `environment=staging` e outro state:

- ALB interno e target group;
- app e worker como serviços separados;
- ElastiCache com TLS;
- banco/schema isolado;
- migration como task isolada;
- smoke test e job BullMQ controlado;
- outputs exigidos pelo contrato em `infra/README.md`.

O CodeBuild executa migration isolada, valida estabilidade e o auto-sleep remove ALB, ECS e Redis após 30 minutos ociosos.
