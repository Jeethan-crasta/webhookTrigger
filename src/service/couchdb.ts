import nano from "nano";
import { Client, WebhookTriggerDoc } from "../types/types.js";
import http from "http";
import https from "https";

const CACHE_TIME_LIMIT_IN_SECONDS = Number(process.env.CACHE_TIME_LIMIT_IN_SECONDS || 600);
const CLOUDANT_RETRY_STATUS_CODES = [429, 502, 503, 504];
const MAX_RETRIES = Number(process.env.MAX_RETRIES_FOR_NOTIFICATION || 2);

let couch: nano.ServerScope | undefined;
let lastCleared = Date.now();
const cache = new Map<string, Promise<Record<string, WebhookTriggerDoc>>>();

export function initCouchDB() {
  const url = process.env.COUCHDB_URL;
  if (!url) throw new Error("COUCHDB_URL is not defined");

  const isHttps = url.startsWith("https");

  const agent = isHttps
    ? new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000
      })
    : new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 30_000
      });

  couch = nano({
    url,
    requestDefaults: {
      agent,
    },
  } as nano.Configuration);
}

const query = {
  selector: { docType: "webhookTrigger" },
  use_index: "idx-webhook_docType",
};

export async function getWebhooksForClientIdCached(
  client: Client
): Promise<Record<string, WebhookTriggerDoc>> {
  if (!couch) {
    throw new Error("CouchDB not initialized. Call initCouchDB() first.");
  }

  clearCacheIfNeeded();

  const clientId = client.clientId;
  if (cache.has(clientId)) {
    return cache.get(clientId)!;
  }

  const dbName = client.data?.notifications || `notifications_${clientId}`;
  const db = couch.use(dbName);

  const promise = retry(async () => {
    const result = await db.find(query);

    if (!result?.docs) {
      throw new Error("Webhook data fetch failed");
    }

    return result.docs.reduce<Record<string, WebhookTriggerDoc>>(
      (acc, doc: any) => {
        acc[doc.trigger] = doc;
        return acc;
      },
      {}
    );
  });

  cache.set(clientId, promise);
  return promise;
}

function clearCacheIfNeeded() {
  if ((Date.now() - lastCleared) / 1000 > CACHE_TIME_LIMIT_IN_SECONDS) {
    cache.clear();
    lastCleared = Date.now();
  }
}

async function retry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && CLOUDANT_RETRY_STATUS_CODES.includes(err?.statusCode)) {
      await sleep(1000 + Math.random() * 2000);
      return retry(fn, retries - 1);
    }
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
