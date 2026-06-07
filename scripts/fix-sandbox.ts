// Quick fix: set demo project to IN_PROGRESS so sandbox is visible
import { createClient } from "@libsql/client";
import "dotenv/config";

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  await client.execute({
    sql: `UPDATE Project SET tokenRaised = tokenGoal, status = 'IN_PROGRESS' WHERE id = 'demo-project-1'`,
    args: [],
  });
  console.log("✅ demo-project-1 is now fully funded -> IN_PROGRESS");
}

main().catch(console.error).finally(() => process.exit(0));
