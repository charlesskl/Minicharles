import { authenticate } from "../auth/index.js";
import { getDb, closeDb } from "../db/index.js";

async function main(): Promise<void> {
  console.log("🚀 Minicharles — Microsoft 365 Authentication\n");

  // Ensure database is initialized
  getDb();
  console.log("📦 Database initialized.\n");

  try {
    await authenticate();
    console.log("\n🎉 Setup complete! Run `npm run test-connection` to verify.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`\n❌ Authentication failed: ${message}`);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
