import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OutlookClient } from "../graph/client.js";
import { processAttachment } from "./attachments.js";

const outlook = new OutlookClient();

const server = new McpServer({
  name: "minicharles-outlook",
  version: "0.2.0",
});

// --- Tool 1: list-folders ---
server.tool(
  "list-folders",
  "List all Outlook mail folders with id, displayName, and unreadCount",
  {},
  async () => {
    const folders = await outlook.listFolders();
    const summary = folders.map((f) => ({
      id: f.id,
      displayName: f.displayName,
      totalItems: f.totalItemCount,
      unreadCount: f.unreadItemCount,
      childFolderCount: f.childFolderCount,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
);

// --- Tool 2: get-messages ---
server.tool(
  "get-messages",
  "Get messages from a mail folder (defaults to inbox). Supports OData filter expressions.",
  {
    folderId: z
      .string()
      .optional()
      .describe("Mail folder ID. Omit for inbox."),
    top: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Number of messages to fetch (1-50, default 10)"),
    filter: z
      .string()
      .optional()
      .describe(
        "OData filter expression, e.g. \"isRead eq false\" or \"from/emailAddress/address eq 'user@example.com'\"",
      ),
  },
  async ({ folderId, top, filter }) => {
    const messages = await outlook.getMessages(folderId, top, filter);
    const summary = messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      from: `${m.from.name} <${m.from.address}>`,
      date: m.receivedDateTime,
      isRead: m.isRead,
      hasAttachments: m.hasAttachments,
      preview: m.bodyPreview.slice(0, 200),
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
);

// --- Tool 3: read-message ---
server.tool(
  "read-message",
  "Read a specific email message by ID. Returns full body, headers, from, to, cc, date.",
  {
    messageId: z.string().describe("The message ID to read"),
  },
  async ({ messageId }) => {
    const msg = await outlook.getMessage(messageId);

    const formatAddr = (a: { name: string; address: string }) =>
      a.name ? `${a.name} <${a.address}>` : a.address;

    const detail = {
      id: msg.id,
      subject: msg.subject,
      from: formatAddr(msg.from),
      to: msg.toRecipients.map(formatAddr),
      cc: msg.ccRecipients?.map(formatAddr) ?? [],
      date: msg.receivedDateTime,
      isRead: msg.isRead,
      hasAttachments: msg.hasAttachments,
      bodyType: msg.body.contentType,
      body: msg.body.content,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
    };
  },
);

// --- Tool 4: read-attachment ---
server.tool(
  "read-attachment",
  "Download and read an email attachment. Returns text content for text/PDF files, or metadata for images and other types.",
  {
    messageId: z.string().describe("The message ID that contains the attachment"),
    attachmentId: z
      .string()
      .optional()
      .describe(
        "Specific attachment ID. If omitted, lists all attachments on the message.",
      ),
  },
  async ({ messageId, attachmentId }) => {
    // If no attachmentId, list all attachments
    if (!attachmentId) {
      const attachments = await outlook.listAttachments(messageId);
      const list = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
      }));
      return {
        content: [
          {
            type: "text",
            text: `Found ${list.length} attachment(s):\n${JSON.stringify(list, null, 2)}`,
          },
        ],
      };
    }

    // Download specific attachment
    const attachment = await outlook.getAttachment(messageId, attachmentId);
    const result = await processAttachment(attachment);
    return { content: [{ type: "text", text: result }] };
  },
);

// --- Tool 5: move-message ---
server.tool(
  "move-message",
  "Move an email message to a different folder. Use list-folders first to get folder IDs.",
  {
    messageId: z.string().describe("The message ID to move"),
    destinationFolderId: z
      .string()
      .describe("The destination folder ID (use list-folders to find IDs)"),
  },
  async ({ messageId, destinationFolderId }) => {
    const moved = await outlook.moveMessage(messageId, destinationFolderId);
    return {
      content: [
        {
          type: "text",
          text: `Moved message "${moved.subject}" to folder ${moved.parentFolderId}`,
        },
      ],
    };
  },
);

// --- Tool 6: search-messages ---
server.tool(
  "search-messages",
  "Search email messages using a keyword query. Searches across subject, body, and sender fields.",
  {
    query: z
      .string()
      .describe(
        "Search query string, e.g. \"meeting agenda\" or \"from:boss@company.com\"",
      ),
    top: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum results to return (1-50, default 10)"),
  },
  async ({ query, top }) => {
    const messages = await outlook.searchMessages(query, top);
    const summary = messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      from: `${m.from.name} <${m.from.address}>`,
      date: m.receivedDateTime,
      preview: m.bodyPreview.slice(0, 200),
    }));
    return {
      content: [
        {
          type: "text",
          text: `Found ${summary.length} result(s):\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  },
);

// --- Start server ---
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Minicharles MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
