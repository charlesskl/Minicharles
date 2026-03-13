/** Represents a Microsoft Outlook mail folder */
export interface MailFolder {
  readonly id: string;
  readonly displayName: string;
  readonly parentFolderId: string | null;
  readonly childFolderCount: number;
  readonly totalItemCount: number;
  readonly unreadItemCount: number;
}

/** Represents an email message from Outlook */
export interface EmailMessage {
  readonly id: string;
  readonly subject: string;
  readonly from: EmailAddress;
  readonly toRecipients: readonly EmailAddress[];
  readonly ccRecipients?: readonly EmailAddress[];
  readonly receivedDateTime: string;
  readonly bodyPreview: string;
  readonly body: EmailBody;
  readonly isRead: boolean;
  readonly parentFolderId: string;
  readonly hasAttachments: boolean;
}

export interface EmailAddress {
  readonly name: string;
  readonly address: string;
}

export interface EmailBody {
  readonly contentType: "text" | "html";
  readonly content: string;
}

/** User profile from Microsoft Graph */
export interface UserProfile {
  readonly displayName: string;
  readonly mail: string;
  readonly userPrincipalName: string;
}

/** Database row types */
export interface EmailLogRow {
  readonly id: number;
  readonly messageId: string;
  readonly subject: string;
  readonly from: string;
  readonly receivedAt: string;
  readonly folderId: string | null;
  readonly folderName: string | null;
  readonly classifiedAt: string | null;
  readonly summary: string | null;
}

export interface AppConfigRow {
  readonly key: string;
  readonly value: string;
}

export interface RunLogRow {
  readonly id: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly emailsProcessed: number;
  readonly status: "running" | "completed" | "failed";
  readonly error: string | null;
}

/** Represents an email attachment from Outlook */
export interface Attachment {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly isInline: boolean;
  readonly contentBytes?: string; // base64-encoded
}
