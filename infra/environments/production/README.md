# Entrega 4 — production

Este root implementa o data plane efêmero:

- ALB interno integrado ao API Gateway por VPC Link;
- app `0.25 vCPU/0.5 GiB` e worker `0.5 vCPU/1 GiB`;
- ElastiCache `cache.t4g.micro` com TLS;
- tasks sem entrada pública e com saída para as fontes externas;
- health check em `/api/health/ready`;
- rolling deployment e rollback por digest;
- outputs exigidos por `infra/README.md`.

O Aurora fica no state `shared` e não pode ser destruído pelo auto-sleep.

Ele é empacotado pelo workflow `Release` com uma imagem identificada por digest. O CodeBuild sobe os serviços inicialmente em zero, executa `prisma migrate deploy` numa task isolada e então escala app e worker.
