import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let cachedSecrets: any;

export async function loadSecrets(): Promise<any> {
  if (cachedSecrets) return cachedSecrets;

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION!,
  });

  const command = new GetSecretValueCommand({
    SecretId: process.env.SECRETS_NAME!,
  });

  const result = await client.send(command);

  if (!result.SecretString && !result.SecretBinary) {
  throw new Error("Secret has no value");
}

const secretString = result.SecretString
  ? result.SecretString
  : Buffer.from(result.SecretBinary!).toString("utf-8");

  cachedSecrets = JSON.parse(secretString);
  return cachedSecrets;
}
