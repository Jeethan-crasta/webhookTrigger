import { Kafka } from "kafkajs";
import { webhookTrigger } from "../service/webhook.js";


const brokersEnv = process.env.KAFKA_BROKERS;
if (!brokersEnv) {
  throw new Error("KAFKA_BROKERS is not defined");
}

const rawTopic = process.env.KAFKA_TOPIC;
if (!rawTopic) {
  throw new Error("KAFKA_TOPIC is not defined");
}

const topic: string = rawTopic;

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID ?? "webhook-trigger",
  brokers: brokersEnv.split(","),
});

export async function startKafkaConsumer() {
  const consumer = kafka.consumer({
    groupId: "webhook-consumer-group",
  });

  await consumer.connect();
  await consumer.subscribe({
    topic,
    fromBeginning: false,
  });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;

        const payload = JSON.parse(message.value.toString());
        await webhookTrigger(payload);

        // Commit offset ONLY on success
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (Number(message.offset) + 1).toString(),
          },
        ]);
      } catch (err) {
        console.error("Message processing failed:", err);
        // No commit → Kafka retries
      }
    },
  });
}
