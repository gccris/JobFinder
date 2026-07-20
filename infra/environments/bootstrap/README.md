# Entrega 1 — bootstrap

Este root implementa:

- bucket S3 com versionamento, criptografia e bloqueio público;
- state locking nativo do backend S3;
- provider OIDC do GitHub;
- roles separadas de plan e deploy;
- trust OIDC limitado ao repositório e roles distintas para plan/deploy.

Copie `terraform.tfvars.example`, preencha os identificadores e faça o primeiro apply localmente ou pelo CloudShell. O bucket usa versionamento, criptografia, bloqueio público, TLS obrigatório e lockfile nativo do backend S3.

Evidências: plan revisado, state remoto criado, login OIDC sem access key e teste de menor privilégio.
