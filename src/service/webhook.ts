import axios from "axios";
import crypto from "crypto";
import { getWebhooksForClientIdCached } from "./couchdb.js";
import { sendLogsToES } from "../logs/es.js";

export async function webhookTrigger(parsedBody: any) {
  const startTime = new Date();
  const { client = {} } = parsedBody;
  const clientId = client.clientId || parsedBody.clientId;

  const webhooksMap = await getWebhooksForClientIdCached(client);
  const trigger = parsedBody.trigger;
  const messageTrigger = webhooksMap[trigger];

  if (!messageTrigger) return;

  const webhookUrl = messageTrigger.url;
  const authHeaders = messageTrigger.authorization
    ? decryptAuth(messageTrigger.authorization)
    : undefined;

  const config = {
    headers: {
      "Content-Type": "application/json",
      "X-LM-API-Webhook-Trigger-ID": parsedBody.webhookTriggerId,
      ...(authHeaders && { Authorization: authHeaders }),
    },
    timeout: Number(process.env.EXTERNAL_API_REQUEST_TIMEOUT_MS || 60000),
  };

  try {
    const res = await axios.post(webhookUrl, parsedBody, config);
    await sendLogsToES({
      webhookTriggerId: parsedBody.webhookTriggerId,
      executionStatusCode: res.status,
      clientId,
      reqTimestamp: startTime,
      resTimestamp: new Date(),
    });
  } catch (err: any) {
    await sendLogsToES({
      webhookTriggerId: parsedBody.webhookTriggerId,
      executionStatusCode: err?.response?.status || 500,
      errMessage: err.message,
      clientId,
      reqTimestamp: startTime,
    });
    throw err; // 🔥 Important: let Kafka retry
  }
}

function decryptAuth(input: string) {
  const iv = Buffer.from(input.split(":")[0], "hex");
  const encrypted = Buffer.from(input.split(":")[1], "hex");
  const key = Buffer.from(process.env.WEBHOOKS_CLIENTAUTH_ENCRYPTION_KEY!, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}
