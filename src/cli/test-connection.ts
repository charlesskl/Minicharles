import { OutlookClient } from "../graph/client.js";
import { getDb, closeDb } from "../db/index.js";

async function main(): Promise<void> {
  console.log("🔍 Minicharles — Connection Test\n");

  // Verify database
  const db = getDb();
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
    .all() as Array<{ name: string }>;
  console.log("📦 Database tables:", tables.map((t) => t.name).join(", "));

  // Test Microsoft Graph connection
  const client = new OutlookClient();

  try {
    // Fetch profile
    console.log("\n👤 Fetching user profile...");
    const profile = await client.getProfile();
    console.log(`   Name: ${profile.displayName}`);
    console.log(`   Email: ${profile.mail}`);

    // List folders
    console.log("\n📁 Mail folders:");
    const folders = await client.listFolders();
    for (const folder of folders) {
      const unread =
        folder.unreadItemCount > 0 ? ` (${folder.unreadItemCount} unread)` : "";
      console.log(
        `   ${folder.displayName}: ${folder.totalItemCount} items${unread}`,
      );
    }

    // Fetch recent messages
    console.log("\n📬 Recent messages (last 5):");
    const messages = await client.getMessages(undefined, 5);
    for (const msg of messages) {
      const date = new Date(msg.receivedDateTime).toLocaleString();
      const read = msg.isRead ? "✓" : "●";
      console.log(`   ${read} [${date}] ${msg.from.name}: ${msg.subject}`);
    }

    console.log("\n✅ All connections working!");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`\n❌ Connection test failed: ${message}`);
    if (
      error instanceof Error &&
      error.message.includes("authentication")
    ) {
      console.error("   Run `npm run auth` first to authenticate.");
    }
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
