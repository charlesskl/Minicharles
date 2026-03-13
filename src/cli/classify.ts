import { ClassificationRunner } from "../classifier/runner.js";
import { closeDb } from "../db/index.js";

async function main(): Promise<void> {
  console.log("🤖 Minicharles — Email Classification\n");

  const runner = new ClassificationRunner();

  try {
    const result = await runner.run();

    console.log("\n📊 Run Summary:");
    console.log(`   Processed: ${result.emailsProcessed}`);
    console.log(`   Duration:  ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`   Run ID:    ${result.runId}`);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`\n❌ Classification failed: ${message}`);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
