export interface ClientConfig {
  disableWebhookRetriesForStatusCodes?: number[];
}

export interface Client {
  clientId: string;
  config?: ClientConfig;
  data?: {
    notifications?: string;
  };
}

export interface WebhookTriggerDoc {
  trigger: string;
  url: string;
  authorization?: string;
}

export interface WebhookLog {
  webhookTriggerId: string;
  executionStatusCode: number;
  errMessage?: string;
  clientId: string;
  reqTimestamp: Date;
  resTimestamp?: Date;
}
