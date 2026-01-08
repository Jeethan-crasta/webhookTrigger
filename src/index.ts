import "dotenv/config";
import { startKafkaConsumer } from "./kafka/kafka.js";
import { initCouchDB } from "./service/couchdb.js";

async function bootstrap() {
  console.log("Starting webhook server...");
  initCouchDB();
  await startKafkaConsumer();
}

bootstrap().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
