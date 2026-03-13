import type { EmailMessage, MailFolder } from "../types/index.js";

const MAX_BODY_LENGTH = 2000;

const EXCLUDED_FOLDERS = new Set([
  "Outbox",
  "Drafts",
  "Sent Items",
  "Deleted Items",
  "Junk Email",
  "Conversation History",
  "Sync Issues",
]);

/**
 * Builds the classification prompt for `claude -p`.
 * Claude Code + MCP tools will be the LLM that reads & moves emails.
 */
export function buildClassificationPrompt(
  emails: readonly EmailMessage[],
  folders: readonly MailFolder[],
): string {
  const folderList = formatFolders(folders);
  const emailList = formatEmails(emails);

  return `You are an email classification assistant. You have access to Outlook MCP tools.

## Available Folders

${folderList}

## Emails to Classify

${emailList}

## Instructions

For each email above:
1. Analyze the subject, sender, and body to determine the best folder.
2. Use the outlook_move_message MCP tool to move it:
   - messageId: the email's ID
   - destinationFolderId: the target folder's ID
3. If no folder is a good match, leave the email in Inbox (do NOT move it).

After processing all emails, output a JSON summary in this exact format:
\`\`\`json
{
  "results": [
    {
      "messageId": "<id>",
      "subject": "<subject>",
      "movedTo": "<folder name or 'Inbox (unchanged)'>"
    }
  ],
  "totalProcessed": <number>,
  "totalMoved": <number>
}
\`\`\``;
}

function formatFolders(folders: readonly MailFolder[]): string {
  return folders
    .filter((f) => !EXCLUDED_FOLDERS.has(f.displayName))
    .map((f) => `- "${f.displayName}" (id: ${f.id})`)
    .join("\n");
}

function formatEmails(emails: readonly EmailMessage[]): string {
  return emails
    .map((email, i) => {
      let body = email.bodyPreview || email.body.content;

      // Strip HTML tags
      if (email.body.contentType === "html" && !email.bodyPreview) {
        body = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      }

      // Truncate
      if (body.length > MAX_BODY_LENGTH) {
        body = body.slice(0, MAX_BODY_LENGTH) + "... [truncated]";
      }

      return `### Email ${i + 1}
- **ID**: ${email.id}
- **Subject**: ${email.subject}
- **From**: ${email.from.name} <${email.from.address}>
- **Date**: ${email.receivedDateTime}
- **Has Attachments**: ${email.hasAttachments}
- **Body**: ${body}`;
    })
    .join("\n\n");
}
