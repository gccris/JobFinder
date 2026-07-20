import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({});
let cached;

export async function getAccessSecret(secretArn) {
  if (cached) return cached;
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  const raw = response.SecretString || Buffer.from(response.SecretBinary || "", "base64").toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.accessToken || !parsed.signingKey) {
    throw new Error("O secret do auto-wake precisa conter accessToken e signingKey");
  }
  cached = parsed;
  return cached;
}
