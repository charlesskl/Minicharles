import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import { getCredential } from "../auth/index.js";
import { GRAPH_SCOPES } from "../config/index.js";
import type { EmailMessage, MailFolder, UserProfile } from "../types/index.js";

/**
 * Wrapper around Microsoft Graph API for Outlook operations.
 * Handles authentication, token refresh, and typed API calls.
 */
export class OutlookClient {
  private client: Client;

  constructor() {
    const credential = getCredential();

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: GRAPH_SCOPES.map((s) => `https://graph.microsoft.com/${s}`),
    });

    this.client = Client.initWithMiddleware({ authProvider });
  }

  /** Fetch the authenticated user's profile */
  async getProfile(): Promise<UserProfile> {
    const user = await this.client
      .api("/me")
      .select("displayName,mail,userPrincipalName")
      .get();

    return {
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  }

  /** List all mail folders in the user's mailbox */
  async listFolders(): Promise<readonly MailFolder[]> {
    const response = await this.client
      .api("/me/mailFolders")
      .select(
        "id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount",
      )
      .top(100)
      .get();

    return (response.value as Array<Record<string, unknown>>).map(
      (f) =>
        ({
          id: f.id as string,
          displayName: f.displayName as string,
          parentFolderId: (f.parentFolderId as string) ?? null,
          childFolderCount: f.childFolderCount as number,
          totalItemCount: f.totalItemCount as number,
          unreadItemCount: f.unreadItemCount as number,
        }) satisfies MailFolder,
    );
  }

  /**
   * Fetch recent messages, optionally from a specific folder.
   * @param folderId - If provided, fetch from this folder; otherwise from inbox
   * @param top - Number of messages to fetch (default 10)
   */
  async getMessages(
    folderId?: string,
    top: number = 10,
  ): Promise<readonly EmailMessage[]> {
    const endpoint = folderId
      ? `/me/mailFolders/${folderId}/messages`
      : "/me/messages";

    const response = await this.client
      .api(endpoint)
      .select(
        "id,subject,from,toRecipients,receivedDateTime,bodyPreview,body,isRead,parentFolderId,hasAttachments",
      )
      .top(top)
      .orderby("receivedDateTime desc")
      .get();

    return (response.value as Array<Record<string, unknown>>).map(
      (m) =>
        ({
          id: m.id as string,
          subject: (m.subject as string) ?? "(no subject)",
          from: parseEmailAddress(m.from),
          toRecipients: (
            (m.toRecipients as Array<Record<string, unknown>>) ?? []
          ).map(parseEmailAddress),
          receivedDateTime: m.receivedDateTime as string,
          bodyPreview: (m.bodyPreview as string) ?? "",
          body: {
            contentType: (((m.body as Record<string, unknown>)
              ?.contentType as string) ?? "text") as "text" | "html",
            content:
              ((m.body as Record<string, unknown>)?.content as string) ?? "",
          },
          isRead: m.isRead as boolean,
          parentFolderId: m.parentFolderId as string,
          hasAttachments: m.hasAttachments as boolean,
        }) satisfies EmailMessage,
    );
  }
  /** Move a message to a different folder */
  async moveMessage(messageId: string, destinationFolderId: string): Promise<void> {
    await this.client
      .api(`/me/messages/${messageId}/move`)
      .post({ destinationId: destinationFolderId });
  }
}

function parseEmailAddress(
  addr: unknown,
): { name: string; address: string } {
  const emailAddr = (addr as Record<string, unknown>)
    ?.emailAddress as Record<string, unknown>;
  return {
    name: (emailAddr?.name as string) ?? "",
    address: (emailAddr?.address as string) ?? "",
  };
}
